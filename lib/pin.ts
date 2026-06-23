import crypto from "crypto";

// Hash do PIN de pagamento (scrypt + salt). Nunca guardamos o PIN em texto.
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(String(pin), salt, 32);
  return "s1:" + salt.toString("hex") + ":" + dk.toString("hex");
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith("s1:")) return false;
  const [, saltHex, dkHex] = stored.split(":");
  try {
    const dk = crypto.scryptSync(String(pin), Buffer.from(saltHex, "hex"), 32);
    return crypto.timingSafeEqual(dk, Buffer.from(dkHex, "hex"));
  } catch {
    return false;
  }
}
