const $ = (id) => document.getElementById(id);

const themeToggle = $("themeToggle");
const themeIcon = $("themeIcon");
const aboutBtn = $("aboutBtn");
const aboutOverlay = $("aboutOverlay");
const aboutModal = $("aboutModal");
const aboutClose = $("aboutClose");
const aboutCreatorPhoto = $("aboutCreatorPhoto");
const aboutCreatorFallback = $("aboutCreatorFallback");
const settingsBtn = $("settingsBtn");
const settingsPanel = $("settingsPanel");
const settingsOverlay = $("settingsOverlay");
const settingsClose = $("settingsClose");
const settingsOutputPath = $("settingsOutputPath");
const settingsPickOutput = $("settingsPickOutput");
const settingsLogsEmpty = $("settingsLogsEmpty");
const settingsLogsWrap = $("settingsLogsWrap");
const settingsLogsBody = $("settingsLogsBody");
const settingsClearAll = $("settingsClearAll");
const quality = $("quality");
const qualityLabel = $("qualityLabel");
const preserveFolders = $("preserveFolders");
const outputFormat = $("outputFormat");

const pickFilesBtn = $("pickFilesBtn");
const pickFolderBtn = $("pickFolderBtn");
const clearAllBtn = $("clearAllBtn");
const openOutputBtn = $("openOutputBtn");
const convertBtn = $("convertBtn");
const dropzone = $("dropzone");
const fileCountEl = $("fileCount");
const fileList = $("fileList");
const progressWrap = $("progressWrap");
const progressFill = $("progressFill");
const progressText = $("progressText");
const progressPct = $("progressPct");
const statusEl = $("status");

const previewOverlay = $("previewOverlay");
const previewModal = $("previewModal");
const previewName = $("previewName");
const previewMeta = $("previewMeta");
const previewImage = $("previewImage");
const previewEmpty = $("previewEmpty");
const previewEmptyText = $("previewEmptyText");
const previewClose = $("previewClose");
const previewPrev = $("previewPrev");
const previewNext = $("previewNext");

const STORAGE_KEYS = {
  theme: "image-to-webp-theme",
  outputDir: "image-to-webp-output-dir",
  quality: "image-to-webp-quality",
  preserveFolders: "image-to-webp-preserve-folders"
};

const IMAGE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".bmp",
  ".tiff", ".tif", ".webp", ".avif", ".svg"
];

const PREVIEWABLE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp",
  ".webp", ".avif", ".svg"
]);

let selectedFiles = [];
let outputDir = "";
let isConverting = false;
let previewIndex = -1;
let nextFileId = 1;
let dragCounter = 0;

const conversionLogs = [];

const dropOverlay = $("dropOverlay");

function iconMarkup(name, extraClass = "") {
  const markup = window.APP_ICONS?.[name] || "";
  if (!markup || !extraClass) return markup;
  return markup.replace('class="svg-inline--fa', `class="svg-inline--fa ${extraClass}`);
}

function hydrateStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const iconName = el.dataset.icon;
    el.innerHTML = iconMarkup(iconName);
  });
}

function getExtension(filePath) {
  return filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.includes(getExtension(filePath));
}

function canPreviewFile(filePath) {
  return PREVIEWABLE_EXTENSIONS.has(getExtension(filePath));
}

function normalizePathKey(filePath) {
  return String(filePath || "").trim().toLowerCase();
}

function basename(filePath) {
  return String(filePath || "").split(/[/\\]/).pop() || filePath;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${parseFloat(value.toFixed(1))} ${units[exponent]}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/");
  const withDrive = normalized.replace(/^([A-Za-z]):/, "/$1:");
  return encodeURI(`file://${withDrive}`);
}

function isDialogOpen() {
  return aboutModal.classList.contains("open")
    || settingsPanel.classList.contains("open")
    || previewModal.classList.contains("open");
}

