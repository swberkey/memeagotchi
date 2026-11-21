# MemeAgotchi — Online Deployment & Hardware Pairing Guide

MemeAgotchi runs as a **single zero-dependency Node 22 container** serving:
- **Web Companion PWA** at `/`
- **320×240 (4:3) Handheld Simulator** at `/handheld/`
- **Multi-User Auth, 6-Char Handheld Device Pairing, Shared Community Meme Feed, Global Leaderboard, & Real-Time SSE Sync** at `/api/*`
- **SQLite (`WAL`) + ≤ 5 MB Magic-Byte Validated Meme Uploads** persisted under `DATA_DIR` (`/app/data`)

---

## 1. Fastest 2-Minute Cloud Deploys (Connected to `https://github.com/swberkey/memeagotchi`)

### Option A — Railway (Recommended for Instant Persistent Volume)
1. Go to [railway.com](https://railway.com) → **New Project → Deploy from GitHub Repo** → select `swberkey/memeagotchi`.
2. Railway auto-detects `railway.json` + `Dockerfile`.
3. Add a **Volume** mounted at `/app/data`.
4. Set environment variables:
   - `DATA_DIR=/app/data`
   - `SESSION_SECRET=<random 32+ char string>`
5. Click **Generate Domain** → open `https://<your-app>.up.railway.app/` and `/handheld/`!

### Option B — Render (Blueprint via `render.yaml`)
1. Go to [render.com](https://render.com) → **New → Blueprint** → connect `swberkey/memeagotchi`.
2. Render automatically reads `render.yaml`, mounts a persistent disk at `/app/data`, generates `SESSION_SECRET`, and checks `/api/health`.

### Option C — Fly.io (`fly.toml`)
```bash
fly launch --copy-config --no-deploy
fly volumes create memeagotchi_data --size 2 --region iad
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
fly deploy
```

### Option D — Self-Hosted Docker
```bash
docker build -t memeagotchi .
docker run -d --name memeagotchi \
  -p 3000:3000 \
  -v memeagotchi-data:/app/data \
  -e DATA_DIR=/app/data \
  -e SESSION_SECRET="change-this-to-a-long-random-secret" \
  memeagotchi
```

---

## 2. Installing on Mobile (PWA)
Once live over HTTPS, open your deployed URL in Safari (iOS) or Chrome (Android) and tap **Add to Home Screen** — `manifest.webmanifest` launches MemeAgotchi full-screen like a native app.

---

## 3. Pairing a `320×240` Handheld (Simulator or ESP32-S3 Firmware)
1. In the Web Companion, tap **`🌐 Online`** in the header → create/sign into your `@handle` → open the **`📟 Pair`** tab → click **Generate 6-Character Pair Code**.
2. On the **Handheld Simulator** (`/handheld/`), enter the 6-character code in the **Pair Handheld to Cloud Account** bar (or on the physical **ESP32-S3** over Wi-Fi, `POST https://<host>/api/devices/claim` with `{"code":"7K4Q9X","deviceName":"My ESP32-320"}`).
3. The server returns a long-lived `deviceToken` (`mgd_...`). Every subsequent `POST /api/actions` sends `Authorization: Bearer <deviceToken>` and subscribes to `GET /api/events?deviceToken=<deviceToken>` for instant real-time SSE sync!
4. Revoke any lost handheld anytime from Companion → **`🌐 Online → Pair → Unpair`**.
