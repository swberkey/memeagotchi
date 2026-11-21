import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./link-workspaces.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testFiles = [
  path.join(root, "packages/game-core/src/engine.test.ts"),
  path.join(root, "packages/rpc-sdk/src/schema.test.ts"),
  path.join(root, "apps/server/src/server.test.ts"),
];

const res = spawnSync(
  process.execPath,
  ["--conditions=source", "--test", "--test-reporter=spec", ...testFiles],
  { stdio: "inherit", cwd: root },
);

process.exit(res.status ?? 1);
