const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function generateIcon() {
  const { default: pngToIco } = await import("png-to-ico");
  const buildDir = path.join(__dirname, "..", "build");
  await fs.promises.mkdir(buildDir, { recursive: true });

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#136c5f" />
      <stop offset="100%" stop-color="#1c9f8f" />
    </linearGradient>
  </defs>
  <rect x="28" y="28" width="456" height="456" rx="110" fill="url(#g)"/>
  <rect x="74" y="90" width="230" height="330" rx="26" fill="#ffffff" opacity="0.95"/>
  <polygon points="220,90 304,174 220,174" fill="#c6f2e9"/>
  <text x="116" y="280" font-size="118" font-family="Segoe UI, Arial" font-weight="700" fill="#0f6156">P</text>
  <text x="285" y="322" font-size="112" font-family="Segoe UI, Arial" font-weight="700" fill="#ffffff">W</text>
  <path d="M286 255 L356 255" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
</svg>`;

  const pngPath = path.join(buildDir, "icon.png");
  const pngBuffer = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  await fs.promises.writeFile(pngPath, pngBuffer);

  const icoSizes = [256, 128, 64, 48, 32, 24, 16];
  const icoPngBuffers = await Promise.all(
    icoSizes.map((size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer())
  );

  const icoBuffer = await pngToIco(icoPngBuffers);
  const icoPath = path.join(buildDir, "icon.ico");
  await fs.promises.writeFile(icoPath, icoBuffer);

  process.stdout.write(`Icon generated: ${icoPath}\n`);
}

generateIcon().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
