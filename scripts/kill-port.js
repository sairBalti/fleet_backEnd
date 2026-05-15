/**
 * Windows: free a TCP port by killing LISTENING PIDs (e.g. orphan node index.js).
 * Usage: node scripts/kill-port.js [port]
 */
import { execSync } from "node:child_process";
import os from "node:os";

const port = process.argv[2] || "5002";

if (os.platform() !== "win32") {
  console.log(`[kill-port] Skipping (Windows-only script). On Unix: lsof -ti:${port} | xargs kill -9`);
  process.exit(0);
}

let out = "";
try {
  out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
} catch {
  console.log(`[kill-port] Nothing found on :${port} (port may already be free).`);
  process.exit(0);
}

const pids = new Set();
for (const line of out.split(/\r?\n/)) {
  if (!line.includes("LISTENING")) continue;
  const parts = line.trim().split(/\s+/);
  const pid = parts[parts.length - 1];
  if (pid && /^\d+$/.test(pid)) pids.add(pid);
}

if (pids.size === 0) {
  console.log(`[kill-port] No LISTENING PID parsed for :${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    console.log(`[kill-port] Stopping PID ${pid} (port ${port})…`);
    execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
  } catch (e) {
    console.error(`[kill-port] taskkill failed for ${pid}:`, e?.message || e);
    process.exitCode = 1;
  }
}
