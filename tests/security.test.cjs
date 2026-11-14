const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { root, loadMain, loadRenderer } = require("./helpers.cjs");

test("log errors remain text and cannot create executable markup", async t => {
  const { dom, window, document } = await loadRenderer();
  t.after(() => dom.window.close());
  const attack = 'bad " onmouseover="window.pwned=1"><img src=x onerror="window.pwned=1">';
  window.addLogEntry("broken.png", false, attack);
  const body = document.getElementById("settingsLogsBody");
  assert.equal(body.querySelector("[onmouseover], [onerror], img"), null);
  assert.equal(body.querySelector(".log-status").title, attack);
});

test("WordPress settings and upload controls are absent from the working interface", async t => {
  const { dom, document } = await loadRenderer();
  t.after(() => dom.window.close());
  assert.equal(document.querySelector('[data-tab="wordpress"], [data-page="wordpress"], #wpEditModal, #wpAutoUpload'), null);
});

test("preload exposes no upload, credential or arbitrary clipboard capability", () => {
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(root, "preload.js"), "utf8"), {
    require: () => ({ contextBridge: { exposeInMainWorld: (_name, exposed) => { api = exposed; } }, ipcRenderer: {}, webUtils: {} })
  });
  for (const name of ["uploadToWordPress", "testWpConnection", "setWpPassword", "getWpPassword", "clearWpPassword", "copyToClipboard"]) {
    assert.equal(api[name], undefined, `${name} must no longer be callable`);
  }
});

test("retired WordPress data is purged without affecting converter preferences", async () => {
  const app = await loadMain({
    "wp-encrypted-passwords": "retired secret", "wp-encrypted-password": "legacy secret",
    "image-to-webp-wp-preset-overrides": '{"site":{"appPassword":"retired plaintext"}}',
    "image-to-webp-wp-auto-upload": true, "image-to-webp-wp-preset-select": "site",
    "image-to-webp-quality": 72
  });
  assert.equal(app.settings.get("image-to-webp-quality"), 72);
  assert.deepEqual([...app.settings.keys()], ["image-to-webp-quality"]);
});

test("generic settings API cannot read or write credentials or unknown configuration", async () => {
  const app = await loadMain({ "private-setting": "secret" });
  await assert.rejects(() => app.invoke("store-get", "private-setting"), /pengaturan|setting/i);
  await assert.rejects(() => app.invoke("store-set", "wp-encrypted-passwords", "new secret"), /pengaturan|setting/i);
  assert.equal(app.settings.has("wp-encrypted-passwords"), false);
});

test("invalid settings cannot poison the next renderer startup", async () => {
  const app = await loadMain();
  for (const [key, value] of [
    ["image-to-webp-theme", "unknown"], ["image-to-webp-quality", "NaN"],
    ["image-to-webp-preserve-folders", "false"], ["image-to-webp-output-format", "exe"],
    ["image-to-webp-output-dir", { path: "bad" }]
  ]) await assert.rejects(() => app.invoke("store-set", key, value));
  await app.invoke("store-set", "image-to-webp-quality", "72");
  assert.equal(await app.invoke("store-get", "image-to-webp-quality"), 72);
});

test("removed WordPress IPC channels cannot be invoked", async () => {
  const app = await loadMain();
  for (const channel of ["upload-to-wordpress", "test-wp-connection", "secrets:get-wp-password", "secrets:set-wp-password", "secrets:clear-wp-password", "copy-to-clipboard"]) {
    assert.equal(app.handlers.has(channel), false, channel);
  }
});

test("open output rejects executable files instead of launching them", async () => {
  const app = await loadMain();
  const result = await app.invoke("open-output-folder", process.execPath);
  assert.equal(result.ok, false);
});

test("IPC from foreign windows and child frames is rejected", async () => {
  const app = await loadMain();
  const handler = app.handlers.get("get-system-theme");
  await assert.rejects(async () => handler({ sender: {}, senderFrame: app.event.senderFrame }), /IPC|sender|asal/i);
  await assert.rejects(async () => handler({ sender: app.event.sender, senderFrame: { url: app.event.senderFrame.url, parent: {} } }), /IPC|sender|asal/i);
  assert.equal(await app.invoke("get-system-theme"), false);
});

test("new windows, remote navigation and permission requests are denied", async () => {
  const app = await loadMain();
  assert.equal(app.window.options.webPreferences.sandbox, true);
  assert.deepEqual(app.window.openWindow({ url: "https://example.test" }), { action: "deny" });
  let prevented = false;
  app.window.webContents.emit("will-navigate", { preventDefault: () => { prevented = true; } }, "https://example.test");
  assert.equal(prevented, true);
  let allowed;
  app.window.requestPermission({}, "media", decision => { allowed = decision; });
  assert.equal(allowed, false);
});

test("conversion can be run again after changing the output format", async t => {
  const { dom, window, document, callbacks } = await loadRenderer();
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\photo.png"]);
  const api = window.electronAPI;
  api.convertImages = async () => {
    await callbacks.progress({ current: 1, total: 1, srcPath: "C:\\fixture\\photo.png", convertedOk: true });
    return { ok: true, total: 1, processed: 1, message: "done" };
  };
  await window.startConversion();
  assert.equal(document.getElementById("convertBtn").disabled, true);
  const select = document.getElementById("outputFormat");
  select.value = "jpeg";
  select.dispatchEvent(new window.Event("change"));
  assert.equal(document.getElementById("convertBtn").disabled, false);
});

test("progress preserves queue items and adding logs preserves earlier rows", async t => {
  const { dom, window, document, callbacks } = await loadRenderer();
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\photo.png"]);
  const item = document.querySelector(".file-item");
  callbacks.progress({ current: 1, total: 1, srcPath: "C:\\fixture\\photo.png", convertedOk: true });
  assert.equal(document.querySelector(".file-item"), item);
  assert.equal(item.classList.contains("file-item--converted"), true);
  const earlierRow = document.querySelector("#settingsLogsBody tr");
  window.addLogEntry("second.png", true);
  assert.equal(document.querySelectorAll("#settingsLogsBody tr")[1], earlierRow);
});
