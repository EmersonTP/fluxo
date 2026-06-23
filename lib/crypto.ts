import crypto from "crypto";

// Criptografia de campos sensíveis em repouso (CPF, dados de paciente).
// AES-256-GCM. A chave vem de DATA_ENC_KEY (qualquer passphrase forte);
// derivamos 32 bytes via SHA-256. Formato armazenado: "v1:<base64(iv|tag|cipher)>".

function key(): Buffer | null {
  const k = process.env.DATA_ENC_KEY;
  if (!k || k.length < 16) return null;
  return crypto.createHash("sha256").update(k).digest();
}

export function hasEncKey(): boolean {
  return key() !== null;
}

// Cifra um texto. Retorna null se não houver chave ou texto vazio
// (nesse caso o chamador mantém o comportamento legado).
export function encryptField(plain: string | null | undefined): string | null {
  const k = key();
  if (!k || !plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + Buffer.concat([iv, tag, enc]).toString("base64");
}

// Decifra. Retorna null se não houver chave, valor vazio ou falha.
export function decryptField(stored: string | null | undefined): string | null {
  const k = key();
  if (!k || !stored || !stored.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(stored.slice(3), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Máscara para exibição sem expor o dado inteiro (ex.: CPF -> ***.***.789-00).
export function maskDoc(doc: string | null | undefined): string {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (!d) return "—";
  return "•••" + d.slice(-3);
}
