const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");

async function loadMain(initialSettings = {}) {
  const handlers = new Map();
  const settings = new Map(Object.entries(initialSettings));
  const app = new EventEmitter();
  let ready;
  Object.assign(app, {
    isPackaged: false,
    requestSingleInstanceLock: () => true,
    whenReady: () => ({ then: (callback) => { ready = callback; } }),
    quit() {},
    getVersion: () => "2.5.0"
  });
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: pathToFileURL(path.join(root, "ui/index.html")).href, parent: null };
      this.webContents.setWindowOpenHandler = (handler) => { this.openWindow = handler; };
      this.webContents.session = {
        setPermissionRequestHandler: (handler) => { this.requestPermission = handler; },
        setPermissionCheckHandler: (handler) => { this.checkPermission = handler; }
      };
      this.webContents.send = () => {};
      this.webContents.isDestroyed = () => false;
      Window.current = this;
    }
    loadFile() {}
    isDestroyed() { return false; }
    show() {}
  }
  const ipcMain = new EventEmitter();
  ipcMain.handle = (channel, handler) => handlers.set(channel, handler);
  const electron = {
    app, BrowserWindow: Window, ipcMain,
    nativeTheme: Object.assign(new EventEmitter(), { shouldUseDarkColors: false }),
    safeStorage: { isEncryptionAvailable: () => false },
    Menu: { buildFromTemplate: (items) => items },
    Tray: class extends EventEmitter { setToolTip() {} setContextMenu() {} },
    Notification: class { show() {} },
    dialog: {}, shell: {}, clipboard: { writeText() {} }
  };
  const Store = class {
    get(key, fallback) { return settings.has(key) ? settings.get(key) : fallback; }
    set(key, value) { settings.set(key, value); }
    delete(key) { settings.delete(key); }
  };
  const source = fs.readFileSync(path.join(root, "electron-main.js"), "utf8")
    .replace('import("electron-store")', "loadStore()")
    .replace('import("p-limit")', "loadLimit()");
  const localRequire = require("node:module").createRequire(path.join(root, "electron-main.js"));
  new Function("require", "__dirname", "process", "loadStore", "loadLimit", source)(
    (name) => name === "electron" ? electron : localRequire(name), root,
    { ...process, argv: [process.execPath, root] },
    async () => ({ default: Store }),
    () => import(pathToFileURL(localRequire.resolve("p-limit")).href)
  );
  await ready();
  const window = Window.current;
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  return {
    handlers, settings, window, event,
    invoke: (channel, ...args) => handlers.get(channel)(event, ...args)
  };
}

async function loadRenderer(overrides = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "ui/index.html"), "utf8"), {
    url: pathToFileURL(path.join(root, "ui/index.html")).href,
    runScripts: "outside-only", pretendToBeVisual: true
  });
  const { window } = dom;
  let signalReady;
  const ready = new Promise(resolve => { signalReady = resolve; });
  const callbacks = {};
  window.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  window.electronAPI = {
    getStoreValue: async () => undefined,
    setStoreValue: async () => ({ ok: true }),
    deleteStoreValue: async () => ({ ok: true }),
    getSystemTheme: async () => false,
    onThemeUpdated() {}, onUpdaterEvent() {},
    validateOutputFolder: async () => ({ ok: true, exists: true }),
    getFileSizes: async (paths) => Object.fromEntries(paths.map(p => [p, 128])),
    onConvertProgress: callback => { callbacks.progress = callback; },
    signalReady,
    ...overrides
  };
  window.eval(fs.readFileSync(path.join(root, "ui/icons.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "ui/renderer.js"), "utf8"));
  await ready;
  return { dom, window, document: window.document, callbacks };
}

module.exports = { root, loadMain, loadRenderer };
