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
  outputFormat: "image-to-webp-output-format",
  wpAutoUpload: "image-to-webp-wp-auto-upload",
  wpPresetSelect: "image-to-webp-wp-preset-select",
  wpPresetOverrides: "image-to-webp-wp-preset-overrides"
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
let currentView = "list";

const conversionLogs = [];

const dropOverlay = $("dropOverlay");
const toastEl = $("toast");

// WordPress DOM refs
const wpAutoUpload = $("wpAutoUpload");
const wpPresetSelect = $("wpPresetSelect");
const wpEditPresetBtn = $("wpEditPresetBtn");
const wpTestConnection = $("wpTestConnection");
const wpTestResult = $("wpTestResult");

// Edit WP Modal DOM refs
const wpEditOverlay = $("wpEditOverlay");
const wpEditModal = $("wpEditModal");
const wpEditClose = $("wpEditClose");
const wpEditTitle = $("wpEditTitle");
const editWpUrl = $("editWpUrl");
const editWpUsername = $("editWpUsername");
const editWpAppPassword = $("editWpAppPassword");
const editWpTogglePassword = $("editWpTogglePassword");
const editWpEyeIcon = $("editWpEyeIcon");
const editWpResetBtn = $("editWpResetBtn");
const editWpSaveBtn = $("editWpSaveBtn");

let toastTimer = null;
const collectedHtmlSnippets = [];

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
  settingsPanel.classList.add("open");
  settingsOverlay.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsOverlay.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
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
  const titles = { general: "General", output: "Output", wordpress: "WordPress", logs: "Logs" };
  if (settingsTabTitle) settingsTabTitle.textContent = titles[tabName] || tabName;
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
  const label = selectedFiles.length === 1 ? "file ready" : "files ready";
  fileCountEl.innerHTML = `<strong>${selectedFiles.length}</strong> ${label}`;
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
  const outputText = outputDir || "Default: folder asal gambar";
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
  preserveFolders.disabled = isConverting;
  openOutputBtn.disabled = !outputDir;
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

const WP_PRESETS_DEFAULT = {
  shoppnow: { name: "Shoppnow", wpUrl: "https://shoppnow.my.id", username: "admin_shoppnow" },
  primamarket: { name: "Prima Market", wpUrl: "https://primamarket.my.id", username: "admin_primamarket" },
  lazaramart: { name: "Lazara Mart", wpUrl: "https://lazaramart.my.id/", username: "admin_lazaramart" },
  happymarket: { name: "Happy Market", wpUrl: "https://happymarket.my.id/", username: "admin_happymarket" }
};
const WP_PRESET_KEYS = Object.keys(WP_PRESETS_DEFAULT);
let wpOverrides = {};
let wpPasswords = {};

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

function getWpPresetKey(presetKey = null) {
  const requestedKey = String(presetKey || wpPresetSelect?.value || "").trim();
  if (requestedKey && WP_PRESETS_DEFAULT[requestedKey]) {
    return requestedKey;
  }
  return WP_PRESET_KEYS[0] || "shoppnow";
}

async function refreshWpPassword(presetKey = null) {
  const key = getWpPresetKey(presetKey);
  try {
    const password = await window.electronAPI.getWpPassword(key);
    wpPasswords[key] = String(password || "");
  } catch {
    wpPasswords[key] = "";
  }
  return wpPasswords[key] || "";
}

async function loadAllWpPasswords() {
  for (const key of WP_PRESET_KEYS) {
    await refreshWpPassword(key);
  }
}

function buildPersistedWpOverrides() {
  return sanitizeWpOverrides(wpOverrides);
}

async function persistWpOverrides() {
  const cleaned = buildPersistedWpOverrides();
  wpOverrides = cleaned;

  if (!Object.keys(cleaned).length) {
    await window.electronAPI.deleteStoreValue(STORAGE_KEYS.wpPresetOverrides);
    return;
  }

  await window.electronAPI.setStoreValue(STORAGE_KEYS.wpPresetOverrides, JSON.stringify(cleaned));
}

function getWpCredentials(presetKey = null) {
  const key = getWpPresetKey(presetKey);
  const defaults = WP_PRESETS_DEFAULT[key] || { wpUrl: "", username: "" };
  const overrides = wpOverrides[key] || {};
  return {
    wpUrl: overrides.wpUrl || defaults.wpUrl || "",
    username: overrides.username || defaults.username || "",
    appPassword: wpPasswords[key] || ""
  };
}

function isWpConfigured(presetKey = null) {
  const cred = getWpCredentials(presetKey);
  return Boolean(cred.wpUrl && cred.username && cred.appPassword);
}

