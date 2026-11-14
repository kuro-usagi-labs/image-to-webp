const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, Menu, Tray, Notification } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const child_process = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { convertImage, validateConversionOptions } = require("./lib/conversion");
const { assertSettingKey, validateSetting, removeRetiredWordPressSettings } = require("./lib/settings");

let store;
const storeReady = (async () => {
  try {
    const StoreModule = await import("electron-store");
    const Store = StoreModule.default;
    store = new Store();
    removeRetiredWordPressSettings(store);
  } catch (error) {
    console.error("Gagal initialize electron-store:", error);
  }
})();

let mainWindow;
let autoUpdater = null;

let tray = null;
let isQuitting = false;

const IMAGE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif",
  ".tiff", ".tif", ".webp", ".avif", ".svg"
];

function initAutoUpdater() {
  if (autoUpdater || !app.isPackaged) {
    return;
  }

  try {
    const updaterModule = require("electron-updater");
    autoUpdater = updaterModule.autoUpdater;
    autoUpdater.autoDownload = false;

    autoUpdater.on("update-available", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-event", { type: "update-available", info });
      }
    });

    autoUpdater.on("update-not-available", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-event", { type: "update-not-available", info });
      }
    });

    autoUpdater.on("error", (error) => {
      const message = error?.message || "Updater error";
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-event", { type: "update-error", message });
      }
    });
  } catch (error) {
    console.warn("Auto updater dinonaktifkan:", error?.message || error);
  }
}

const UI_URL = pathToFileURL(path.join(__dirname, "ui", "index.html")).href;

function isTrustedSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed()
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame
    && event.senderFrame?.url === UI_URL);
}

function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error("Asal IPC tidak diizinkan.");
    return handler(event, ...args);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 920,
    minHeight: 720,
    resizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#f5f5f7",
    icon: path.join(__dirname, "ui", "app.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === "win32") {
         mainWindow.setSkipTaskbar(true);
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("will-frame-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

  const showWhenReady = (event) => {
    if (!isTrustedSender(event)) return;
    ipcMain.removeListener("app-ready", showWhenReady);
    if (!process.argv.includes("--hidden")) mainWindow.show();
  };
  ipcMain.on("app-ready", showWhenReady);
}

function createTray() {
  const iconPath = path.join(__dirname, "ui", "app.ico");
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: "Buka Image to WebP", click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (process.platform === "win32") mainWindow.setSkipTaskbar(false);
        }
      }
    },
    { type: "separator" },
    { label: "Keluar", click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip("Image to WebP Converter");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        if (process.platform === "win32") mainWindow.setSkipTaskbar(true);
      } else {
        mainWindow.show();
        if (process.platform === "win32") mainWindow.setSkipTaskbar(false);
      }
    }
  });
}

function registerContextMenu() {
  if (process.platform !== "win32") return;

  const exePath = process.execPath;
  const command = `"${exePath}" "%1" "--hidden"`;
  
  const exts = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".avif"];
  
  exts.forEach((ext) => {
    const baseKey = `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\ConvertToWebP`;
    
    child_process.execFile("reg.exe", ["add", baseKey, "/ve", "/t", "REG_SZ", "/d", "Convert to WebP", "/f"], (err) => {
      if (!err) {
        child_process.execFile("reg.exe", ["add", baseKey, "/v", "Icon", "/t", "REG_SZ", "/d", `"${exePath}"`, "/f"]);
        child_process.execFile("reg.exe", ["add", `${baseKey}\\command`, "/ve", "/t", "REG_SZ", "/d", command, "/f"]);
      }
    });
  });
}

async function convertImageBackground(filePath) {
  if (!isImage(filePath)) return;

  try {
    await storeReady;
    await convertImage({
      sourcePath: filePath,
      outputDir: path.dirname(filePath),
      format: "webp",
      quality: store?.get("image-to-webp-quality", 85) ?? 85
    });

    new Notification({
      title: "Konversi Selesai",
      body: `Berhasil mengubah ${path.basename(filePath)} ke WebP.`,
      icon: path.join(__dirname, "ui", "app.ico")
    }).show();

  } catch (err) {
    new Notification({
      title: "Konversi Gagal",
      body: `Gagal mengubah ${path.basename(filePath)}: ${err.message}`,
      icon: path.join(__dirname, "ui", "app.ico")
    }).show();
  }
}

handleIpc("check-updates", async () => {
  if (!app.isPackaged) {
    return { ok: false, message: "Pengecekan update hanya tersedia pada aplikasi terpasang." };
  }

  initAutoUpdater();
  if (!autoUpdater) {
    return { ok: false, message: "Auto updater gagal diinisialisasi." };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error?.message || "Gagal mengecek update.";
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-event", { type: "update-error", message });
    }
    return { ok: false, message };
  }
});

