import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServer } from "./app.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? (isProd ? 3000 : 3001));
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(repoRoot, "apps/server/data");

const dbPath = path.join(dataDir, "memeagotchi.db");
const uploadsDir = path.join(dataDir, "uploads");
const webDistDir = path.join(repoRoot, "apps/web-companion/dist");
const handheldDistDir = path.join(repoRoot, "apps/handheld-sim/dist");

const app = createAppServer({
  dbPath,
  uploadsDir,
  webDistDir,
  handheldDistDir,
});

app.server.listen(port, "0.0.0.0", () => {
  console.log(`MemeAgotchi unified server listening on http://localhost:${port}`);
  console.log(`  - Web Companion:      http://localhost:${port}/`);
  console.log(`  - Handheld Simulator: http://localhost:${port}/handheld/`);
  console.log(`  - Health:             http://localhost:${port}/api/health`);
  console.log(`  - SQLite DB:          ${dbPath}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void app.close().then(() => process.exit(0));
  });
}