function resetWpPasswordVisibility() {
  editWpAppPassword.type = "password";
  editWpEyeIcon.innerHTML = iconMarkup("eye");
}

async function openWpEditModal() {
  const key = getWpPresetKey();
  const cred = getWpCredentials(key);
  wpEditTitle.textContent = `Edit Preset: ${WP_PRESETS_DEFAULT[key].name}`;
  editWpUrl.value = cred.wpUrl;
  editWpUsername.value = cred.username;
  editWpAppPassword.value = await refreshWpPassword(key);
  resetWpPasswordVisibility();

  wpEditOverlay.classList.add("open");
  wpEditModal.classList.add("open");
  wpEditModal.setAttribute("aria-hidden", "false");
}

function closeWpEditModal() {
  wpEditOverlay.classList.remove("open");
  wpEditModal.classList.remove("open");
  wpEditModal.setAttribute("aria-hidden", "true");
  resetWpPasswordVisibility();
}

async function saveWpPresetData() {
  const key = getWpPresetKey();
  const defaults = WP_PRESETS_DEFAULT[key] || { wpUrl: "", username: "" };
  const nextPassword = editWpAppPassword.value.trim();
  const nextOverride = {};

  const nextWpUrl = editWpUrl.value.trim();
  const nextUsername = editWpUsername.value.trim();

  if (nextWpUrl && nextWpUrl !== defaults.wpUrl) {
    nextOverride.wpUrl = nextWpUrl;
  }

  if (nextUsername && nextUsername !== defaults.username) {
    nextOverride.username = nextUsername;
  }

  const passwordResult = nextPassword
    ? await window.electronAPI.setWpPassword(key, nextPassword)
    : await window.electronAPI.clearWpPassword(key);

  if (!passwordResult?.ok) {
    setStatus(passwordResult?.message || "Gagal menyimpan password WordPress.", "error");
    showToast(`${iconMarkup("triangleExclamation")} Gagal menyimpan password WordPress.`, "error");
    return;
  }

  if (Object.keys(nextOverride).length) {
    wpOverrides[key] = nextOverride;
  } else {
    delete wpOverrides[key];
  }

  if (nextPassword) {
    wpPasswords[key] = nextPassword;
  } else {
    delete wpPasswords[key];
  }

  await persistWpOverrides();
  closeWpEditModal();
  wpTestResult.textContent = "";
  wpTestResult.className = "wp-test-result";
  showToast(`${iconMarkup("circleCheck")} Preset ${WP_PRESETS_DEFAULT[key].name} disimpan.`, "success");
}

async function resetWpPresetData() {
  const key = getWpPresetKey();
  if (wpOverrides[key]) {
    delete wpOverrides[key];
  }
  delete wpPasswords[key];
  await persistWpOverrides();
  await window.electronAPI.clearWpPassword(key);
  closeWpEditModal();
  wpTestResult.textContent = "";
  wpTestResult.className = "wp-test-result";
  showToast(`${iconMarkup("circleCheck")} Preset dikembalikan ke default.`, "success");
}

async function testWpConnection() {
  await refreshWpPassword();
  const cred = getWpCredentials();
  if (!cred.wpUrl || !cred.username || !cred.appPassword) {
    wpTestResult.textContent = "Isi semua field terlebih dahulu.";
    wpTestResult.className = "wp-test-result error";
    return;
  }

  wpTestResult.textContent = "Menghubungkan...";
  wpTestResult.className = "wp-test-result";
  wpTestConnection.disabled = true;

  try {
    const result = await window.electronAPI.testWpConnection(cred);
    wpTestResult.textContent = result.message;
    wpTestResult.className = `wp-test-result ${result.ok ? "success" : "error"}`;
    if (result.ok) {
      showToast(`${iconMarkup("circleCheck")} Koneksi WordPress berhasil!`, "success");
    }
  } catch (err) {
    wpTestResult.textContent = err.message || "Gagal test koneksi.";
    wpTestResult.className = "wp-test-result error";
  } finally {
    wpTestConnection.disabled = false;
  }
}

function buildHtmlTag(sourceUrl, fileName, width, height) {
  const alt = fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const dims = width && height ? ` width="${width}" height="${height}"` : "";
  return `<img src="${escapeHtml(sourceUrl)}" alt="${escapeHtml(alt)}" loading="lazy"${dims}>`;
}

async function uploadFileToWp(filePath, fileName) {
  const cred = getWpCredentials();
  return window.electronAPI.uploadToWordPress({
    ...cred,
    filePath,
    fileName
  });
}

