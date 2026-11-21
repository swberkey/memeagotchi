import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // GDD Decision #5: <= 5 MB

export interface DetectedImage {
  ext: "jpg" | "png" | "gif" | "webp";
  mime: string;
}

/** Validate actual file magic bytes rather than trusting headers alone. */
export function detectImageType(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // GIF: GIF87a or GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { ext: "gif", mime: "image/gif" };
  }
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "::" ||
    h.startsWith("fe80:") ||
    h.startsWith("fc") ||
    h.startsWith("fd")
  ) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

export class UploadStore {
  readonly dir: string;

  constructor(uploadsDir: string) {
    this.dir = path.resolve(uploadsDir);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  saveBuffer(buf: Buffer): { fileName: string; imageUrl: string; mime: string } {
    if (buf.length < 16) {
      throw new Error("Image file is too small or empty.");
    }
    if (buf.length > MAX_UPLOAD_BYTES) {
      throw new Error("Image exceeds the 5 MB upload limit.");
    }
    const detected = detectImageType(buf);
    if (!detected) {
      throw new Error("Unsupported image format. Please upload JPEG, PNG, GIF, or WebP.");
    }
    const id = crypto.randomBytes(10).toString("hex");
    const fileName = `${Date.now()}-${id}.${detected.ext}`;
    fs.writeFileSync(path.join(this.dir, fileName), buf);
    return { fileName, imageUrl: `/uploads/${fileName}`, mime: detected.mime };
  }

  async fetchAndSaveUrl(rawUrl: string): Promise<{ imageUrl: string; suggestedTitle: string }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error("Invalid URL format.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http:// and https:// image URLs are allowed.");
    }
    if (isBlockedHostname(parsed.hostname)) {
      throw new Error("Private or local network URLs are blocked.");
    }

    const res = await fetch(parsed.toString(), {
      headers: { "user-agent": "MemeAgotchi/1.0" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Remote server responded HTTP ${res.status}`);

    // Re-check final URL after redirects
    try {
      const finalUrl = new URL(res.url);
      if (isBlockedHostname(finalUrl.hostname)) {
        throw new Error("Redirected to a blocked local/private address.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("blocked")) throw err;
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const saved = this.saveBuffer(buf);

    let suggestedTitle = "My Posted Meme";
    try {
      const seg = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ")
        .trim()
        .slice(0, 48);
      if (seg.length >= 2) suggestedTitle = seg;
    } catch {
      /* fallback title */
    }

    return { imageUrl: saved.imageUrl, suggestedTitle };
  }

  resolveSafeFile(fileName: string): { fullPath: string; mime: string } | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
    const fullPath = path.resolve(this.dir, fileName);
    if (!fullPath.startsWith(this.dir + path.sep)) return null;
    if (!fs.existsSync(fullPath)) return null;
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const mime = mimeMap[ext];
    if (!mime) return null;
    return { fullPath, mime };
  }
}
