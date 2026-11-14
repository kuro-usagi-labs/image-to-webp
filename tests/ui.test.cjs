const test = require("node:test");
const assert = require("node:assert/strict");
const { loadRenderer } = require("./helpers.cjs");

test("format cards select the encoder used by the next conversion", async t => {
  let payload;
  const { dom, window, document } = await loadRenderer({
    convertImages: async value => { payload = value; return { ok: true, total: 1, processed: 1, message: "done" }; }
  });
  t.after(() => dom.window.close());
  const cards = document.querySelectorAll('input[name="output-format"]');
  assert.equal(cards.length, 4);
  document.querySelector('input[name="output-format"][value="jpeg"]').click();
  await window.addFiles(["C:\\fixture\\image.png"]);
  await window.startConversion();
  assert.equal(payload.format, "jpeg");
  assert.equal(document.querySelector('input[name="output-format"]:checked').value, "jpeg");
});

test("the saved format is reflected by the selected format card", async t => {
  const { dom, document } = await loadRenderer({
    getStoreValue: async key => key === "image-to-webp-output-format" ? "png" : undefined
  });
  t.after(() => dom.window.close());
  assert.equal(document.querySelector('input[name="output-format"]:checked')?.value, "png");
});

test("format choices are locked until the active conversion finishes", async t => {
  let finish;
  const { dom, window, document } = await loadRenderer({
    convertImages: () => new Promise(resolve => { finish = resolve; })
  });
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\image.png"]);
  const pending = window.startConversion();
  const cards = [...document.querySelectorAll('input[name="output-format"]')];
  assert.equal(cards.length, 4);
  assert.ok(cards.every(card => card.disabled));
  finish({ ok: true, total: 1, processed: 1, message: "done" });
  await pending;
  assert.ok(cards.every(card => !card.disabled));
});

test("preserve folders starts checked when no preference has been saved", async t => {
  const { dom, document } = await loadRenderer();
  t.after(() => dom.window.close());
  assert.equal(document.getElementById("preserveFolders").checked, true);
});

test("dialogs receive focus and Escape restores focus to their trigger", async t => {
  const { dom, window, document } = await loadRenderer();
  t.after(() => dom.window.close());
  const trigger = document.getElementById("settingsBtn");
  trigger.focus();
  trigger.click();
  assert.equal(document.activeElement, document.getElementById("settingsClose"));
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.activeElement, trigger);
  assert.equal(document.getElementById("settingsPanel").getAttribute("aria-hidden"), "true");
});

test("dynamically rendered image actions have accessible button names", async t => {
  const { dom, window, document } = await loadRenderer();
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\image.png"]);
  for (const button of document.querySelectorAll(".file-item button")) {
    assert.ok(button.getAttribute("aria-label"), button.dataset.action);
  }
});

test("results can be opened after converting to the original image folder", async t => {
  let revealed;
  const { dom, window, document, callbacks } = await loadRenderer({
    showItemInFolder: async file => { revealed = file; }
  });
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\image.png"]);
  window.electronAPI.convertImages = async () => {
    callbacks.progress({ current: 1, total: 1, srcPath: "C:\\fixture\\image.png", convertedOk: true, outputPath: "C:\\fixture\\image.webp" });
    return { ok: true, total: 1, processed: 1, message: "done" };
  };
  await window.startConversion();
  assert.equal(document.getElementById("openOutputBtn").disabled, false);
  await window.openOutputFolder();
  assert.equal(revealed, "C:\\fixture\\image.webp");
});

test("choosing a new output location makes completed files available for conversion again", async t => {
  const { dom, window, document, callbacks } = await loadRenderer({ pickOutputFolder: async () => "C:\\new-output" });
  t.after(() => dom.window.close());
  await window.addFiles(["C:\\fixture\\image.png"]);
  window.electronAPI.convertImages = async () => {
    callbacks.progress({ current: 1, total: 1, srcPath: "C:\\fixture\\image.png", convertedOk: true });
    return { ok: true, total: 1, processed: 1, message: "done" };
  };
  await window.startConversion();
  assert.equal(document.getElementById("convertBtn").disabled, true);
  await window.chooseOutputFolder();
  assert.equal(document.getElementById("convertBtn").disabled, false);
});
