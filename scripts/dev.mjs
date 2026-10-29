import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const phpCommand = process.env.WEBZAD_PHP_BIN || "php";
const php = spawn(phpCommand, ["-S", "127.0.0.1:8787", "-t", "api", "api/index.php"], {
  cwd: projectRoot,
  stdio: "inherit",
  windowsHide: true,
});
const vite = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  if (php.exitCode === null) php.kill();
  if (vite.exitCode === null) vite.kill();
  process.exitCode = code;
};

php.on("error", (error) => {
  process.stderr.write("PHP API could not start: " + error.message + "\n");
  stop(1);
});
php.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});
vite.on("error", (error) => {
  process.stderr.write("Vite could not start: " + error.message + "\n");
  stop(1);
});
vite.on("exit", (code) => {
  if (!stopping) stop(code ?? 0);
});
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
