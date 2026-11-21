import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopeDir = path.join(root, "node_modules", "@memeagotchi");
fs.mkdirSync(scopeDir, { recursive: true });

const links = [
  ["game-core", path.join(root, "packages", "game-core")],
  ["rpc-sdk", path.join(root, "packages", "rpc-sdk")],
  ["monster-ui", path.join(root, "packages", "monster-ui")],
  ["server", path.join(root, "apps", "server")],
];

for (const [name, target] of links) {
  const dest = path.join(scopeDir, name);
  if (!fs.existsSync(dest)) {
    fs.symlinkSync(target, dest, process.platform === "win32" ? "junction" : "dir");
  }
}
