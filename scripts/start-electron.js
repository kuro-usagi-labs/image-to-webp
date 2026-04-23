const { spawn } = require("node:child_process");
const path = require("node:path");

const electronBinary = require("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd: path.join(__dirname, ".."),
  env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error("Gagal menjalankan Electron:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