nativeTheme.on("updated", () => {
  if (mainWindow) mainWindow.webContents.send("theme-updated", nativeTheme.shouldUseDarkColors);
});

handleIpc("get-system-theme", () => nativeTheme.shouldUseDarkColors);

handleIpc("store-get", async (_event, key, defaultValue) => {
  assertSettingKey(key);
  await storeReady;
  return store ? store.get(key, defaultValue) : defaultValue;
});

handleIpc("store-set", async (_event, key, value) => {
  const validated = validateSetting(key, value);
  await storeReady;
  if (!store) return { ok: false, message: "Store not ready" };
  store.set(key, validated);
  return { ok: true };
});

handleIpc("store-delete", async (_event, key) => {
  assertSettingKey(key);
  await storeReady;
  if (store) store.delete(key);
  return { ok: true };
});

function isImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

async function collectImagesRecursive(folderPath) {
  const output = [];
  const items = await fs.promises.readdir(folderPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(folderPath, item.name);
    if (item.isDirectory()) {
      const nested = await collectImagesRecursive(fullPath);
      output.push(...nested);
      continue;
    }
    if (item.isFile() && isImage(fullPath)) {
      output.push(fullPath);
    }
  }

  return output;
}

async function getFileSize(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

function normalizePayloadFiles(files) {
  return files
    .map((entry) => {
      if (typeof entry === "string") {
        return { path: entry, rootDir: "" };
      }
      return {
        path: String(entry?.path || "").trim(),
        rootDir: String(entry?.rootDir || "").trim()
      };
    })
    .filter((entry) => entry.path && isImage(entry.path));
}

function resolveOutputDirectory({ manualOutputDir, preserveFolders, rootDir, sourcePath }) {
  if (!manualOutputDir) {
    return path.dirname(sourcePath);
  }

  if (!preserveFolders || !rootDir) {
    return manualOutputDir;
  }

  const relativeDir = path.dirname(path.relative(rootDir, sourcePath));
  if (!relativeDir || relativeDir === ".") {
    return manualOutputDir;
  }

  const normalized = path.normalize(relativeDir);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return manualOutputDir;
  }

  return path.join(manualOutputDir, normalized);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  );
  return `${parseFloat((bytes / Math.pow(1024, exponent)).toFixed(1))} ${units[exponent]}`;
}

handleIpc("pick-image-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih File Gambar",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "tiff", "tif", "webp", "avif", "svg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths;
});

handleIpc("pick-image-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih Folder Gambar",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, rootDir: "", files: [] };
  }

  const rootDir = result.filePaths[0];
  return {
    canceled: false,
    rootDir,
    files: await collectImagesRecursive(rootDir)
  };
});

handleIpc("scan-dropped-paths", async (_event, paths) => {
  const resultFiles = [];
  for (const p of paths) {
    try {
      const stat = await fs.promises.stat(p);
      if (stat.isDirectory()) {
        const nested = await collectImagesRecursive(p);
        resultFiles.push(...nested.map(f => ({ path: f, rootDir: p })));
      } else if (isImage(p)) {
        resultFiles.push({ path: p, rootDir: path.dirname(p) });
      }
    } catch {
      // Ignore errors for individual paths
    }
  }
  return resultFiles;
});

handleIpc("pick-output-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih Folder Output",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }

  return result.filePaths[0];
});

handleIpc("open-output-folder", async (_event, targetPath) => {
  const resolvedPath = String(targetPath || "").trim();
  if (!resolvedPath) {
    return { ok: false, message: "Folder output belum dipilih." };
  }

  try {
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) return { ok: false, message: "Path output bukan folder." };
  } catch {
    return { ok: false, message: "Folder output tidak ditemukan." };
  }

  const errorMessage = await shell.openPath(resolvedPath);
  if (errorMessage) {
    return { ok: false, message: errorMessage };
  }

  return { ok: true };
});

handleIpc("show-item-in-folder", async (_event, filePath) => {
  const resolved = String(filePath || "").trim();
  if (!resolved) return;
  shell.showItemInFolder(resolved);
});

handleIpc("validate-output-folder", async (_event, targetPath) => {
  const resolvedPath = String(targetPath || "").trim();
  if (!resolvedPath) {
    return { ok: false, exists: false, message: "Folder output belum dipilih." };
  }

  try {
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
      return { ok: false, exists: false, message: "Path output bukan folder." };
    }
  } catch {
    return { ok: false, exists: false, message: "Folder output tersimpan tidak ditemukan." };
  }

  return { ok: true, exists: true, path: resolvedPath };
});

