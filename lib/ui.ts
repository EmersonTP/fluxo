export function priorityMeta(p?: string | null) {
  switch (p) {
    case "urgent":
      return { label: "Urgente", bg: "#fee2e2", fg: "#b91c1c" };
    case "high":
      return { label: "Alta", bg: "#ffedd5", fg: "#c2410c" };
    case "normal":
      return { label: "Normal", bg: "#dbeafe", fg: "#1d4ed8" };
    case "low":
      return { label: "Baixa", bg: "#f1f5f9", fg: "#64748b" };
    default:
      return null;
  }
}

export const PRIORITIES = [
  { value: "", label: "Sem prioridade" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Baixa" },
];

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  // Prazos são guardados como data (meia-noite UTC); formata em UTC pra não cair 1 dia (fuso BRT).
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

// "YYYY-MM-DD" de uma data tratada como data-pura (UTC).
function ymdUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
function todayYMDLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function toDateInput(d?: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// True when a task is past due and not yet closed (comparação por data-pura, sem fuso).
export function isLate(dueDate?: string | null, dateClosed?: string | null) {
  if (!dueDate || dateClosed) return false;
  return ymdUTC(new Date(dueDate)) < todayYMDLocal();
}

// ===== Regras de cores estilo ClickUp =====

// Converte #rrggbb (ou rgb()) para rgba com transparência — usado nas pílulas suaves.
export function withAlpha(hex: string | null | undefined, alpha: number): string {
  if (!hex) return `rgba(146,80,172,${alpha})`;
  let h = hex.trim();
  if (h.startsWith("rgb")) return h.replace(/rgba?\(([^)]+)\)/, (_m, p) => `rgba(${p.split(",").slice(0, 3).join(",")},${alpha})`);
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Texto legível (preto/branco) sobre uma cor sólida — luminância relativa.
export function textOn(hex: string | null | undefined): string {
  if (!hex) return "#fff";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1f1b16" : "#ffffff";
}

// Ícone do grupo conforme o tipo do status (igual ClickUp: aberto ○, ativo ◓, concluído ✓).
export function statusIcon(type?: string | null): string {
  switch (type) {
    case "done":
    case "closed":
      return "✓";
    case "open":
      return "○";
    default:
      return "◓";
  }
}

// Cor da data conforme regra ClickUp: vencido = vermelho, hoje = laranja, futuro = verde, concluído = neutro.
export function dueMeta(dueDate?: string | null, dateClosed?: string | null): { color: string; label: string } | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const txt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  if (dateClosed) return { color: "var(--txt-faint)", label: txt };
  const due = ymdUTC(d);
  const today = todayYMDLocal();
  if (due < today) return { color: "#e5484d", label: txt };
  if (due === today) return { color: "#e8910c", label: "Hoje" };
  return { color: "#169d6b", label: txt };
}
