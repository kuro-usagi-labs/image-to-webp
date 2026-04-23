const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, clipboard, safeStorage, Menu, Tray, Notification } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const child_process = require("node:child_process");
const sharp = require("sharp");

let store;
const storeReady = (async () => {
  try {
    const StoreModule = await import("electron-store");
    const Store = StoreModule.default;
    store = new Store();
  } catch (error) {
    console.error("Gagal initialize electron-store:", error);
  }
})();

let mainWindow;
let autoUpdater = null;

let tray = null;
let isQuitting = false;

const IMAGE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".bmp",
  ".tiff", ".tif", ".webp", ".avif", ".svg"
];

const WP_PASSWORDS_STORE_KEY = "wp-encrypted-passwords";
const WP_LEGACY_PASSWORD_STORE_KEY = "wp-encrypted-password";
const WP_OVERRIDES_STORE_KEY = "image-to-webp-wp-preset-overrides";
const WP_PRESET_SELECT_STORE_KEY = "image-to-webp-wp-preset-select";

let wpSecretsMigrated = false;

function decodeStoredSecret(rawValue) {
  const rawString = String(rawValue || "");
  if (!rawString) {
    return "";
  }

  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(rawString, "base64"));
    } catch {
      // Fallback for secrets that were stored without encryption.
    }
  }

  return rawString;
}

function encodeStoredSecret(value) {
  const normalized = String(value || "");
  if (!normalized) {
    return "";
  }

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(normalized).toString("base64");
  }

  return normalized;
}

