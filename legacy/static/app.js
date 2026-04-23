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
  quality: "image-to-webp-quality",
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
let isConverting = false;
let previewIndex = -1;
let nextFileId = 1;
let dragCounter = 0;
let currentJobId = null;
let pollTimer = null;

const conversionLogs = [];
const dropOverlay = $("dropOverlay");

// --- UI / Icon Helpers ---
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

function getExtension(name) {
  return name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

function isImageFile(name) {
  return IMAGE_EXTENSIONS.includes(getExtension(name));
}

function canPreviewFile(name) {
  return PREVIEWABLE_EXTENSIONS.has(getExtension(name));
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  return `${parseFloat(value.toFixed(1))} ${units[exponent]}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// --- Theme & Modals ---
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.innerHTML = theme === "dark" ? iconMarkup("sun") : iconMarkup("moon");
  localStorage.setItem(STORAGE_KEYS.theme, theme);
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

// --- PREVIEW ---
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

function renderPreview() {
  if (previewIndex < 0 || previewIndex >= selectedFiles.length) {
    closePreview();
    return;
  }

  const fileItem = selectedFiles[previewIndex];
  previewName.textContent = fileItem.name;
  previewMeta.textContent = `${formatBytes(fileItem.size)}`;
  previewPrev.disabled = previewIndex === 0;
  previewNext.disabled = previewIndex === selectedFiles.length - 1;
  previewImage.classList.remove("visible");
  previewImage.removeAttribute("src");

  if (!canPreviewFile(fileItem.name)) {
    previewEmpty.hidden = false;
    previewEmptyText.textContent = "Preview tidak tersedia untuk format ini.";
    return;
  }

  previewEmpty.hidden = false;
  previewEmptyText.textContent = "Memuat preview...";
  const url = URL.createObjectURL(fileItem.file);
  previewImage.src = url;
}

// --- UI Updates ---
function updateFileCount() {
  fileCountEl.innerHTML = `File: <strong>${selectedFiles.length}</strong>`;
}

function updateControls() {
  const hasFiles = selectedFiles.length > 0;
  pickFilesBtn.disabled = isConverting;
  pickFolderBtn.disabled = true; // Web cannot easily pick folders cross-browser without specific APIs, disabled for now or polyfilled later
  clearAllBtn.disabled = isConverting || !hasFiles;
  settingsClearAll.disabled = isConverting || !hasFiles;
  quality.disabled = isConverting;
  convertBtn.disabled = isConverting || !hasFiles;

  // Web backend doesn't support custom folder outputs directly yet
  settingsPickOutput.disabled = true;
  settingsOutputPath.textContent = "ZIP Download (Otomatis)";
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

  for (const item of selectedFiles) {
    const el = document.createElement("div");
    el.className = `file-item${item.converted ? " file-item--converted" : ""}`;
    el.dataset.fileId = String(item.id);

    const convertedIcon = item.converted
      ? `<span class="f-converted-icon" title="Sudah dikonversi">${iconMarkup("circleCheck")}</span>`
      : "";

    el.innerHTML = `
      <div class="file-main">
        <span class="icon-slot">${iconMarkup("fileImage")}</span>
        <span class="f-name">${item.name}</span>
        ${convertedIcon}
      </div>
      <span class="f-size">${formatBytes(item.size)}</span>
      <div class="f-actions">
        <button class="f-action" data-action="preview" data-id="${item.id}" title="Preview file">
          ${iconMarkup("eye")}
        </button>
        <button class="f-action danger" data-action="remove" data-id="${item.id}" title="Hapus file" ${isConverting ? "disabled" : ""}>
          ${iconMarkup("xmark")}
        </button>
      </div>
    `;
    fragment.appendChild(el);
  }

  fileList.appendChild(fragment);
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
  const index = selectedFiles.findIndex((f) => f.id === id);
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

// --- FILE HANDLING ---
function addFiles(fileListItems) {
  const incoming = Array.from(fileListItems);
  const valid = incoming.filter((f) => isImageFile(f.name));
  const invalidCount = incoming.length - valid.length;

  const existingNames = new Set(selectedFiles.map((f) => f.name.toLowerCase()));
  const added = [];
  let duplicateCount = 0;

  for (const file of valid) {
    if (existingNames.has(file.name.toLowerCase())) {
      duplicateCount++;
      continue;
    }
    existingNames.add(file.name.toLowerCase());
    added.push({
      id: nextFileId++,
      name: file.name,
      file: file,
      size: file.size,
      converted: false
    });
  }

  if (!added.length) {
    if (duplicateCount) setStatus(`${duplicateCount} file duplikat diabaikan.`, "warning");
    else setStatus("Tidak ada file gambar yang valid.", "error");
    return;
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

function handleFileSelect() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = IMAGE_EXTENSIONS.join(",");
  input.onchange = (e) => {
    if (e.target.files) addFiles(e.target.files);
  };
  input.click();
}

// --- HTTP BACKEND INTEGRATION ---
function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollProgress(jobId) {
  try {
    const res = await fetch(`/api/progress/${jobId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal mengambil progress.");

    const total = data.total || 0;
    const processed = data.processed || 0;

    setProgress(processed, total);
    setStatus(data.message || "Memproses...", "processing");

    if (data.status === "done") {
      clearPoll();
      isConverting = false;
      updateControls();

      // Auto trigger download
      const a = document.createElement("a");
      a.href = `/api/download/${jobId}`;
      a.download = `webp_result_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatus(`Selesai. ZIP mendownload otomatis.`, "success");
      addLogEntry("Batch Zip Download", true, null, `Berhasil ${data.success}`);
    }

    if (data.status === "error") {
      clearPoll();
      isConverting = false;
      updateControls();
      setStatus(data.message || "Proses gagal.", "error");
      addLogEntry("Batch WebP", false, data.message);
    }
  } catch (err) {
    clearPoll();
    isConverting = false;
    updateControls();
    setStatus(err.message || "Terjadi kesalahan polling.", "error");
  }
}

async function startConversion() {
  clearPoll();
  if (currentJobId) {
    fetch(`/api/job/${currentJobId}`, { method: "DELETE" }).catch(() => null);
  }
  currentJobId = null;

  const validFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith(".png"));
  if (validFiles.length === 0) {
    setStatus("Backend Flask saat ini HANYA mendukung PNG ke WebP.", "error");
    return;
  }

  isConverting = true;
  updateControls();
  showProgress(true);
  setProgress(0, validFiles.length);
  setStatus("Mengunggah file ke server...", "processing");

  const formData = new FormData();
  validFiles.forEach((item) => formData.append("files", item.file));
  formData.append("quality", quality.value);

  try {
    const res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memulai konversi.");

    currentJobId = data.job_id;
    setStatus("Konversi di server dimulai...", "processing");

    pollProgress(currentJobId);
    pollTimer = setInterval(() => pollProgress(currentJobId), 800);
  } catch (err) {
    isConverting = false;
    updateControls();
    setStatus(err.message || "Terjadi kesalahan saat upload.", "error");
  }
}

// --- EVENTS & INIT ---

themeToggle.addEventListener("click", toggleTheme);
aboutBtn.addEventListener("click", openAbout);
aboutClose.addEventListener("click", closeAbout);
aboutOverlay.addEventListener("click", closeAbout);
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

quality.addEventListener("input", () => {
  qualityLabel.textContent = `${quality.value}%`;
  localStorage.setItem(STORAGE_KEYS.quality, quality.value);
});

settingsClearAll.addEventListener("click", () => {
  clearAll();
  closeSettings();
});

pickFilesBtn.addEventListener("click", handleFileSelect);
clearAllBtn.addEventListener("click", clearAll);
convertBtn.addEventListener("click", startConversion);

fileList.addEventListener("click", (event) => {
  const actionBtn = event.target.closest("button[data-action]");
  if (actionBtn) {
    const id = Number(actionBtn.dataset.id);
    const action = actionBtn.dataset.action;
    if (action === "remove") removeFileById(id);
    if (action === "preview") {
      const idx = selectedFiles.findIndex((f) => f.id === id);
      if (idx !== -1) openPreview(idx);
    }
    return;
  }
});

// Drag & Drop Web
["dragenter", "dragover"].forEach(ev => {
  document.addEventListener(ev, e => {
    e.preventDefault();
    if (dragCounter === 0) {
      dropOverlay.classList.add("active");
      dropzone.classList.add("active");
    }
    dragCounter++;
  });
});

["dragleave", "drop"].forEach(ev => {
  document.addEventListener(ev, e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 || ev === "drop") {
      dragCounter = 0;
      dropOverlay.classList.remove("active");
      dropzone.classList.remove("active");
    }
  });
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files) {
    addFiles(e.dataTransfer.files);
  }
});

previewOverlay.addEventListener("click", closePreview);
previewClose.addEventListener("click", closePreview);
previewPrev.addEventListener("click", () => {
  if (previewIndex > 0) { previewIndex--; renderPreview(); }
});
previewNext.addEventListener("click", () => {
  if (previewIndex < selectedFiles.length - 1) { previewIndex++; renderPreview(); }
});
previewImage.addEventListener("load", () => {
  previewImage.classList.add("visible");
  previewEmpty.hidden = true;
});
previewImage.addEventListener("error", () => {
  previewImage.classList.remove("visible");
  previewEmpty.hidden = false;
});

aboutCreatorPhoto.addEventListener("load", syncAboutCreatorPhoto);
aboutCreatorPhoto.addEventListener("error", syncAboutCreatorPhoto);

// Initialization
function initializeWeb() {
  hydrateStaticIcons();

  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  const savedQ = localStorage.getItem(STORAGE_KEYS.quality);
  if (savedQ) {
    quality.value = clamp(Number(savedQ), 1, 100);
  }
  qualityLabel.textContent = `${quality.value}%`;

  syncAboutCreatorPhoto();
  updateFileCount();
  updateControls();
}

document.addEventListener("DOMContentLoaded", initializeWeb);
window.addEventListener("beforeunload", () => {
  clearPoll();
  if (currentJobId) {
    fetch(`/api/job/${currentJobId}`, { method: "DELETE" }).catch(() => null);
  }
});
