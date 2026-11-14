const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("release manifest hashes the exact downloadable files", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "imgconv-manifest-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { version } = require("../package.json");
  const files = [`Image-to-WebP-${version}.exe`, `Image-to-WebP-Setup-${version}.exe`, `Image-to-WebP-Setup-${version}.exe.blockmap`, "latest.yml"];
  for (const file of files) await fs.writeFile(path.join(directory, file), "hello world\n");
  const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/release-checksums.cjs"), directory], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = await fs.readFile(path.join(directory, "SHA256SUMS.txt"), "utf8");
  const hash = "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447";
  assert.equal(manifest, files.map(file => `${hash}  ${file}\n`).join(""));
});

test("release manifest refuses incomplete builds", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "imgconv-manifest-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/release-checksums.cjs"), directory], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  await assert.rejects(fs.stat(path.join(directory, "SHA256SUMS.txt")), { code: "ENOENT" });
});
