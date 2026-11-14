const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");

async function run() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "imgconv-electron-test-"));
  const env = { ...process.env, IMGCONV_TEST_ROOT: testRoot };
  delete env.ELECTRON_RUN_AS_NODE;
  const args = process.argv.slice(2);
  if (args.includes("--readme")) env.IMGCONV_README_PREVIEW = "1";
  const entry = args.includes("--ui") ? "capture-ui.cjs" : "electron-smoke.cjs";
  const child = spawn(require("electron"), [path.join(__dirname, entry), "--hidden", ...args.filter(arg => arg !== "--ui")], {
    cwd: path.join(__dirname, ".."), env, stdio: "inherit", windowsHide: true
  });
  const timeout = setTimeout(() => {
    console.error("Electron smoke test timed out.");
    child.kill();
  }, 45000);
  child.on("error", error => {
    clearTimeout(timeout);
    console.error(error);
    process.exitCode = 1;
  });
  child.on("close", async code => {
    clearTimeout(timeout);
    // Delete only the temporary directory created by this invocation.
    if (path.dirname(path.resolve(testRoot)) === path.resolve(os.tmpdir())
      && path.basename(testRoot).startsWith("imgconv-electron-test-")) {
      await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(error => console.warn(error.message));
    }
    process.exitCode = code ?? 1;
  });
}

run().catch(error => { console.error(error); process.exitCode = 1; });