function isEditableTarget(target) {
  if (!target) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.innerHTML = theme === "dark" ? iconMarkup("sun") : iconMarkup("moon");
  window.electronAPI.setStoreValue(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function openSettings() {
  closeAbout();
  settingsPanel.classList.add("open");
  settingsOverlay.classList.add("open");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsOverlay.classList.remove("open");
}

function openAbout() {
  closeSettings();
  closePreview();
  aboutOverlay.classList.add("open");
  aboutModal.classList.add("open");
  aboutModal.setAttribute("aria-hidden", "false");
}

function closeAbout() {
  aboutOverlay.classList.remove("open");
  aboutModal.classList.remove("open");
  aboutModal.setAttribute("aria-hidden", "true");
}

function syncAboutCreatorPhoto() {
  const hasLoadedPhoto = aboutCreatorPhoto.complete && aboutCreatorPhoto.naturalWidth > 0;
  aboutCreatorPhoto.classList.toggle("loaded", hasLoadedPhoto);
  aboutCreatorFallback.hidden = hasLoadedPhoto;
}

function openPreview(index) {
  if (index < 0 || index >= selectedFiles.length) return;
  closeSettings();
  closeAbout();
  previewIndex = index;
  previewOverlay.classList.add("open");
  previewModal.classList.add("open");
  previewModal.setAttribute("aria-hidden", "false");
  renderPreview();
}

function closePreview() {
  previewIndex = -1;
  previewOverlay.classList.remove("open");
  previewModal.classList.remove("open");
  previewModal.setAttribute("aria-hidden", "true");
  previewImage.classList.remove("visible");
  previewImage.removeAttribute("src");
}

function updateFileCount() {
  fileCountEl.innerHTML = `File: <strong>${selectedFiles.length}</strong>`;
}

function updateOutputUI() {
  settingsOutputPath.textContent = outputDir || "Default: folder asal gambar";
  settingsOutputPath.title = outputDir || "";
  openOutputBtn.hidden = !outputDir;
}

function updateControls() {
  const hasFiles = selectedFiles.length > 0;
  const unconvertedCount = selectedFiles.filter((f) => !f.converted).length;
  pickFilesBtn.disabled = isConverting;
  pickFolderBtn.disabled = isConverting;
  clearAllBtn.disabled = isConverting || !hasFiles;
  settingsClearAll.disabled = isConverting || !hasFiles;
  settingsPickOutput.disabled = isConverting;
  quality.disabled = isConverting;
  preserveFolders.disabled = isConverting;
  openOutputBtn.disabled = !outputDir;
  convertBtn.disabled = isConverting || !hasFiles || unconvertedCount === 0;
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}

function showProgress(visible) {
  progressWrap.classList.toggle("visible", visible);
}

function setProgress(current, total) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressText.textContent = `${current} / ${total || 0}`;
  progressPct.textContent = `${pct}%`;
}

function renderFileList() {
  fileList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const file of selectedFiles) {
    const item = document.createElement("div");
    item.className = `file-item${file.converted ? " file-item--converted" : ""}`;
    item.dataset.fileId = String(file.id);
    item.title = file.path;

    const convertedIcon = file.converted
      ? `<span class="f-converted-icon" title="Sudah dikonversi">${iconMarkup("circleCheck")}</span>`
      : "";

    item.innerHTML = `
      <div class="file-main">
        <span class="icon-slot">${iconMarkup("fileImage")}</span>
        <span class="f-name">${file.name}</span>
        ${convertedIcon}
      </div>
      <span class="f-size">${formatBytes(file.size)}</span>
      <div class="f-actions">
        <button class="f-action" data-action="preview" data-id="${file.id}" title="Preview file">
          ${iconMarkup("eye")}
        </button>
        <button class="f-action folder" data-action="openfolder" data-id="${file.id}" title="Buka lokasi file">
          ${iconMarkup("folderOpen")}
        </button>
        <button class="f-action danger" data-action="remove" data-id="${file.id}" title="Hapus file" ${isConverting ? "disabled" : ""}>
          ${iconMarkup("xmark")}
        </button>
      </div>
    `;
    fragment.appendChild(item);
  }

  fileList.appendChild(fragment);
}

