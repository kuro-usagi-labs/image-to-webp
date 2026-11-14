const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { version } = require("../package.json");

try {
  const directory = path.resolve(process.argv[2] || path.join(__dirname, "../dist-electron"));
  const files = [
    `Image-to-WebP-${version}.exe`,
    `Image-to-WebP-Setup-${version}.exe`,
    `Image-to-WebP-Setup-${version}.exe.blockmap`,
    "latest.yml"
  ];
  const lines = files.map(file => {
    const data = fs.readFileSync(path.join(directory, file));
    if (!data.length) throw new Error(`Release asset is empty: ${file}`);
    return `${crypto.createHash("sha256").update(data).digest("hex")}  ${file}`;
  });
  fs.writeFileSync(path.join(directory, "SHA256SUMS.txt"), lines.join("\n") + "\n");
  console.log(`SHA256SUMS.txt created for ${files.length} assets.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
