// Rate-limit simples em memória (janela deslizante por chave). Suficiente p/ proteger rotas públicas.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// limpeza leve p/ não crescer indefinidamente
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k); }, 5 * 60 * 1000).unref?.();
