const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSystemTheme: () => ipcRenderer.invoke("get-system-theme"),
  onThemeUpdated: (callback) => {
    ipcRenderer.on("theme-updated", (_event, isDark) => callback(isDark));
  },
  getStoreValue: (key, defaultValue) => ipcRenderer.invoke("store-get", key, defaultValue),
  setStoreValue: (key, value) => ipcRenderer.invoke("store-set", key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke("store-delete", key),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  onUpdaterEvent: (callback) => {
    ipcRenderer.on("updater-event", (_event, data) => callback(data));
  },
  pickImageFiles: () => ipcRenderer.invoke("pick-image-files"),
  pickImageFolder: () => ipcRenderer.invoke("pick-image-folder"),
  pickOutputFolder: () => ipcRenderer.invoke("pick-output-folder"),
  openOutputFolder: (targetPath) => ipcRenderer.invoke("open-output-folder", targetPath),
  validateOutputFolder: (targetPath) => ipcRenderer.invoke("validate-output-folder", targetPath),
  getFileSizes: (filePaths) => ipcRenderer.invoke("get-file-sizes", filePaths),
  convertImages: (payload) => ipcRenderer.invoke("convert-images", payload),
  showItemInFolder: (filePath) => ipcRenderer.invoke("show-item-in-folder", filePath),
  signalReady: () => ipcRenderer.send("app-ready"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onConvertProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("convert-progress", listener);
    return () => ipcRenderer.removeListener("convert-progress", listener);
  },
  cancelBatch: () => ipcRenderer.invoke("cancel-batch"),
  scanDroppedPaths: (paths) => ipcRenderer.invoke("scan-dropped-paths", paths)
});
