// Renderer checks and captures using Electron's test API, without computer use.
const { app, ipcMain, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const temp = process.env.IMGCONV_TEST_ROOT;
if (!temp) throw new Error("Run npm run test:ui.");
app.disableHardwareAcceleration();
app.setName("Image Converter UI Test");
app.setPath("userData", path.join(temp, "profile"));
app.setPath("sessionData", path.join(temp, "session"));
const output = path.join(__dirname, "..", "artifacts", "ui");
fs.mkdirSync(output, { recursive: true });

async function run() {
  const paths = [];
  for (const [name, bg, accent] of [["campaign-cover.png", "#df8eaf", "#57463e"], ["product-banner.jpg", "#d9ff43", "#57463e"]]) {
    const file = path.join(temp, name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${bg}"/><circle cx="320" cy="240" r="150" fill="${accent}"/><rect x="285" y="90" width="70" height="300" rx="30" fill="#ffc2ae" transform="rotate(35 320 240)"/></svg>`;
    await sharp(Buffer.from(svg)).toFile(file);
    paths.push(file);
  }
  for (const [index, name] of ["hero-desktop.png", "product-detail.jpg", "social-card.png", "thumbnail.jpg", "landing-banner.png", "article-header.jpg"].entries()) {
    const file = path.join(temp, name);
    fs.copyFileSync(paths[index % 2], file);
    paths.push(file);
  }

  ipcMain.once("app-ready", async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    event.sender.setBackgroundThrottling(false);
    win.setMinimumSize(0, 0);
    const js = source => event.sender.executeJavaScript(source);
    const settle = () => js(`(async () => {
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
      for (let frame = 0; frame < 90; frame += 1) {
        const container = document.getElementById('fileList').getBoundingClientRect();
        const pending = [...document.querySelectorAll('.f-thumb-image, .f-grid-image')].some(img => {
          const rect = img.getBoundingClientRect();
          return rect.bottom > container.top && rect.top < container.bottom
            && (!img.complete || !img.naturalWidth || !img.classList.contains('loaded'));
        });
        if (!pending) break;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    })()`);
    const results = [];
    async function capture(name, width, height) {
      win.setContentSize(width, height);
      await js(`document.getElementById('toast').classList.remove('show')`);
      await settle();
      if (process.env.IMGCONV_README_PREVIEW === "1") {
        await js(`document.querySelectorAll('.file-item').forEach(item => {
        const name = item.querySelector('.f-name')?.textContent || '';
        const path = item.querySelector('.f-path');
        if (path) path.textContent = 'C:/Gambar/Website/' + name;
        item.title = name;
        })`);
        await settle();
        assert.ok(await js(`Array.from(document.querySelectorAll('.f-path')).every(node => node.textContent.startsWith('C:/Gambar/Website/'))`), "Screenshot paths were not sanitized");
      }
      const metrics = await js(`(() => {
        const button = document.getElementById('convertBtn').getBoundingClientRect();
        const queue = document.querySelector('.queue-panel').getBoundingClientRect();
        const frame = document.querySelector('.app-frame').getBoundingClientRect();
        return { width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          height: innerHeight, pageHeight: document.documentElement.scrollHeight,
          queueWidth: queue.width, workspaceWidth: frame.width,
          dropHeight: document.getElementById('dropzone').getBoundingClientRect().height,
          buttonRight: button.right, buttonBottom: button.bottom,
          fontsLoaded: document.fonts.check('700 20px "Space Grotesk"') && document.fonts.check('400 10px "Space Mono"') };
      })()`);
      const image = await event.sender.capturePage();
      fs.writeFileSync(path.join(output, `${name}.png`), image.toPNG());
      assert.ok(metrics.pageWidth <= metrics.width + 1, `${name}: page overflow ${JSON.stringify(metrics)}`);
      assert.ok(metrics.buttonRight <= metrics.width, `${name}: conversion button clipped`);
      assert.ok(metrics.fontsLoaded, `${name}: local fonts failed to load`);
      if (width >= 850) assert.ok(metrics.buttonBottom <= height, `${name}: conversion button below viewport ${JSON.stringify(metrics)}`);
      if (width >= 850) {
        assert.ok(metrics.pageHeight <= metrics.height + 1, `${name}: entire page scrolls instead of queue`);
        assert.ok(metrics.queueWidth > metrics.workspaceWidth * .55, `${name}: queue is not the main workspace`);
      }
      results.push({ name, ...metrics });
    }

    try {
      await js(`applyTheme('light')`);
      await capture("empty-1220", 1220, 860);
      await js(`addFiles(${JSON.stringify(paths)})`);
      await capture("queue-1220", 1220, 860);
      const scrollCheck = await js(`(() => {
        const list = document.getElementById('fileList');
        const dock = document.querySelector('.action-dock');
        const before = dock.getBoundingClientRect().top;
        list.scrollTop = list.scrollHeight;
        const result = { scrollable: list.scrollHeight > list.clientHeight,
          dockUnchanged: dock.getBoundingClientRect().top === before,
          pickerVisible: document.getElementById('pickFilesBtn').getBoundingClientRect().top > 0,
          compactDropzone: document.getElementById('dropzone').getBoundingClientRect().height < 100 };
        list.scrollTop = 0;
        return result;
      })()`);
      assert.ok(Object.values(scrollCheck).every(Boolean), `Queue workflow failed: ${JSON.stringify(scrollCheck)}`);
      await capture("wide-1919", 1919, 895);
      await capture("minimum-920", 920, 720);
      win.setSize(920, 720);
      const [clientWidth, clientHeight] = win.getContentSize();
      await capture("native-minimum", clientWidth, clientHeight);
      await capture("narrow-390", 390, 900);
      win.setContentSize(1220, 860);
      await js(`applyTheme('dark')`);
      await capture("dark-1220", 1220, 860);
      await js(`applyTheme('light'); openSettings();`);
      await settle();
      fs.writeFileSync(path.join(output, "settings-1220.png"), (await event.sender.capturePage()).toPNG());
      await js(`closeSettings(); openPreview(0);`);
      await settle();
      fs.writeFileSync(path.join(output, "preview-1220.png"), (await event.sender.capturePage()).toPNG());
      await js(`closePreview();`);
      await js(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
      const accessibility = [];
      for (const [state, setup] of [
        ["light", ""], ["dark", "await applyTheme('dark')"],
        ["settings", "await applyTheme('light'); openSettings()"],
        ["about", "openAbout()"], ["preview", "openPreview(0)"]
      ]) {
        if (setup) await js(`(async () => { ${setup}; })()`);
        await settle();
        const violations = await js(`axe.run(document, { runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21aa'] } }).then(r => r.violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary}))})))`);
        accessibility.push({ state, violations });
      }
      fs.writeFileSync(path.join(output, "checks.json"), JSON.stringify({ layouts: results, accessibility }, null, 2));
      console.log(JSON.stringify({ layouts: results, accessibility }, null, 2));
      assert.ok(accessibility.every(result => result.violations.length === 0), "Accessibility violations: see artifacts/ui/checks.json");
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
  require(path.join(__dirname, "..", "electron-main.js"));
}
run().catch(error => { console.error(error); app.exit(1); });