function renderPreview() {
  if (previewIndex < 0 || previewIndex >= selectedFiles.length) {
    closePreview();
    return;
  }

  const file = selectedFiles[previewIndex];
  previewName.textContent = file.name;
  previewMeta.textContent = `${formatBytes(file.size)} | ${file.path}`;
  previewPrev.disabled = previewIndex === 0;
  previewNext.disabled = previewIndex === selectedFiles.length - 1;
  previewImage.classList.remove("visible");
  previewImage.removeAttribute("src");

  if (!canPreviewFile(file.path)) {
    previewEmpty.hidden = false;
    previewEmptyText.textContent = "Preview tidak tersedia untuk format ini.";
    return;
  }

  previewEmpty.hidden = false;
  previewEmptyText.textContent = "Memuat preview...";
  previewImage.src = toFileUrl(file.path);
}

function renderLogs() {
  if (conversionLogs.length === 0) {
    settingsLogsEmpty.hidden = false;
    settingsLogsWrap.hidden = true;
    return;
  }

  settingsLogsEmpty.hidden = true;
  settingsLogsWrap.hidden = false;

  settingsLogsBody.innerHTML = conversionLogs
    .map((log) => {
      const timeStr = log.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const statusHtml = log.success
        ? `<span class="log-status success" title="${log.sizeInfo || ''}">${iconMarkup("circleCheck")} Berhasil ${log.sizeInfo ? '(' + log.sizeInfo + ')' : ''}</span>`
        : `<span class="log-status error" title="${log.error || 'Gagal'}">${iconMarkup("xmark")} Gagal</span>`;

      return `
        <tr>
          <td>${timeStr}</td>
          <td class="log-file" title="${log.file}">${log.file}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    })
    .join("");
}

function addLogEntry(file, success, error, sizeInfo) {
  conversionLogs.unshift({
    time: new Date(),
    file,
    success,
    error,
    sizeInfo
  });
  renderLogs();
}

function removeFileById(id) {
  if (isConverting) return;
  const index = selectedFiles.findIndex((file) => file.id === id);
  if (index === -1) return;

  selectedFiles.splice(index, 1);
  updateFileCount();
  updateControls();
  renderFileList();

  if (previewIndex !== -1) {
    if (!selectedFiles.length) {
      closePreview();
    } else {
      if (index < previewIndex) previewIndex -= 1;
      if (previewIndex >= selectedFiles.length) previewIndex = selectedFiles.length - 1;
      renderPreview();
    }
  }
}

function clearAll() {
  if (isConverting) return;
  selectedFiles = [];
  updateFileCount();
  updateControls();
  renderFileList();
  showProgress(false);
  setProgress(0, 0);
  closePreview();
  setStatus("Semua file dihapus.");
}

async function addFiles(inputEntries) {
  const incoming = inputEntries
    .map((entry) => {
      if (typeof entry === "string") {
        return { path: entry, rootDir: "" };
      }
      return {
        path: String(entry?.path || ""),
        rootDir: String(entry?.rootDir || "")
      };
    })
    .filter((entry) => entry.path);

  const valid = incoming.filter((entry) => isImageFile(entry.path));
  const invalidCount = incoming.length - valid.length;
  const existing = new Set(selectedFiles.map((file) => normalizePathKey(file.path)));
  const batchSeen = new Set();
  const added = [];
  let duplicateCount = 0;

  for (const entry of valid) {
    const key = normalizePathKey(entry.path);
    if (!key || existing.has(key) || batchSeen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    batchSeen.add(key);
    added.push({
      id: nextFileId++,
      name: basename(entry.path),
      path: entry.path,
      rootDir: entry.rootDir,
      size: 0,
      converted: false
    });
  }

  if (!added.length) {
    if (duplicateCount) {
      setStatus(`${duplicateCount} file duplikat diabaikan.`, "warning");
    } else {
      setStatus("Tidak ada file gambar yang valid.", "error");
    }
    return;
  }

  try {
    const sizes = await window.electronAPI.getFileSizes(added.map((file) => file.path));
    for (const file of added) {
      file.size = sizes[file.path] || 0;
    }
  } catch {
    // Ignore file size errors and keep UI responsive.
  }

  selectedFiles = [...selectedFiles, ...added];
  updateFileCount();
  updateControls();
  renderFileList();

  const parts = [`${added.length} file ditambahkan.`];
  if (duplicateCount) parts.push(`${duplicateCount} duplikat diabaikan.`);
  if (invalidCount) parts.push(`${invalidCount} file tidak didukung.`);
  setStatus(parts.join(" "), duplicateCount || invalidCount ? "warning" : "success");
}

async function pickFiles() {
  const files = await window.electronAPI.pickImageFiles();
  if (files.length) await addFiles(files);
}

async function pickFolder() {
  const result = await window.electronAPI.pickImageFolder();
  const files = Array.isArray(result?.files) ? result.files : [];
  const rootDir = String(result?.rootDir || "");
  if (!files.length) {
    setStatus("Folder tidak berisi gambar.", "error");
    return;
  }
  await addFiles(files.map((filePath) => ({ path: filePath, rootDir })));
}

async function chooseOutputFolder() {
  const folder = await window.electronAPI.pickOutputFolder();
  if (!folder) return;
  outputDir = folder;
  window.electronAPI.setStoreValue(STORAGE_KEYS.outputDir, outputDir);
  updateOutputUI();
  updateControls();
  setStatus("Folder output dipilih.", "success");
}

async function openOutputFolder() {
  if (!outputDir) {
    setStatus("Folder output belum dipilih.", "error");
    return;
  }
  const result = await window.electronAPI.openOutputFolder(outputDir);
  if (!result?.ok) {
    setStatus(result?.message || "Gagal membuka folder output.", "error");
    return;
  }
  setStatus("Folder output dibuka.");
}

async function validateStoredOutputDir() {
  if (!outputDir) return;

  try {
    const result = await window.electronAPI.validateOutputFolder(outputDir);
    if (result?.ok) {
      return;
    }
  } catch {
    // Fall through to reset invalid stored folder.
  }

  outputDir = "";
  window.electronAPI.deleteStoreValue(STORAGE_KEYS.outputDir);
  updateOutputUI();
  updateControls();
  setStatus("Folder output tersimpan tidak valid. Aplikasi kembali ke folder asal gambar.", "warning");
}

async function startConversion() {
  const filesToConvert = selectedFiles.filter((f) => !f.converted);

  if (!filesToConvert.length) {
    if (selectedFiles.length) {
      setStatus("Semua file sudah dikonversi.", "warning");
    } else {
      setStatus("Pilih minimal satu file gambar.", "error");
    }
    return;
  }

  isConverting = true;
  updateControls();
  renderFileList();
  setProgress(0, filesToConvert.length);
  showProgress(true);
  setStatus(
    outputDir ? "Mulai konversi ke folder output..." : "Mulai konversi ke folder asal gambar...",
    "processing"
  );

  try {
    const result = await window.electronAPI.convertImages({
      files: filesToConvert.map((file) => ({ path: file.path, rootDir: file.rootDir })),
      outputDir,
      quality: Number(quality.value),
      preserveFolders: preserveFolders.checked,
      format: outputFormat.value
    });

    if (!result.ok) {
      setStatus(result.message || "Konversi gagal.", "error");
    } else {
      setProgress(result.total || filesToConvert.length, result.total || filesToConvert.length);
      setStatus(result.message, result.failed ? "warning" : "success");
    }
  } catch (error) {
    setStatus(error?.message || "Terjadi kesalahan.", "error");
  } finally {
    isConverting = false;
    updateControls();
    renderFileList();
  }
}

async function initializeFromStorage() {
  hydrateStaticIcons();

  const savedTheme = await window.electronAPI.getStoreValue(STORAGE_KEYS.theme);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const isSystemDark = await window.electronAPI.getSystemTheme();
    applyTheme(isSystemDark ? "dark" : "light");
  }

  window.electronAPI.onThemeUpdated((isSystemDark) => {
    applyTheme(isSystemDark ? "dark" : "light");
  });

  syncAboutCreatorPhoto();

  outputDir = (await window.electronAPI.getStoreValue(STORAGE_KEYS.outputDir)) || "";

  const savedQuality = await window.electronAPI.getStoreValue(STORAGE_KEYS.quality);
  quality.value = String(clamp(Number(savedQuality || 85), 1, 100));
  qualityLabel.textContent = `${quality.value}%`;

  const savedPreserve = await window.electronAPI.getStoreValue(STORAGE_KEYS.preserveFolders);
  preserveFolders.checked = savedPreserve === null ? true : savedPreserve === true || savedPreserve === "true";

  const savedFormat = await window.electronAPI.getStoreValue("OUTPUT_FORMAT");
  if (savedFormat) {
    outputFormat.value = savedFormat;
  }

  updateOutputUI();
  updateFileCount();
  updateControls();
  renderFileList();
  await validateStoredOutputDir();
}

themeToggle.addEventListener("click", toggleTheme);
aboutBtn.addEventListener("click", openAbout);
aboutClose.addEventListener("click", closeAbout);
aboutOverlay.addEventListener("click", closeAbout);
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

settingsPickOutput.addEventListener("click", chooseOutputFolder);
quality.addEventListener("input", () => {
  qualityLabel.textContent = `${quality.value}%`;
  window.electronAPI.setStoreValue(STORAGE_KEYS.quality, quality.value);
});
preserveFolders.addEventListener("change", () => {
  window.electronAPI.setStoreValue(STORAGE_KEYS.preserveFolders, preserveFolders.checked);
});
outputFormat.addEventListener("change", () => {
  window.electronAPI.setStoreValue("OUTPUT_FORMAT", outputFormat.value);
});
settingsClearAll.addEventListener("click", () => {
  clearAll();
  closeSettings();
});

pickFilesBtn.addEventListener("click", pickFiles);
pickFolderBtn.addEventListener("click", pickFolder);
clearAllBtn.addEventListener("click", clearAll);
openOutputBtn.addEventListener("click", openOutputFolder);
convertBtn.addEventListener("click", startConversion);

fileList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (actionButton) {
    const id = Number(actionButton.dataset.id);
    const action = actionButton.dataset.action;
    if (action === "remove") removeFileById(id);
    if (action === "preview") {
      const index = selectedFiles.findIndex((file) => file.id === id);
      if (index !== -1) openPreview(index);
    }
    if (action === "openfolder") {
      const file = selectedFiles.find((f) => f.id === id);
      if (file) window.electronAPI.showItemInFolder(file.path);
    }
    return;
  }

  const item = event.target.closest(".file-item");
  if (!item) return;
  const id = Number(item.dataset.fileId);
  const index = selectedFiles.findIndex((file) => file.id === id);
  if (index !== -1) openPreview(index);
});

previewOverlay.addEventListener("click", closePreview);
previewClose.addEventListener("click", closePreview);
previewPrev.addEventListener("click", () => {
  if (previewIndex > 0) {
    previewIndex -= 1;
    renderPreview();
  }
});
previewNext.addEventListener("click", () => {
  if (previewIndex < selectedFiles.length - 1) {
    previewIndex += 1;
    renderPreview();
  }
});

previewImage.addEventListener("load", () => {
  const file = selectedFiles[previewIndex];
  if (!file) return;
  previewImage.classList.add("visible");
  previewEmpty.hidden = true;
  const dimension = previewImage.naturalWidth && previewImage.naturalHeight
    ? ` | ${previewImage.naturalWidth} x ${previewImage.naturalHeight}`
    : "";
  previewMeta.textContent = `${formatBytes(file.size)}${dimension} | ${file.path}`;
});

previewImage.addEventListener("error", () => {
  const file = selectedFiles[previewIndex];
  previewImage.classList.remove("visible");
  previewImage.removeAttribute("src");
  previewEmpty.hidden = false;
  previewEmptyText.textContent = "Preview tidak tersedia untuk format ini.";
  if (file) {
    previewMeta.textContent = `${formatBytes(file.size)} | ${file.path}`;
  }
});

aboutCreatorPhoto.addEventListener("load", () => {
  syncAboutCreatorPhoto();
});

aboutCreatorPhoto.addEventListener("error", () => {
  syncAboutCreatorPhoto();
});

window.electronAPI.onConvertProgress((data) => {
  setProgress(data.current, data.total);
  setStatus(data.status || "Memproses...", "processing");

  if (data.srcPath) {
    const key = normalizePathKey(data.srcPath);
    const file = selectedFiles.find((f) => normalizePathKey(f.path) === key);

    // Process successful conversion
    if (data.convertedOk) {
      if (file) {
        file.converted = true;
        const itemEl = fileList.querySelector(`[data-file-id="${file.id}"]`);
        if (itemEl) {
          itemEl.classList.add("file-item--converted");
          const mainEl = itemEl.querySelector(".file-main");
          if (mainEl && !mainEl.querySelector(".f-converted-icon")) {
            const span = document.createElement("span");
            span.className = "f-converted-icon";
            span.title = "Sudah dikonversi";
            span.innerHTML = iconMarkup("circleCheck");
            mainEl.appendChild(span);
          }
        }
      }

      const savedBytes = (data.originalSize || 0) - (data.newSize || 0);
      const pct = data.originalSize ? Math.round((savedBytes / data.originalSize) * 100) : 0;
      const sizeInfo = savedBytes >= 0 ? `hemat ${pct}%` : `tambah ${Math.abs(pct)}%`;
      addLogEntry(basename(data.srcPath), true, null, sizeInfo);
    }
    // Process failed conversion
    else if (data.status && data.status.startsWith("Gagal")) {
      const errorMsg = data.status.split(" - ")[1] || "Error tidak diketahui";
      addLogEntry(basename(data.srcPath), false, errorMsg);
    }
  }
});

document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragCounter++;
  if (dragCounter === 1) {
    dropOverlay.classList.add("active");
    dropzone.classList.add("active");
  }
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.remove("active");
    dropzone.classList.remove("active");
  }
});

document.addEventListener("drop", async (event) => {
  event.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove("active");
  dropzone.classList.remove("active");

  const files = event.dataTransfer?.files;
  if (!files || !files.length) return;

  const paths = [];
  for (const file of files) {
    try {
      const filePath = window.electronAPI.getPathForFile(file);
      if (filePath) paths.push(filePath);
    } catch {
      if (file.path) paths.push(file.path);
    }
  }

  await addFiles(paths);
});

document.addEventListener("keydown", (event) => {
  const accel = event.ctrlKey || event.metaKey;
  if (aboutModal.classList.contains("open") && event.key === "Escape") {
    event.preventDefault();
    closeAbout();
    return;
  }

  if (previewModal.classList.contains("open")) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePreview();
      return;
    }
    if (event.key === "ArrowLeft" && previewIndex > 0) {
      event.preventDefault();
      previewIndex -= 1;
      renderPreview();
      return;
    }
    if (event.key === "ArrowRight" && previewIndex < selectedFiles.length - 1) {
      event.preventDefault();
      previewIndex += 1;
      renderPreview();
      return;
    }
  }

  if (settingsPanel.classList.contains("open") && event.key === "Escape") {
    event.preventDefault();
    closeSettings();
    return;
  }

  if (accel && event.key.toLowerCase() === "o" && event.shiftKey) {
    event.preventDefault();
    if (!isConverting) pickFolder();
    return;
  }

  if (accel && event.key.toLowerCase() === "o") {
    event.preventDefault();
    if (!isConverting) pickFiles();
    return;
  }

  if (accel && event.key === "Enter") {
    event.preventDefault();
    if (!convertBtn.disabled) startConversion();
    return;
  }

  if (event.key === "Delete" && !isDialogOpen() && !isEditableTarget(event.target) && selectedFiles.length) {
    event.preventDefault();
    clearAll();
  }
});

(async () => {
  await initializeFromStorage();
  requestAnimationFrame(() => {
    window.electronAPI.signalReady();
  });
})();
