const fs = require("node:fs");
const path = require("node:path");

async function cleanDist() {
  const distDir = path.join(__dirname, "..", "dist-electron");

  try {
    await fs.promises.rm(distDir, { recursive: true, force: true });
    console.log(`Build output dibersihkan: ${distDir}`);
  } catch (error) {
    console.error(`Gagal membersihkan dist-electron: ${error?.message || error}`);
    process.exit(1);
  }
}

cleanDist();
