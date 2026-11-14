const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const sharp = require("sharp");
const { loadMain } = require("./helpers.cjs");

// libvips' input cache can retain Windows handles after metadata assertions.
sharp.cache(false);

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imgconv-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const png = path.join(dir, "photo.png");
  const jpg = path.join(dir, "photo.jpg");
  await sharp({ create: { width: 24, height: 12, channels: 3, background: "red" } }).png().toFile(png);
  await sharp({ create: { width: 12, height: 24, channels: 3, background: "blue" } }).jpeg().toFile(jpg);
  return { dir, png, jpg, outputDir: path.join(dir, "out") };
}

test("parallel conversions with the same basename preserve every distinct image", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [f.png, f.jpg], outputDir: f.outputDir, format: "webp" });
  assert.equal(result.success, 2);
  const names = await fs.readdir(f.outputDir);
  assert.equal(names.length, 2, "two successes must produce two separate files");
  const sizes = await Promise.all(names.map(async name => {
    const m = await sharp(path.join(f.outputDir, name)).metadata();
    return `${m.width}x${m.height}`;
  }));
  assert.deepEqual(sizes.sort(), ["12x24", "24x12"]);
});

test("existing outputs and source images are never overwritten", async t => {
  const f = await fixture(t);
  await fs.mkdir(f.outputDir);
  const existing = path.join(f.outputDir, "photo.webp");
  await fs.writeFile(existing, "keep existing bytes");
  const before = await fs.readFile(f.png);
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [f.png, f.jpg], outputDir: f.outputDir, format: "webp" });
  assert.equal(result.success, 2);
  assert.equal((await fs.readdir(f.outputDir)).length, 3);
  assert.equal(await fs.readFile(existing, "utf8"), "keep existing bytes");
  assert.deepEqual(await fs.readFile(f.png), before);
});

test("camera orientation is applied before EXIF is removed", async t => {
  const f = await fixture(t);
  const oriented = path.join(f.dir, "oriented.jpg");
  await sharp(f.png).jpeg().withMetadata({ orientation: 6 }).toFile(oriented);
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [oriented], outputDir: f.outputDir, format: "webp" });
  assert.equal(result.success, 1);
  const m = await sharp(path.join(f.outputDir, "oriented.webp")).metadata();
  assert.deepEqual([m.width, m.height], [12, 24]);
  assert.ok(!m.orientation || m.orientation === 1);
});

test("output directory errors become file failures instead of rejecting the whole batch", async t => {
  const f = await fixture(t);
  await fs.writeFile(f.outputDir, "not a directory");
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [f.png, f.jpg], outputDir: f.outputDir, format: "webp" });
  assert.equal(result.failed, 2);
  assert.equal(result.processed, 2);
  assert.equal(result.errors.length, 2);
});

test("invalid output formats cannot escape the destination or write arbitrary extensions", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [f.png], outputDir: f.outputDir, format: "svg" });
  assert.equal(result.ok, false);
  assert.deepEqual(await fs.readdir(f.dir), ["photo.jpg", "photo.png"]);
});

test("corrupt input leaves no reserved or partial output behind", async t => {
  const f = await fixture(t);
  const bad = path.join(f.dir, "broken.png");
  await fs.writeFile(bad, "not an image");
  const app = await loadMain();
  const result = await app.invoke("convert-images", { files: [bad, f.png], outputDir: f.outputDir, format: "webp" });
  assert.equal(result.failed, 1);
  assert.equal(result.success, 1);
  assert.deepEqual(await fs.readdir(f.outputDir), ["photo.webp"]);
});

test("all four encoders produce readable images", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  for (const [format, container] of [["webp", "webp"], ["avif", "heif"], ["jpeg", "jpeg"], ["png", "png"]]) {
    const result = await app.invoke("convert-images", { files: [f.png], outputDir: f.outputDir, format });
    assert.equal(result.success, 1, format);
    const meta = await sharp(path.join(f.outputDir, `photo.${format}`)).metadata();
    assert.equal(meta.format, container);
    assert.deepEqual([meta.width, meta.height], [24, 12]);
  }
});

test("separate conversion clients cannot claim the same output name", async t => {
  const f = await fixture(t);
  const { convertImage } = require("../lib/conversion");
  const results = await Promise.all(Array.from({ length: 12 }, () => convertImage({ sourcePath: f.png, outputDir: f.outputDir })));
  assert.equal(new Set(results.map(r => r.outputPath)).size, 12);
  assert.equal((await fs.readdir(f.outputDir)).length, 12);
});

test("cancel stops queued work and accounts for every skipped image", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  app.window.webContents.send = (_channel, data) => {
    if (data.current === 1) app.invoke("cancel-batch");
  };
  const result = await app.invoke("convert-images", { files: Array(16).fill(f.png), outputDir: f.outputDir });
  assert.equal(result.cancelled, true);
  assert.ok(result.processed >= 1 && result.processed <= 4);
  assert.equal(result.processed + result.skipped, 16);
  assert.equal((await fs.readdir(f.outputDir)).length, result.success);
});

test("overlapping batch requests cannot reset an active job", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  const first = app.invoke("convert-images", { files: [f.png], outputDir: f.outputDir });
  const second = await app.invoke("convert-images", { files: [f.jpg], outputDir: f.outputDir });
  assert.equal(second.ok, false);
  assert.equal((await first).success, 1);
});

test("non-finite or out-of-range quality is rejected before writing any output", async t => {
  const f = await fixture(t);
  const app = await loadMain();
  for (const quality of [0, 101, "invalid", NaN, Infinity, 50.5]) {
    const result = await app.invoke("convert-images", { files: [f.png], outputDir: f.outputDir, quality });
    assert.equal(result.ok, false, String(quality));
  }
  await assert.rejects(fs.stat(f.outputDir), { code: "ENOENT" });
});

test("preserved subfolders stay beneath the selected output root", async t => {
  const f = await fixture(t);
  const nested = path.join(f.dir, "sub", "photo.png");
  await fs.mkdir(path.dirname(nested));
  await fs.copyFile(f.png, nested);
  const app = await loadMain();
  const result = await app.invoke("convert-images", {
    files: [{ path: f.png, rootDir: f.dir }, { path: nested, rootDir: f.dir }],
    outputDir: f.outputDir, preserveFolders: true
  });
  assert.equal(result.success, 2);
  assert.ok((await fs.stat(path.join(f.outputDir, "photo.webp"))).size > 0);
  assert.ok((await fs.stat(path.join(f.outputDir, "sub", "photo.webp"))).size > 0);
});
