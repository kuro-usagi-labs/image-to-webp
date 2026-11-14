const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
async function generateIcon() {
  const { default: pngToIco } = await import("png-to-ico");
  const root = path.join(__dirname, "..");
  const source = await fs.readFile(path.join(root, "ui/assets/app-icon.svg"));
  const sizes = [256, 128, 64, 48, 32, 24, 16];
  const frames = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
  await fs.writeFile(path.join(root, "ui/app.ico"), await pngToIco(frames));
  await sharp(source).resize(512, 512).png().toFile(path.join(root, "ui/assets/app-icon.png"));
  process.stdout.write("Generated ICO (16-256 px) and PNG from ui/assets/app-icon.svg\n");
}
generateIcon().catch(error => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
