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
const settingsTabTitle = $("settingsTabTitle");
const quality = $("quality");
const qualityLabel = $("qualityLabel");
const preserveFolders = $("preserveFolders");
const outputFormat = $("outputFormat");
const formatChoices = document.querySelectorAll('input[name="output-format"]');
const btnList = $("btnList");
const btnGrid = $("btnGrid");
const totalSizeEl = $("totalSize");
const quickOutputPath = $("quickOutputPath");
const quickOutputBtn = $("quickOutputBtn");

const pickFilesBtn = $("pickFilesBtn");
const pickFolderBtn = $("pickFolderBtn");
const clearAllBtn = $("clearAllBtn");
const openOutputBtn = $("openOutputBtn");
const convertBtn = $("convertBtn");
const cancelConvertBtn = $("cancelConvertBtn");
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
  preserveFolders: "image-to-webp-preserve-folders",
  outputFormat: "image-to-webp-output-format"
};

const IMAGE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif",
  ".tiff", ".tif", ".webp", ".avif", ".svg"
];

const PREVIEWABLE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif",
  ".webp", ".avif", ".svg"
]);

let selectedFiles = [];
let outputDir = "";
let lastOutputPath = "";
let isConverting = false;
let previewIndex = -1;
let nextFileId = 1;
let dragCounter = 0;
let currentView = "list";

const conversionLogs = [];

const dropOverlay = $("dropOverlay");
const toastEl = $("toast");

let toastTimer = null;

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

