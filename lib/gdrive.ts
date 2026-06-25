import { encryptField, decryptField } from "./crypto";
import { prisma } from "./prisma";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function appUrl() { return process.env.APP_URL || "https://fluxo-production-8ef7.up.railway.app"; }
export function redirectUri() { return `${appUrl()}/api/finance/gdrive/callback`; }
export function hasGoogleCreds() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }

export function authUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: redirectUri(), response_type: "code",
    scope: SCOPE, access_type: "offline", prompt: "consent", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ refresh_token?: string; access_token: string }> {
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
    code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: redirectUri(), grant_type: "authorization_code" }) });
  if (!r.ok) throw new Error(`Google token ${r.status}: ${await r.text()}`);
  return r.json();
}

async function accessTokenFor(companyId: string): Promise<string | null> {
  const conn = await prisma.driveConn.findUnique({ where: { companyId } });
  if (!conn) return null;
  const refresh = decryptField(conn.refreshTokenEnc);
  if (!refresh) return null;
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: refresh, grant_type: "refresh_token" }) });
  if (!r.ok) return null;
  return (await r.json()).access_token || null;
}

async function ensureFolder(token: string, nome: string, parent?: string): Promise<string> {
  const q = encodeURIComponent(`name='${nome.replace(/'/g, "")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent ? ` and '${parent}' in parents` : ""}`);
  const f = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (f.files?.[0]) return f.files[0].id;
  const meta: any = { name: nome, mimeType: "application/vnd.google-apps.folder" }; if (parent) meta.parents = [parent];
  const c = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(meta) }).then((r) => r.json());
  return c.id;
}

// Guarda o refresh token (cifrado) e cria/garante a pasta raiz "Sandra".
export async function saveConnection(companyId: string, refreshToken: string, email?: string) {
  const enc = encryptField(refreshToken) || refreshToken;
  let folderId: string | null = null;
  const at = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: refreshToken, grant_type: "refresh_token" }) }).then((r) => r.ok ? r.json() : null);
  if (at?.access_token) folderId = await ensureFolder(at.access_token, "Sandra - Documentos");
  await prisma.driveConn.upsert({ where: { companyId }, create: { companyId, refreshTokenEnc: enc, folderId, email: email || null }, update: { refreshTokenEnc: enc, folderId, email: email || null } });
}

// Sobe um arquivo pra pasta do Drive da empresa. Retorna o fileId ou null.
export async function uploadToDrive(companyId: string, filename: string, mime: string, buffer: Buffer, subpasta?: string): Promise<string | null> {
  const conn = await prisma.driveConn.findUnique({ where: { companyId } });
  if (!conn) return null;
  const token = await accessTokenFor(companyId);
  if (!token) return null;
  let parent = conn.folderId || undefined;
  if (subpasta && parent) parent = await ensureFolder(token, subpasta, parent);
  const boundary = "sandra" + Date.now();
  const meta = JSON.stringify({ name: filename, ...(parent ? { parents: [parent] } : {}) });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    buffer, Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  if (!r.ok) return null;
  return (await r.json()).id || null;
}