function renderFileList() {
  fileList.className = currentView === "grid" ? "file-list file-list--grid" : "file-list file-list--list";
  fileList.innerHTML = "";

  if (!selectedFiles.length) {
    fileList.innerHTML = `
      <div class="file-empty">
        <span class="file-empty-icon">${iconMarkup("cloudArrowUp")}</span>
        <p class="file-empty-title">Belum ada gambar di queue</p>
        <p class="file-empty-copy">Tambahkan file atau folder untuk mulai konversi. Semua fungsi lama tetap tersedia dari panel utama.</p>
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
      ? `<img class="${currentView === "grid" ? "f-grid-image" : "f-thumb-image"}" data-src="${toFileUrl(file.path)}" alt="">`
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

  // Ensure any newly added/re-rendered thumbnail img is observer-tracked
  initLazyLoading();
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
    .map((log, idx) => {
      const timeStr = log.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const statusHtml = log.success
        ? `<span class="log-status success" title="${log.sizeInfo || ''}">${iconMarkup("circleCheck")} Berhasil ${log.sizeInfo ? '(' + log.sizeInfo + ')' : ''}</span>`
        : `<span class="log-status error" title="${log.error || 'Gagal'}">${iconMarkup("xmark")} Gagal</span>`;
      const urlHtml = log.url
        ? `<button class="log-copy-btn" data-log-idx="${idx}" title="Copy URL">${iconMarkup("clipboard")} Copy</button>`
        : '';

      return `
        <tr>
          <td>${timeStr}</td>
          <td class="log-file" title="${escapeHtml(log.file)}">${escapeHtml(log.file)}</td>
          <td>${statusHtml}</td>
          <td>${urlHtml}</td>
        </tr>
      `;
    })
    .join("");
}

function addLogEntry(file, success, error, sizeInfo, url) {
  conversionLogs.unshift({
    time: new Date(),
    file,
    success,
    error,
    sizeInfo,
    url
  });
  renderLogs();
}

settingsLogsBody.addEventListener("click", (event) => {
  const copyBtn = event.target.closest(".log-copy-btn");
  if (!copyBtn) return;
  const idx = Number(copyBtn.dataset.logIdx);
  const log = conversionLogs[idx];
  if (!log || !log.url) return;
  navigator.clipboard.writeText(log.url).then(() => {
    const original = copyBtn.innerHTML;
    copyBtn.innerHTML = `${iconMarkup("circleCheck")} Copied!`;
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.innerHTML = original;
      copyBtn.classList.remove("copied");
    }, 1500);
  });
});

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

  if (wpAutoUpload?.checked) {
    await refreshWpPassword();
  }

  const shouldUpload = wpAutoUpload?.checked && isWpConfigured();

  if (wpAutoUpload?.checked && !isWpConfigured()) {
    setStatus("WP Upload aktif tapi kredensial belum lengkap. Buka Pengaturan.", "error");
    showToast(`${iconMarkup("triangleExclamation")} Isi kredensial WordPress di Pengaturan!`, "error");
    return;
  }

  isConverting = true;
  collectedHtmlSnippets.length = 0;
  updateControls();
  renderFileList();
  setProgress(0, filesToConvert.length);
  showProgress(true);
  const initialMsg = shouldUpload
    ? "Mulai konversi & upload ke WordPress..."
    : outputDir ? "Mulai konversi ke folder output..." : "Mulai konversi ke folder asal gambar...";

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

      // Manual Copy HTML snippets
      if (!result.cancelled && shouldUpload && collectedHtmlSnippets.length > 0) {
        const fullHtml = collectedHtmlSnippets.join("\n");
        const toastHtml = `${iconMarkup("circleCheck")} Upload selesai! ${collectedHtmlSnippets.length} HTML siap. <button id="copyHtmlToastBtn" style="margin-left: 10px; padding: 4px 8px; border-radius: 4px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer;">Copy HTML</button>`;
        showToast(toastHtml, "success", 0);
        const copyBtn = document.getElementById("copyHtmlToastBtn");
        if (copyBtn) {
          copyBtn.addEventListener("click", async () => {
            await window.electronAPI.copyToClipboard(fullHtml);
            showToast(`${iconMarkup("circleCheck")} HTML berhasil disalin ke clipboard!`, "success");
            addLogEntry("HTML Clipboard", true, null, `${collectedHtmlSnippets.length} tag disalin`);
          });
        }
      }
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
  preserveFolders.checked = savedPreserve === null ? true : savedPreserve === true || savedPreserve === "true";

  const savedFormat = await window.electronAPI.getStoreValue(STORAGE_KEYS.outputFormat);
  if (savedFormat) {
    outputFormat.value = savedFormat;
  }

  updateOutputUI();
  updateFileCount();
  updateTotalSize();
  updateViewButtons();
  updateControls();
  renderFileList();
  await validateStoredOutputDir();

  // Load WP settings
  const savedWpToggle = await window.electronAPI.getStoreValue(STORAGE_KEYS.wpAutoUpload);
  if (wpAutoUpload) wpAutoUpload.checked = savedWpToggle === true || savedWpToggle === "true";

  const savedPreset = await window.electronAPI.getStoreValue(STORAGE_KEYS.wpPresetSelect);
  if (wpPresetSelect && savedPreset) wpPresetSelect.value = savedPreset;

  const savedOverridesStr = await window.electronAPI.getStoreValue(STORAGE_KEYS.wpPresetOverrides);
  wpOverrides = sanitizeWpOverrides(savedOverridesStr);
  await loadAllWpPasswords();
}

themeToggle.addEventListener("click", toggleTheme);
aboutBtn.addEventListener("click", openAbout);
aboutClose.addEventListener("click", closeAbout);
aboutOverlay.addEventListener("click", closeAbout);
settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

// Settings tab navigation
settingsPanel.querySelectorAll(".settings-nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab));
});

settingsPickOutput.addEventListener("click", chooseOutputFolder);
quality.addEventListener("input", () => {
  qualityLabel.textContent = `${quality.value}%`;
  window.electronAPI.setStoreValue(STORAGE_KEYS.quality, quality.value);
});
preserveFolders.addEventListener("change", () => {
  window.electronAPI.setStoreValue(STORAGE_KEYS.preserveFolders, preserveFolders.checked);
});
outputFormat.addEventListener("change", () => {
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

window.electronAPI.onConvertProgress(async (data) => {
  setProgress(data.current, data.total);
  setStatus(data.status || "Memproses...", "processing");

  if (data.srcPath) {
    const key = normalizePathKey(data.srcPath);
    const file = selectedFiles.find((f) => normalizePathKey(f.path) === key);

    // Process successful conversion
    if (data.convertedOk) {
      if (file) {
        file.converted = true;
        renderFileList();
      }

      const savedBytes = (data.originalSize || 0) - (data.newSize || 0);
      const pct = data.originalSize ? Math.round((savedBytes / data.originalSize) * 100) : 0;
      const sizeInfo = savedBytes >= 0 ? `hemat ${pct}%` : `tambah ${Math.abs(pct)}%`;
      addLogEntry(basename(data.srcPath), true, null, sizeInfo);

      // WP Auto-Upload
      if (wpAutoUpload?.checked && isWpConfigured() && data.outputPath) {
        const outputFilePath = data.outputPath;
        const outputFileName = data.outputFileName;

        setStatus(`Uploading ${outputFileName} ke WordPress...`, "processing");
        try {
          const wpResult = await uploadFileToWp(outputFilePath, outputFileName);
          if (wpResult.ok) {
            const htmlTag = buildHtmlTag(wpResult.sourceUrl, outputFileName, wpResult.width, wpResult.height);
            collectedHtmlSnippets.push(htmlTag);
            addLogEntry(`WP: ${outputFileName}`, true, null, "uploaded", wpResult.sourceUrl);
          } else {
            addLogEntry(`WP: ${outputFileName}`, false, wpResult.message);
          }
        } catch (err) {
          addLogEntry(`WP: ${outputFileName}`, false, err.message);
        }
      }
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

// WordPress event listeners
if (wpAutoUpload) {
  wpAutoUpload.addEventListener("change", () => {
    window.electronAPI.setStoreValue(STORAGE_KEYS.wpAutoUpload, wpAutoUpload.checked);
  });
}

if (wpPresetSelect) {
  wpPresetSelect.addEventListener("change", async () => {
    await window.electronAPI.setStoreValue(STORAGE_KEYS.wpPresetSelect, wpPresetSelect.value);
    await refreshWpPassword(wpPresetSelect.value);
    wpTestResult.textContent = "";
    wpTestResult.className = "wp-test-result";
  });
}

if (wpEditPresetBtn) {
  wpEditPresetBtn.addEventListener("click", openWpEditModal);
}
if (wpEditClose) wpEditClose.addEventListener("click", closeWpEditModal);
if (wpEditOverlay) wpEditOverlay.addEventListener("click", closeWpEditModal);

if (editWpSaveBtn) editWpSaveBtn.addEventListener("click", saveWpPresetData);
if (editWpResetBtn) editWpResetBtn.addEventListener("click", resetWpPresetData);

if (editWpTogglePassword) {
  editWpTogglePassword.addEventListener("click", () => {
    const isHidden = editWpAppPassword.type === "password";
    editWpAppPassword.type = isHidden ? "text" : "password";
    editWpEyeIcon.innerHTML = iconMarkup(isHidden ? "eyeSlash" : "eye");
  });
}

if (wpTestConnection) {
  wpTestConnection.addEventListener("click", testWpConnection);
}
