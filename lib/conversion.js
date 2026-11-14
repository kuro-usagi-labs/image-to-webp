const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const OUTPUT_FORMATS = new Set(["webp", "avif", "jpeg", "png"]);

function validateConversionOptions(format = "webp", quality = 85) {
  if (!OUTPUT_FORMATS.has(format)) {
    throw new Error("Format output tidak didukung.");
  }
  const numericQuality = Number(quality);
  if (!Number.isInteger(numericQuality) || numericQuality < 1 || numericQuality > 100) {
    throw new Error("Kualitas harus berupa angka bulat antara 1 dan 100.");
  }
  return { format, quality: numericQuality };
}

async function reserveOutputPath(outputDir, baseName, format) {
  // Exclusive creation is the claim: existsSync followed by toFile is not atomic.
  for (let suffix = 0; ; suffix += 1) {
    const name = `${baseName}${suffix ? `_${suffix}` : ""}.${format}`;
    const target = path.join(outputDir, name);
    try {
      const handle = await fs.open(target, "wx", 0o600);
      await handle.close();
      return target;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

async function convertImage({ sourcePath, outputDir, format = "webp", quality = 85 }) {
  const options = validateConversionOptions(format, quality);
  const originalSize = (await fs.stat(sourcePath)).size;
  await fs.mkdir(outputDir, { recursive: true });
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const outputPath = await reserveOutputPath(outputDir, baseName, options.format);
  try {
    let image = sharp(sourcePath).autoOrient();
    if (format === "webp") image = image.webp({ quality: options.quality, effort: 6 });
    else if (format === "avif") image = image.avif({ quality: options.quality, effort: 6 });
    else if (format === "jpeg") image = image.jpeg({ quality: options.quality, mozjpeg: true });
    else image = image.png({ quality: options.quality, compressionLevel: 9 });
    const info = await image.toFile(outputPath);
    return { outputPath, outputFileName: path.basename(outputPath), originalSize, newSize: info.size };
  } catch (error) {
    // Only remove the path this invocation exclusively created, never an existing file.
    await fs.unlink(outputPath).catch(() => {});
    throw error;
  }
}

module.exports = { convertImage, validateConversionOptions };
