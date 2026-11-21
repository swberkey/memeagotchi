import { createActionClient, type ApiRequest, type ApiResponse } from "@memeagotchi/rpc-sdk/client";
import type { Actions } from "@memeagotchi/server/actions";

export const api = createActionClient<typeof Actions>("/api/actions");
export type { ApiRequest, ApiResponse };

export async function uploadMemeFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller (GDD limit).");
  }
  const bytes = await file.arrayBuffer();
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: bytes,
  });
  const data = (await res.json()) as { ok?: boolean; imageUrl?: string; error?: string };
  if (!res.ok || !data.ok || !data.imageUrl) {
    throw new Error(data.error ?? "Upload failed.");
  }
  return data.imageUrl;
}