function sanitizeWpOverrides(rawValue) {
  let parsed = rawValue;

  if (!parsed) {
    return {};
  }

  if (typeof parsed === "string") {
    if (!parsed.trim()) {
      return {};
    }

    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const cleaned = {};

  for (const [presetKey, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const nextValue = {};
    const wpUrl = String(value.wpUrl || "").trim();
    const username = String(value.username || "").trim();

    if (wpUrl) {
      nextValue.wpUrl = wpUrl;
    }

    if (username) {
      nextValue.username = username;
    }

    if (Object.keys(nextValue).length) {
      cleaned[String(presetKey)] = nextValue;
    }
  }

  return cleaned;
}

function sanitizeWpPasswordMap(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const cleaned = {};

  for (const [presetKey, value] of Object.entries(rawValue)) {
    const password = String(value || "").trim();
    if (password) {
      cleaned[String(presetKey)] = password;
    }
  }

  return cleaned;
}

async function readStoredWpPasswordMap() {
  await storeReady;
  if (!store) {
    return {};
  }

  const decoded = decodeStoredSecret(store.get(WP_PASSWORDS_STORE_KEY, ""));
  if (!decoded) {
    return {};
  }

  try {
    return sanitizeWpPasswordMap(JSON.parse(decoded));
  } catch {
    return {};
  }
}

async function writeStoredWpPasswordMap(passwordMap) {
  await storeReady;
  if (!store) {
    return;
  }

  const cleaned = sanitizeWpPasswordMap(passwordMap);
  if (!Object.keys(cleaned).length) {
    store.delete(WP_PASSWORDS_STORE_KEY);
    return;
  }

  store.set(WP_PASSWORDS_STORE_KEY, encodeStoredSecret(JSON.stringify(cleaned)));
}

async function ensureWpSecretsMigrated() {
  if (wpSecretsMigrated) {
    return;
  }

  await storeReady;
  if (!store) {
    wpSecretsMigrated = true;
    return;
  }

  try {
    const nextPasswords = await readStoredWpPasswordMap();
    let passwordsChanged = false;

    const legacyPassword = decodeStoredSecret(store.get(WP_LEGACY_PASSWORD_STORE_KEY, ""));
    if (legacyPassword) {
      const selectedPreset = String(store.get(WP_PRESET_SELECT_STORE_KEY, "shoppnow") || "shoppnow");
      if (!nextPasswords[selectedPreset]) {
        nextPasswords[selectedPreset] = legacyPassword;
        passwordsChanged = true;
      }
    }
    store.delete(WP_LEGACY_PASSWORD_STORE_KEY);

    const rawOverrides = store.get(WP_OVERRIDES_STORE_KEY, "");
    let parsedOverrides = rawOverrides;

    if (typeof parsedOverrides === "string" && parsedOverrides.trim()) {
      try {
        parsedOverrides = JSON.parse(parsedOverrides);
      } catch {
        parsedOverrides = {};
      }
    } else if (!parsedOverrides) {
      parsedOverrides = {};
    }

    if (parsedOverrides && typeof parsedOverrides === "object") {
      const cleanedOverrides = {};

      for (const [presetKey, value] of Object.entries(parsedOverrides)) {
        if (!value || typeof value !== "object") {
          continue;
        }

        const wpUrl = String(value.wpUrl || "").trim();
        const username = String(value.username || "").trim();
        const appPassword = String(value.appPassword || "").trim();

        if (appPassword && nextPasswords[presetKey] !== appPassword) {
          nextPasswords[presetKey] = appPassword;
          passwordsChanged = true;
        }

        if (wpUrl || username) {
          cleanedOverrides[String(presetKey)] = {};
          if (wpUrl) {
            cleanedOverrides[String(presetKey)].wpUrl = wpUrl;
          }
          if (username) {
            cleanedOverrides[String(presetKey)].username = username;
          }
        }
      }

      if (Object.keys(cleanedOverrides).length) {
        store.set(WP_OVERRIDES_STORE_KEY, JSON.stringify(cleanedOverrides));
      } else {
        store.delete(WP_OVERRIDES_STORE_KEY);
      }
    }

    if (passwordsChanged) {
      await writeStoredWpPasswordMap(nextPasswords);
    }
  } finally {
    wpSecretsMigrated = true;
  }
}

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
    icon: path.join(__dirname, "ui", "webp2.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
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

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

  ipcMain.once("app-ready", () => {
    // Only show if we didn't launch hidden (from context menu)
    if (mainWindow && !mainWindow.isDestroyed() && !process.argv.some(arg => arg === "--hidden")) {
      mainWindow.show();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "ui", "webp2.ico");
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
  
  const exts = [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".avif"];
  
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
    const outputDir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const dstPath = resolveUniqueOutputPath(outputDir, baseName, "webp");

    let quality = 85;
    if (store) quality = store.get("webp-quality", 85);

    await sharp(filePath)
      .webp({ quality, effort: 6 })
      .toFile(dstPath);

    new Notification({
      title: "Konversi Selesai",
      body: `Berhasil mengubah ${path.basename(filePath)} ke WebP.`,
      icon: path.join(__dirname, "ui", "webp2.ico")
    }).show();

  } catch (err) {
    new Notification({
      title: "Konversi Gagal",
      body: `Gagal mengubah ${path.basename(filePath)}: ${err.message}`,
      icon: path.join(__dirname, "ui", "webp2.ico")
    }).show();
  }
}

ipcMain.handle("check-updates", async () => {
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

ipcMain.handle("get-system-theme", () => nativeTheme.shouldUseDarkColors);

ipcMain.handle("store-get", async (event, key, defaultValue) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (!store) return defaultValue;
  return store.get(key, defaultValue);
});

ipcMain.handle("store-set", async (event, key, value) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (!store) {
    return { ok: false, message: "Store not ready" };
  }

  if (String(key) === WP_OVERRIDES_STORE_KEY) {
    const cleanedOverrides = sanitizeWpOverrides(value);
    if (Object.keys(cleanedOverrides).length) {
      store.set(key, JSON.stringify(cleanedOverrides));
    } else {
      store.delete(key);
    }
    return { ok: true };
  }

  store.set(key, value);
  return { ok: true };
});

ipcMain.handle("store-delete", async (event, key) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (store) store.delete(key);
  return { ok: true };
});

// --- Secure WP Password Storage via safeStorage ---
ipcMain.handle("secrets:set-wp-password", async (_event, { presetKey, password }) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (!store) return { ok: false, message: "Store not ready" };

  const normalizedPresetKey = String(presetKey || "").trim();
  if (!normalizedPresetKey) {
    return { ok: false, message: "Preset key wajib diisi." };
  }

  try {
    const passwordMap = await readStoredWpPasswordMap();
    const normalizedPassword = String(password || "").trim();

    if (normalizedPassword) {
      passwordMap[normalizedPresetKey] = normalizedPassword;
    } else {
      delete passwordMap[normalizedPresetKey];
    }

    await writeStoredWpPasswordMap(passwordMap);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("secrets:get-wp-password", async (_event, { presetKey } = {}) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (!store) return "";

  const normalizedPresetKey = String(presetKey || "").trim();
  if (!normalizedPresetKey) {
    return "";
  }

  try {
    const passwordMap = await readStoredWpPasswordMap();
    return passwordMap[normalizedPresetKey] || "";
  } catch {
    return "";
  }
});

ipcMain.handle("secrets:clear-wp-password", async (_event, { presetKey } = {}) => {
  await ensureWpSecretsMigrated();
  await storeReady;
  if (!store) return { ok: false, message: "Store not ready" };

  const normalizedPresetKey = String(presetKey || "").trim();
  if (!normalizedPresetKey) {
    return { ok: false, message: "Preset key wajib diisi." };
  }

  try {
    const passwordMap = await readStoredWpPasswordMap();
    delete passwordMap[normalizedPresetKey];
    await writeStoredWpPasswordMap(passwordMap);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
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

function resolveUniqueOutputPath(outputDir, baseName, ext) {
  let target = path.join(outputDir, `${baseName}.${ext}`);
  if (!fs.existsSync(target)) {
    return target;
  }

  let index = 1;
  while (true) {
    target = path.join(outputDir, `${baseName}_${index}.${ext}`);
    if (!fs.existsSync(target)) {
      return target;
    }
    index += 1;
  }
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

ipcMain.handle("pick-image-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih File Gambar",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "bmp", "tiff", "tif", "webp", "avif", "svg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths;
});

ipcMain.handle("pick-image-folder", async () => {
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

ipcMain.handle("scan-dropped-paths", async (_event, paths) => {
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

ipcMain.handle("pick-output-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih Folder Output",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }

  return result.filePaths[0];
});

ipcMain.handle("open-output-folder", async (_event, targetPath) => {
  const resolvedPath = String(targetPath || "").trim();
  if (!resolvedPath) {
    return { ok: false, message: "Folder output belum dipilih." };
  }

  try {
    await fs.promises.access(resolvedPath);
  } catch {
    return { ok: false, message: "Folder output tidak ditemukan." };
  }

  const errorMessage = await shell.openPath(resolvedPath);
  if (errorMessage) {
    return { ok: false, message: errorMessage };
  }

  return { ok: true };
});

ipcMain.handle("show-item-in-folder", async (_event, filePath) => {
  const resolved = String(filePath || "").trim();
  if (!resolved) return;
  shell.showItemInFolder(resolved);
});

ipcMain.handle("validate-output-folder", async (_event, targetPath) => {
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

ipcMain.handle("get-file-sizes", async (_event, filePaths) => {
  const sizes = {};
  for (const filePath of filePaths) {
    sizes[filePath] = await getFileSize(filePath);
  }
  return sizes;
});

let currentJobCancelled = false;

ipcMain.handle("cancel-batch", async () => {
  currentJobCancelled = true;
  return { ok: true };
});

ipcMain.handle("convert-images", async (event, payload) => {
  currentJobCancelled = false;
  const pLimitModule = await import("p-limit");
  const pLimit = pLimitModule.default;
  const limit = pLimit(Math.max(1, os.cpus().length - 1));

  const files = normalizePayloadFiles(Array.isArray(payload?.files) ? payload.files : []);
  const outputDir = String(payload?.outputDir || "").trim();
  const quality = Math.max(1, Math.min(100, Number(payload?.quality || 85)));
  const preserveFolders = Boolean(payload?.preserveFolders);
  const format = payload?.format || "webp";

  if (!files.length) {
    return { ok: false, message: "Tidak ada file gambar yang dipilih." };
  }

  if (outputDir) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  let success = 0;
  let failed = 0;
  let totalOriginalSize = 0;
  let totalOutputSize = 0;
  const total = files.length;
  const errors = [];
  let currentIndex = 0;

  const promises = files.map((file) => limit(async () => {
    if (currentJobCancelled) return;
    const { path: srcPath, rootDir } = file;
    const baseName = path.basename(srcPath, path.extname(srcPath));
    const targetDir = resolveOutputDirectory({
      manualOutputDir: outputDir,
      preserveFolders,
      rootDir,
      sourcePath: srcPath
    });

    await fs.promises.mkdir(targetDir, { recursive: true });
    const dstPath = resolveUniqueOutputPath(targetDir, baseName, format);

    let status = "";
    let originalSize = 0;
    let newSize = 0;

    try {
      originalSize = await getFileSize(srcPath);
      totalOriginalSize += originalSize;

      let sharpInstance = sharp(srcPath);
      if (format === "webp") sharpInstance = sharpInstance.webp({ quality, effort: 6 });
      else if (format === "avif") sharpInstance = sharpInstance.avif({ quality, effort: 6 });
      else if (format === "jpeg") sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
      else if (format === "png") sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });

      await sharpInstance.toFile(dstPath);

      newSize = await getFileSize(dstPath);
      totalOutputSize += newSize;

      success += 1;
      const savedPct = originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0;
      status = `Berhasil: ${path.basename(srcPath)} (hemat ${savedPct}%)`;
    } catch (error) {
      failed += 1;
      const errMsg = error?.message || "Unknown error";
      status = `Gagal: ${path.basename(srcPath)} - ${errMsg}`;
      errors.push({ file: path.basename(srcPath), error: errMsg });
    }

    currentIndex++;
    event.sender.send("convert-progress", {
      current: currentIndex,
      total,
      success,
      failed,
      status,
      srcPath,
      convertedOk: !status.startsWith("Gagal"),
      originalSize,
      newSize,
      outputPath: dstPath,
      outputFileName: path.basename(dstPath)
    });
  }));

  await Promise.all(promises);

  const cancelled = currentJobCancelled;
  const processed = currentIndex;
  const skipped = Math.max(0, total - processed);
  const totalDelta = totalOriginalSize - totalOutputSize;
  const deltaPct = totalOriginalSize > 0 ? Math.round((Math.abs(totalDelta) / totalOriginalSize) * 100) : 0;
  const sizeMessage = totalDelta >= 0
    ? `Hemat total: ${formatBytes(totalDelta)} (${deltaPct}%)`
    : `Ukuran bertambah: ${formatBytes(Math.abs(totalDelta))} (${deltaPct}%)`;
  const summaryMessage = cancelled
    ? `Dibatalkan. Selesai diproses: ${processed}/${total}. Berhasil: ${success}, Gagal: ${failed}, Dilewati: ${skipped}. ${sizeMessage}`
    : `Selesai. Berhasil: ${success}, Gagal: ${failed}. ${sizeMessage}`;

  return {
    ok: true,
    cancelled,
    processed,
    skipped,
    message: summaryMessage,
    success,
    failed,
    total,
    totalOriginalSize,
    totalOutputSize,
    totalDelta,
    deltaPct,
    outputDir,
    errors
  };
});

ipcMain.handle("upload-to-wordpress", async (_event, payload) => {
  const { wpUrl, username, appPassword, filePath, fileName } = payload;

  if (!wpUrl || !username || !appPassword) {
    return { ok: false, message: "Kredensial WordPress belum diisi." };
  }

  const endpoint = `${wpUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media`;
  const authHeader = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");

  let fileBuffer;
  try {
    fileBuffer = await fs.promises.readFile(filePath);
  } catch (err) {
    return { ok: false, message: `Gagal membaca file: ${err.message}` };
  }

  const mimeTypes = {
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif"
  };
  const ext = path.extname(fileName).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorMsg = `HTTP ${response.status}`;
      if (response.status === 401) errorMsg = "Unauthorized — cek Username & App Password.";
      else if (response.status === 403) errorMsg = "Forbidden — cek izin/permission pengguna.";
      else if (response.status === 404) errorMsg = "REST API tidak ditemukan — cek URL WordPress.";
      else if (errorBody) {
        try { errorMsg = JSON.parse(errorBody).message || errorMsg; } catch { }
      }
      return { ok: false, message: `Upload gagal: ${errorMsg}` };
    }

    const data = await response.json();
    return {
      ok: true,
      sourceUrl: data.source_url || "",
      mediaId: data.id || 0,
      title: data.title?.rendered || fileName,
      width: data.media_details?.width || 0,
      height: data.media_details?.height || 0
    };
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { ok: false, message: "Upload timeout — server tidak merespons dalam 60 detik." };
    }
    return { ok: false, message: `Gagal menyambung ke server: ${err.message}` };
  }
});

ipcMain.handle("test-wp-connection", async (_event, payload) => {
  const { wpUrl, username, appPassword } = payload;
  const endpoint = `${wpUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media?per_page=1`;
  const authHeader = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Authorization": authHeader },
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) return { ok: true, message: "Koneksi berhasil!" };
    if (response.status === 401) return { ok: false, message: "Unauthorized — cek Username & App Password." };
    if (response.status === 403) return { ok: false, message: "Forbidden — cek izin pengguna." };
    if (response.status === 404) return { ok: false, message: "REST API tidak ditemukan — cek URL WordPress." };
    return { ok: false, message: `Server merespons HTTP ${response.status}.` };
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { ok: false, message: "Timeout — server tidak merespons." };
    }
    return { ok: false, message: `Gagal menyambung: ${err.message}` };
  }
});

ipcMain.handle("copy-to-clipboard", async (_event, text) => {
  clipboard.writeText(text);
  return { ok: true };
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
    await ensureWpSecretsMigrated();
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
