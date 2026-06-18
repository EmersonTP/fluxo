import { mkdir } from "fs/promises";
import path from "path";

// Where uploaded files live. On Railway, set UPLOAD_DIR=/data and mount a
// Volume at /data so files persist across deploys.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

export function safeStoredName(original: string) {
  const ext = path.extname(original).slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}${ext}`;
}