function getFileType(filePath) {
  return getExtension(filePath).replace(".", "").toUpperCase() || "FILE";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
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

function syncDialogInert() {
  document.querySelector("main").inert = isDialogOpen();
}

function isEditableTarget(target) {
  if (!target) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function updateThemeIcon() {
  const pref = document.documentElement.getAttribute("data-theme-preference") || "system";
  if (pref === "system") {
    themeIcon.innerHTML = iconMarkup("circleHalfStroke"); // System theme icon
    themeToggle.dataset.tooltip = "Mode Tema: System (Mengikuti OS)";
    return;
  }
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  themeIcon.innerHTML = iconMarkup(isDark ? "moon" : "sun");
  themeToggle.dataset.tooltip = pref === "dark" ? "Mode Tema: Dark Mode" : "Mode Tema: Light Mode";
}

async function applyTheme(pref) {
  document.documentElement.setAttribute("data-theme-preference", pref);
  window.electronAPI.setStoreValue(STORAGE_KEYS.theme, pref);

  if (pref === "system") {
    const isDark = await window.electronAPI.getSystemTheme();
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
  updateThemeIcon();
}

function toggleTheme() {
  const currentPref = document.documentElement.getAttribute("data-theme-preference") || "system";
  if (currentPref === "system") applyTheme("light");
  else if (currentPref === "light") applyTheme("dark");
  else applyTheme("system");
}

function openSettings() {
  closeAbout();
  closePreview();
  settingsPanel.classList.add("open");
  settingsOverlay.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
  syncDialogInert();
  settingsClose.focus();
}

function closeSettings() {
  const wasOpen = settingsPanel.classList.contains("open");
  settingsPanel.classList.remove("open");
  settingsOverlay.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
  syncDialogInert();
  if (wasOpen) settingsBtn.focus();
}

function switchSettingsTab(tabName) {
  // Update sidebar nav
  settingsPanel.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  // Update pages
  settingsPanel.querySelectorAll(".settings-page").forEach(page => {
    page.classList.toggle("active", page.dataset.page === tabName);
  });
  // Update title
  const titles = { general: "General", output: "Output", logs: "Logs" };
  if (settingsTabTitle) settingsTabTitle.textContent = titles[tabName] || tabName;
}

function openAbout() {
  closeSettings();
  closePreview();
  aboutOverlay.classList.add("open");
  aboutModal.classList.add("open");
  aboutModal.setAttribute("aria-hidden", "false");
  syncDialogInert();
  aboutClose.focus();
}

function closeAbout() {
  const wasOpen = aboutModal.classList.contains("open");
  aboutOverlay.classList.remove("open");
  aboutModal.classList.remove("open");
  aboutModal.setAttribute("aria-hidden", "true");
  syncDialogInert();
  if (wasOpen) aboutBtn.focus();
}

function syncAboutCreatorPhoto() {
  const hasLoadedPhoto = aboutCreatorPhoto.complete && aboutCreatorPhoto.naturalWidth > 0;
  aboutCreatorPhoto.classList.toggle("loaded", hasLoadedPhoto);
  aboutCreatorFallback.hidden = hasLoadedPhoto;
}

let previewReturnFocus = null;

function openPreview(index) {
  if (index < 0 || index >= selectedFiles.length) return;
  closeSettings();
  closeAbout();
  previewReturnFocus = document.activeElement;
  previewIndex = index;
  previewOverlay.classList.add("open");
  previewModal.classList.add("open");
  previewModal.setAttribute("aria-hidden", "false");
  syncDialogInert();
  previewClose.focus();
  renderPreview();
}

function closePreview() {
  const wasOpen = previewModal.classList.contains("open");
  previewIndex = -1;
  previewOverlay.classList.remove("open");
  previewModal.classList.remove("open");
  previewModal.setAttribute("aria-hidden", "true");
  syncDialogInert();
  if (wasOpen && previewReturnFocus?.isConnected) previewReturnFocus.focus();
  previewImage.classList.remove("visible");
  previewImage.removeAttribute("src");
}

function updateFileCount() {
  fileCountEl.innerHTML = `<strong>${selectedFiles.length}</strong> gambar dalam antrean`;
  document.querySelector(".queue-panel").classList.toggle("has-files", selectedFiles.length > 0);
}

function updateTotalSize() {
  const totalBytes = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  totalSizeEl.textContent = formatBytes(totalBytes);
}

function updateViewButtons() {
  btnList.classList.toggle("icon-btn--active", currentView === "list");
  btnGrid.classList.toggle("icon-btn--active", currentView === "grid");
  btnList.setAttribute("aria-pressed", String(currentView === "list"));
  btnGrid.setAttribute("aria-pressed", String(currentView === "grid"));
}

function setView(view) {
  if (view !== "list" && view !== "grid") return;
  if (currentView === view) return;
  currentView = view;
  updateViewButtons();
  renderFileList();
}

function updateOutputUI() {
  const outputText = outputDir || "Folder asal gambar";
  settingsOutputPath.textContent = outputText;
  settingsOutputPath.title = outputDir || "";
  if (quickOutputPath) {
    quickOutputPath.textContent = outputText;
    quickOutputPath.title = outputDir || "";
  }
  openOutputBtn.hidden = false;
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
  outputFormat.disabled = isConverting;
  formatChoices.forEach(choice => { choice.disabled = isConverting; });
  dropzone.disabled = isConverting;
  if (quickOutputBtn) quickOutputBtn.disabled = isConverting;
  preserveFolders.disabled = isConverting;
  openOutputBtn.disabled = !outputDir && !lastOutputPath;
  convertBtn.disabled = isConverting || !hasFiles || unconvertedCount === 0;

  if (isConverting) {
    convertBtn.style.display = "none";
    if (cancelConvertBtn) cancelConvertBtn.style.display = "inline-flex";
  } else {
    convertBtn.style.display = "inline-flex";
    if (cancelConvertBtn) cancelConvertBtn.style.display = "none";
  }
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.title = message;
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

function showToast(messageHtml, type = "", duration = 3500) {
  clearTimeout(toastTimer);
  toastEl.innerHTML = messageHtml;
  toastEl.className = "toast show" + (type ? " " + type : "");
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, duration);
  }
}

function renderFileList() {
  fileList.className = currentView === "grid" ? "file-list file-list--grid" : "file-list file-list--list";
  fileList.innerHTML = "";

  if (!selectedFiles.length) {
    fileList.innerHTML = `
      <div class="file-empty">
        <span class="file-empty-icon">${iconMarkup("cloudArrowUp")}</span>
        <p class="file-empty-title">Antrean masih kosong.</p>
        <p class="file-empty-copy">Tambahkan gambar dari panel kiri. File Anda akan muncul di sini, siap untuk dikonversi.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const file of selectedFiles) {
    const item = document.createElement("div");
    const type = getFileType(file.path);
    const badgeClass = `is-${type.toLowerCase()}`;
    const safeName = escapeHtml(file.name);
    const safePath = escapeHtml(file.path);
    const thumbMarkup = canPreviewFile(file.path)
      ? `<img class="${currentView === "grid" ? "f-grid-image" : "f-thumb-image"}" data-src="${escapeHtml(toFileUrl(file.path))}" alt="">`
      : `<span class="${currentView === "grid" ? "f-grid-fallback" : "f-thumb-fallback"}">${iconMarkup("fileImage")}</span>`;
    const convertedIcon = file.converted
      ? `<span class="f-converted-icon" data-tooltip="Sudah dikonversi">${iconMarkup("circleCheck")}</span>`
      : "";
    const removeDisabled = isConverting ? "disabled" : "";

    item.className = `file-item file-item--${currentView}${file.converted ? " file-item--converted" : ""}`;
    item.dataset.fileId = String(file.id);
    item.title = file.path;

    if (currentView === "grid") {
      item.innerHTML = `
        <div class="f-grid-visual">
          ${thumbMarkup}
          <span class="f-grid-type ${badgeClass}">${escapeHtml(type)}</span>
          <div class="grid-actions">
            <button class="f-action" data-action="preview" data-id="${file.id}" data-tooltip="Preview file">
              ${iconMarkup("eye")}
            </button>
            <button class="f-action folder" data-action="openfolder" data-id="${file.id}" data-tooltip="Buka lokasi file">
              ${iconMarkup("folderOpen")}
            </button>
            <button class="f-action danger" data-action="remove" data-id="${file.id}" data-tooltip="Hapus file" ${removeDisabled}>
              ${iconMarkup("xmark")}
            </button>
          </div>
        </div>
        <div class="grid-copy">
          <div class="grid-title-row">
            <span class="f-name">${safeName}</span>
            ${convertedIcon}
          </div>
          <div class="grid-meta">
            <span class="f-size">${formatBytes(file.size)}</span>
          </div>
        </div>
      `;
    } else {
      item.innerHTML = `
        <div class="file-main">
          <div class="f-thumb">${thumbMarkup}</div>
          <div class="f-copy">
            <div class="f-title-row">
              <span class="f-name">${safeName}</span>
              ${convertedIcon}
            </div>
            <div class="f-meta">
              <span class="f-type-badge ${badgeClass}">${escapeHtml(type)}</span>
              <span class="f-size">${formatBytes(file.size)}</span>
            </div>
            <div class="f-path">${safePath}</div>
          </div>
        </div>
        <div class="f-actions">
          <button class="f-action" data-action="preview" data-id="${file.id}" data-tooltip="Preview file">
            ${iconMarkup("eye")}
          </button>
          <button class="f-action folder" data-action="openfolder" data-id="${file.id}" data-tooltip="Buka lokasi file">
            ${iconMarkup("folderOpen")}
          </button>
          <button class="f-action danger" data-action="remove" data-id="${file.id}" data-tooltip="Hapus file" ${removeDisabled}>
            ${iconMarkup("xmark")}
          </button>
        </div>
      `;
    }

    item.querySelectorAll('button[data-tooltip]').forEach(button => {
      button.setAttribute("aria-label", button.dataset.tooltip);
    });
    fragment.appendChild(item);
  }

  fileList.appendChild(fragment);
  initLazyLoading();
}

let lazyLoadObserver = null;

function initLazyLoading() {
  const images = fileList.querySelectorAll("img[data-src]");
  if (!images.length) return;

  if (!lazyLoadObserver) {
    lazyLoadObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (!src) return;

          const tempImage = new Image();
          tempImage.src = src;

          tempImage.decode()
            .then(() => {
              img.src = src;
              requestAnimationFrame(() => {
                img.classList.add("loaded");
              });
            })
            .catch(() => {
              img.src = src;
              requestAnimationFrame(() => {
                img.classList.add("loaded");
              });
            });

          obs.unobserve(img);
          img.removeAttribute("data-src");
        }
      });
    }, {
      root: document.querySelector('.queue-body'),
      rootMargin: "250px", // Pre-load slightly more aggressively
      threshold: 0.01 // Trigger as soon as 1% is in the margin
    });
  }

  images.forEach(img => lazyLoadObserver.observe(img));
}

function updateFileItemById(id) {
  const file = selectedFiles.find(f => f.id === id);
  if (!file) return;
  const item = document.querySelector(`.file-item[data-file-id="${id}"]`);
  if (!item) return;

  if (file.converted && !item.classList.contains("file-item--converted")) {
    item.classList.add("file-item--converted");
    const checkIconHtml = `<span class="f-converted-icon" data-tooltip="Sudah dikonversi">${iconMarkup("circleCheck")}</span>`;

    const listTitleRow = item.querySelector(".f-copy .f-title-row");
    if (listTitleRow && !listTitleRow.querySelector(".f-converted-icon")) {
      listTitleRow.insertAdjacentHTML('beforeend', checkIconHtml);
    }

    const gridTitleRow = item.querySelector(".grid-copy .grid-title-row");
    if (gridTitleRow && !gridTitleRow.querySelector(".f-converted-icon")) {
      gridTitleRow.insertAdjacentHTML('beforeend', checkIconHtml);
    }
  }

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

function createLogRow(log) {
  const row = document.createElement("tr");
  const time = document.createElement("td");
  time.textContent = log.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const file = document.createElement("td");
  file.className = "log-file";
  file.title = log.file;
  file.textContent = log.file;
  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  status.className = log.success ? "log-status success" : "log-status error";
  status.title = log.success ? (log.sizeInfo || "") : (log.error || "Gagal");
  status.textContent = log.success ? `Berhasil${log.sizeInfo ? " (" + log.sizeInfo + ")" : ""}` : "Gagal";
  statusCell.append(status);
  row.append(time, file, statusCell);
  return row;
}

function addLogEntry(file, success, error, sizeInfo) {
  const log = { time: new Date(), file, success, error, sizeInfo };
  conversionLogs.unshift(log);
  settingsLogsEmpty.hidden = true;
  settingsLogsWrap.hidden = false;
  settingsLogsBody.prepend(createLogRow(log));
}

function removeFileById(id) {
  if (isConverting) return;
  const index = selectedFiles.findIndex((file) => file.id === id);
  if (index === -1) return;

  selectedFiles.splice(index, 1);
  updateFileCount();
  updateTotalSize();
  updateControls();
  renderFileList();
  showToast(`${iconMarkup("trash")} File dihapus dari antrean.`, "success", 2000);

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
  updateTotalSize();
  updateControls();
  renderFileList();
  showProgress(false);
  setProgress(0, 0);
  closePreview();
  setStatus("Semua file dihapus.");
  showToast(`${iconMarkup("trash")} Antrean berhasil dibersihkan.`, "success");
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

  setStatus("Memuat ukuran file...", "processing");
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
  updateTotalSize();
  updateControls();
  renderFileList();

  const parts = [`${added.length} file ditambahkan.`];
  if (duplicateCount) parts.push(`${duplicateCount} duplikat diabaikan.`);
  if (invalidCount) parts.push(`${invalidCount} file tidak didukung.`);
  setStatus(parts.join(" "), duplicateCount || invalidCount ? "warning" : "success");
  showToast(`${iconMarkup("circleCheck")} ${added.length} file ditambahkan.`, "success");
}

async function pickFiles() {
  const files = await window.electronAPI.pickImageFiles();
  if (files.length) await addFiles(files);
}

async function pickFolder() {
  const result = await window.electronAPI.pickImageFolder();
  if (result?.canceled) {
    return;
  }
  const files = Array.isArray(result?.files) ? result.files : [];
  const rootDir = String(result?.rootDir || "");
  if (!files.length) {
    setStatus("Folder tidak berisi gambar.", "error");
    showToast(`${iconMarkup("triangleExclamation")} Folder tidak berisi gambar.`, "warning");
    return;
  }
  await addFiles(files.map((filePath) => ({ path: filePath, rootDir })));
}

async function chooseOutputFolder() {
  const folder = await window.electronAPI.pickOutputFolder();
  if (!folder) return;
  outputDir = folder;
  resetConversionState();
  window.electronAPI.setStoreValue(STORAGE_KEYS.outputDir, outputDir);
  updateOutputUI();
  updateControls();
  setStatus("Folder output dipilih.", "success");
}

async function openOutputFolder() {
  if (!outputDir && lastOutputPath) {
    await window.electronAPI.showItemInFolder(lastOutputPath);
    setStatus("Lokasi hasil konversi terakhir dibuka.");
    return;
  }
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
  if (isConverting) return;
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
  const initialMsg = outputDir ? "Mulai konversi ke folder output..." : "Mulai konversi ke folder asal gambar...";

  setStatus(initialMsg, "processing");
  showToast(`${iconMarkup("rocket")} ${initialMsg}`, "success", 3000);

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
      setProgress(result.processed ?? result.total ?? filesToConvert.length, result.total || filesToConvert.length);
      setStatus(result.message, result.cancelled || result.failed ? "warning" : "success");

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
  document.querySelectorAll('button[data-tooltip]').forEach(button => {
    if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", button.dataset.tooltip);
  });

  const savedTheme = await window.electronAPI.getStoreValue(STORAGE_KEYS.theme);
  await applyTheme(savedTheme || "system");

  window.electronAPI.onThemeUpdated((isSystemDark) => {
    if (document.documentElement.getAttribute("data-theme-preference") === "system") {
      document.documentElement.setAttribute("data-theme", isSystemDark ? "dark" : "light");
      updateThemeIcon();
    }
  });

  syncAboutCreatorPhoto();

  outputDir = (await window.electronAPI.getStoreValue(STORAGE_KEYS.outputDir)) || "";

  const savedQuality = await window.electronAPI.getStoreValue(STORAGE_KEYS.quality);
  quality.value = String(clamp(Number(savedQuality || 85), 1, 100));
  qualityLabel.textContent = `${quality.value}%`;

  const savedPreserve = await window.electronAPI.getStoreValue(STORAGE_KEYS.preserveFolders);
  preserveFolders.checked = savedPreserve == null ? true : savedPreserve === true || savedPreserve === "true";

  const savedFormat = await window.electronAPI.getStoreValue(STORAGE_KEYS.outputFormat);
  if (["webp", "avif", "jpeg", "png"].includes(savedFormat)) {
    outputFormat.value = savedFormat;
  }
  syncFormatChoices();

  updateOutputUI();
  updateFileCount();
  updateTotalSize();
  updateViewButtons();
  updateControls();
  renderFileList();
  await validateStoredOutputDir();

}

themeToggle.addEventListener("click", toggleTheme);
aboutBtn.addEventListener("click", openAbout);
aboutClose.addEventListener("click", closeAbout);
aboutOverlay.addEventListener("click", closeAbout);
settingsBtn.addEventListener("click", openSettings);
$("logsBtn").addEventListener("click", () => {
  openSettings();
  switchSettingsTab("logs");
});
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

// Settings tab navigation
settingsPanel.querySelectorAll(".settings-nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab));
});

settingsPickOutput.addEventListener("click", chooseOutputFolder);
function resetConversionState() {
  if (isConverting) return;
  for (const file of selectedFiles) file.converted = false;
  updateControls();
  renderFileList();
}

function syncFormatChoices() {
  formatChoices.forEach(choice => { choice.checked = choice.value === outputFormat.value; });
}

formatChoices.forEach(choice => {
  choice.addEventListener("change", () => {
    if (!choice.checked || choice.disabled || isConverting) return;
    outputFormat.value = choice.value;
    outputFormat.dispatchEvent(new Event("change"));
  });
});

quality.addEventListener("input", () => {
  resetConversionState();
  qualityLabel.textContent = `${quality.value}%`;
  window.electronAPI.setStoreValue(STORAGE_KEYS.quality, quality.value);
});
preserveFolders.addEventListener("change", () => {
  window.electronAPI.setStoreValue(STORAGE_KEYS.preserveFolders, preserveFolders.checked);
});
outputFormat.addEventListener("change", () => {
  syncFormatChoices();
  resetConversionState();
  window.electronAPI.setStoreValue(STORAGE_KEYS.outputFormat, outputFormat.value);
});
settingsClearAll.addEventListener("click", () => {
  if (selectedFiles.length > 0 && !confirm("Apakah Anda yakin ingin menghapus semua file dari antrean?")) return;
  clearAll();
  closeSettings();
});

btnList.addEventListener("click", () => setView("list"));
btnGrid.addEventListener("click", () => setView("grid"));
pickFilesBtn.addEventListener("click", pickFiles);
pickFolderBtn.addEventListener("click", pickFolder);
clearAllBtn.addEventListener("click", () => {
  if (selectedFiles.length > 0 && confirm("Apakah Anda yakin ingin menghapus semua file dari antrean?")) {
    clearAll();
  } else if (selectedFiles.length === 0) {
    clearAll();
  }
});
quickOutputBtn?.addEventListener("click", async () => {
  const p = await window.electronAPI.pickOutputFolder();
  if (p) {
    outputDir = p;
    resetConversionState();
    window.electronAPI.setStoreValue(STORAGE_KEYS.outputDir, p);
    updateOutputUI();
    updateControls();
    showToast(`${iconMarkup("circleCheck")} Folder output berhasil diatur.`, "success");
  }
});
cancelConvertBtn?.addEventListener("click", async () => {
  await window.electronAPI.cancelBatch();
  setStatus("Membatalkan...", "warning");
  showToast(`${iconMarkup("triangleExclamation")} Konversi dibatalkan.`, "warning");
});
openOutputBtn.addEventListener("click", openOutputFolder);
convertBtn.addEventListener("click", startConversion);
dropzone.addEventListener("click", () => {
  if (!isConverting) pickFiles();
});

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
      if (data.outputPath) lastOutputPath = data.outputPath;
      if (file) {
        file.converted = true;
        updateFileItemById(file.id);
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

  setStatus("Memindai folder dan file...", "processing");
  try {
    const resultFiles = await window.electronAPI.scanDroppedPaths(paths);
    if (resultFiles && resultFiles.length > 0) {
      await addFiles(resultFiles);
    } else {
      setStatus("Tidak ada file gambar valid yang didrag.", "error");
      showToast(`${iconMarkup("triangleExclamation")} Tidak ada file gambar valid.`, "error");
    }
  } catch (err) {
    setStatus("Gagal memindai file/folder.", "error");
    showToast(`${iconMarkup("xmark")} Gagal memindai folder.`, "error");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    const modal = [aboutModal, settingsPanel, previewModal].find(dialog => dialog.classList.contains("open"));
    if (modal) {
      const controls = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')]
        .filter(control => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (first && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
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

// ---------- Floating Tooltip System ----------
function initTooltipSystem() {
  const tip = document.getElementById("tooltipEl");
  if (!tip) return;

  const GAP = 8; // px between trigger and tooltip
  let currentTrigger = null;
  let hideTimeout = null;

  function show(trigger) {
    clearTimeout(hideTimeout);
    currentTrigger = trigger;
    const text = trigger.getAttribute("data-tooltip");
    if (!text) return;

    tip.textContent = text;
    tip.className = "tooltip-floating"; // reset classes

    // Make visible off-screen to measure
    tip.style.left = "-9999px";
    tip.style.top = "-9999px";
    tip.classList.add("visible");

    const triggerRect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    // Default: position above
    let top = triggerRect.top - tipRect.height - GAP;
    let left = triggerRect.left + (triggerRect.width / 2) - (tipRect.width / 2);
    let isBelow = false;

    // Flip below if clipping top
    if (top < 4) {
      top = triggerRect.bottom + GAP;
      isBelow = true;
    }

    // Clamp horizontal: don't go off left edge
    if (left < 4) {
      left = 4;
    }
    // Don't go off right edge
    if (left + tipRect.width > window.innerWidth - 4) {
      left = window.innerWidth - tipRect.width - 4;
    }

    // Recalculate arrow position based on clamped left
    const arrowLeft = triggerRect.left + (triggerRect.width / 2) - left;
    const clampedArrow = Math.max(12, Math.min(arrowLeft, tipRect.width - 12));
    tip.style.setProperty("--arrow-left", `${clampedArrow}px`);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.className = "tooltip-floating" + (isBelow ? " below" : "");

    // Force reflow then show
    void tip.offsetWidth;
    tip.classList.add("visible");
  }

  function hide() {
    hideTimeout = setTimeout(() => {
      tip.classList.remove("visible");
      currentTrigger = null;
    }, 80);
  }

  // Event delegation
  document.body.addEventListener("mouseenter", (e) => {
    const trigger = e.target.closest("[data-tooltip]");
    if (trigger) show(trigger);
  }, true);

  document.body.addEventListener("mouseleave", (e) => {
    const trigger = e.target.closest("[data-tooltip]");
    if (trigger && trigger === currentTrigger) hide();
  }, true);

  // Hide on scroll in any container (prevent stale positioning)
  document.addEventListener("scroll", () => {
    if (currentTrigger) {
      tip.classList.remove("visible");
      currentTrigger = null;
    }
  }, true);
}

(async () => {
  await initializeFromStorage();
  initTooltipSystem();
  requestAnimationFrame(() => {
    window.electronAPI.signalReady();
  });
})();
