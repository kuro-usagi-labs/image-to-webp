// Run only through run-electron-smoke.cjs: this is an isolated real Electron test.
const { app, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const temp = process.env.IMGCONV_TEST_ROOT;
if (!temp) throw new Error("Run this test using npm run test:electron.");
app.disableHardwareAcceleration();
app.setName("Image Converter Test");
app.setPath("userData", path.join(temp, "profile"));
app.setPath("sessionData", path.join(temp, "session"));
sharp.cache(false);

async function main() {
  const png = path.join(temp, "photo.png");
  const jpg = path.join(temp, "photo.jpg");
  const output = path.join(temp, "output");
  await sharp({ create: { width: 24, height: 12, channels: 3, background: "red" } }).png().toFile(png);
  await sharp(png).jpeg().toFile(jpg);

  ipcMain.once("app-ready", async event => {
    try {
      const result = await event.sender.executeJavaScript(`(async () => {
        const assert = (ok, message) => { if (!ok) throw new Error(message); };
        assert(typeof require === "undefined", "Node must not be available in the renderer");
        assert(!window.electronAPI.uploadToWordPress && !window.electronAPI.getWpPassword, "WordPress API remains exposed");
        assert(!document.querySelector('[data-page="wordpress"], #wpEditModal'), "WordPress UI remains");
        addLogEntry("unsafe.png", false, 'bad " onmouseover="injected"><img src=x onerror="injected">');
        assert(!document.querySelector('#settingsLogsBody [onmouseover], #settingsLogsBody [onerror], #settingsLogsBody img'), "Log markup injection");
        let denied = false;
        try { await window.electronAPI.getStoreValue("wp-encrypted-passwords"); } catch { denied = true; }
        assert(denied, "Retired credentials readable");
        await window.electronAPI.setStoreValue("image-to-webp-quality", 72);
        assert(await window.electronAPI.getStoreValue("image-to-webp-quality") === 72, "Settings IPC failed");
        const converted = await window.electronAPI.convertImages({ files: ${JSON.stringify([png, jpg])}, outputDir: ${JSON.stringify(output)}, format: "webp", quality: 85 });
        assert(converted.success === 2, "Native conversion failed: " + converted.message);
        const cspViolation = new Promise(resolve => document.addEventListener("securitypolicyviolation", e => resolve(e.violatedDirective), { once: true }));
        await fetch("https://example.invalid/blocked-by-csp").catch(() => {});
        assert(await cspViolation === "connect-src", "Network is not blocked by CSP");
        return { success: converted.success, sandbox: true, csp: true, wordpressRemoved: true };
      })()`);
      assert.equal(fs.readdirSync(output).length, 2);
      console.log("Electron smoke test passed:", JSON.stringify(result));
      app.exit(0);
    } catch (error) {
      console.error("Electron smoke test failed:", error);
      app.exit(1);
    }
  });

  const appRoot = process.argv.find(arg => arg.startsWith("--app-root="))?.slice("--app-root=".length) || path.join(__dirname, "..");
  require(path.join(appRoot, "electron-main.js"));
}

main().catch(error => { console.error(error); app.exit(1); });