handleIpc("get-file-sizes", async (_event, filePaths) => {
  const sizes = {};
  for (const filePath of filePaths) {
    sizes[filePath] = await getFileSize(filePath);
  }
  return sizes;
});

let currentJob = null;

handleIpc("cancel-batch", async () => {
  if (currentJob) currentJob.cancelled = true;
  return { ok: true };
});

handleIpc("convert-images", async (event, payload) => {
  if (currentJob) return { ok: false, message: "Batch konversi masih berjalan." };
  let options;
  try {
    options = validateConversionOptions(payload?.format ?? "webp", payload?.quality ?? 85);
  } catch (error) {
    return { ok: false, message: error.message };
  }
  const files = normalizePayloadFiles(Array.isArray(payload?.files) ? payload.files : []);
  const outputDir = String(payload?.outputDir || "").trim();
  const preserveFolders = Boolean(payload?.preserveFolders);
  if (!files.length) return { ok: false, message: "Tidak ada file gambar yang dipilih." };

  const job = { cancelled: false };
  currentJob = job;
  try {
    const { default: pLimit } = await import("p-limit");
    const limit = pLimit(Math.min(4, Math.max(1, os.cpus().length - 1)));
    let success = 0;
    let failed = 0;
    let totalOriginalSize = 0;
    let totalOutputSize = 0;
    let processed = 0;
    const total = files.length;
    const errors = [];
    await Promise.all(files.map(file => limit(async () => {
      if (job.cancelled) return;
      const { path: srcPath, rootDir } = file;
      let convertedOk = false;
      let converted = { outputPath: "", outputFileName: "", originalSize: 0, newSize: 0 };
      let status;
      try {
        converted = await convertImage({
          sourcePath: srcPath,
          outputDir: resolveOutputDirectory({ manualOutputDir: outputDir, preserveFolders, rootDir, sourcePath: srcPath }),
          ...options
        });
        convertedOk = true;
        success += 1;
        totalOriginalSize += converted.originalSize;
        totalOutputSize += converted.newSize;
        const savedPct = converted.originalSize ? Math.round((1 - converted.newSize / converted.originalSize) * 100) : 0;
        status = `Berhasil: ${path.basename(srcPath)} (hemat ${savedPct}%)`;
      } catch (error) {
        failed += 1;
        const message = error?.message || "Unknown error";
        status = `Gagal: ${path.basename(srcPath)} - ${message}`;
        errors.push({ file: path.basename(srcPath), error: message });
      }
      processed += 1;
      if (!event.sender.isDestroyed()) event.sender.send("convert-progress", {
        current: processed, total, success, failed, status, srcPath, convertedOk, ...converted
      });
    })));
    const skipped = total - processed;
    const totalDelta = totalOriginalSize - totalOutputSize;
    const deltaPct = totalOriginalSize ? Math.round(Math.abs(totalDelta) / totalOriginalSize * 100) : 0;
    const sizeMessage = totalDelta >= 0
      ? `Hemat total: ${formatBytes(totalDelta)} (${deltaPct}%)`
      : `Ukuran bertambah: ${formatBytes(Math.abs(totalDelta))} (${deltaPct}%)`;
    const message = job.cancelled
      ? `Dibatalkan. Selesai diproses: ${processed}/${total}. Berhasil: ${success}, Gagal: ${failed}, Dilewati: ${skipped}. ${sizeMessage}`
      : `Selesai. Berhasil: ${success}, Gagal: ${failed}. ${sizeMessage}`;
    return { ok: true, cancelled: job.cancelled, processed, skipped, message, success, failed,
      total, totalOriginalSize, totalOutputSize, totalDelta, deltaPct, outputDir, errors };
  } finally {
    currentJob = null;
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) {
         mainWindow.show();
         if (process.platform === "win32") mainWindow.setSkipTaskbar(false);
      }
      mainWindow.focus();
    }
    
    // Check if launched via context menu
    const imagePathArg = commandLine.find(arg => arg !== process.execPath && !arg.startsWith("--") && isImage(arg));
    if (imagePathArg) {
      convertImageBackground(imagePathArg);
    }
  });

  app.whenReady().then(async () => {
    await storeReady;
    initAutoUpdater();
    createWindow();
    createTray();
    
    if (app.isPackaged) {
      registerContextMenu();
    }

    // Process initial arguments if opened via context menu directly
    const imagePathArg = process.argv.find(arg => arg !== process.execPath && !arg.startsWith("--") && isImage(arg));
    if (imagePathArg) {
      convertImageBackground(imagePathArg);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
