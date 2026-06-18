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
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function toDateInput(d?: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// True when a task is past due and not yet closed.
export function isLate(dueDate?: string | null, dateClosed?: string | null) {
  if (!dueDate || dateClosed) return false;
  return new Date(dueDate).getTime() < Date.now();
}
