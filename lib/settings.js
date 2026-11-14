const { validateConversionOptions } = require("./conversion");

const SETTINGS = new Set([
  "image-to-webp-theme", "image-to-webp-output-dir", "image-to-webp-quality",
  "image-to-webp-preserve-folders", "image-to-webp-output-format"
]);

function assertSettingKey(key) {
  if (!SETTINGS.has(key)) throw new Error("Pengaturan tidak diizinkan.");
}

function validateSetting(key, value) {
  assertSettingKey(key);
  if (key === "image-to-webp-theme" && !["system", "light", "dark"].includes(value)) {
    throw new Error("Tema tidak valid.");
  }
  if (key === "image-to-webp-quality") {
    return validateConversionOptions("webp", value).quality;
  }
  if (key === "image-to-webp-output-format") validateConversionOptions(value);
  if (key === "image-to-webp-preserve-folders" && typeof value !== "boolean") {
    throw new Error("Opsi struktur folder tidak valid.");
  }
  if (key === "image-to-webp-output-dir" && (typeof value !== "string" || value.length > 32767 || value.includes("\0"))) {
    throw new Error("Folder output tidak valid.");
  }
  return value;
}

function removeRetiredWordPressSettings(store) {
  for (const key of [
    "wp-encrypted-passwords", "wp-encrypted-password",
    "image-to-webp-wp-preset-overrides", "image-to-webp-wp-preset-select",
    "image-to-webp-wp-auto-upload"
  ]) store.delete(key);
}

module.exports = { assertSettingKey, validateSetting, removeRetiredWordPressSettings };
