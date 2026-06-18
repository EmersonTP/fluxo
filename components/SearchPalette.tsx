"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  id: string;
  name: string;
  listId: string;
  status?: { name: string; color: string } | null;
  list?: { id: string; name: string } | null;
  assignees: { id: string; name: string; color: string }[];
};

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=25`)
        .then((r) => r.json())
        .then((d) => setResults(d.tasks || []))
        .finally(() => setLoading(false));
    }, 250);
  }, [q]);

  function go(t: Result) {
    onClose();
    router.push(`/list/${t.listId}?task=${t.id}`);
  }

  if (!open) return null;

  return (
    <div className="fx-overlay" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: "12vh" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(620px, 92vw)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--shadow-hover, 0 12px 40px rgba(0,0,0,.22))", overflow: "hidden" }}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results[0]) go(results[0]);
          }}
          placeholder="Buscar tarefas em todas as listas…"
          style={{ width: "100%", border: "none", borderBottom: "1px solid var(--line)", padding: "16px 18px", fontSize: 16, background: "transparent", color: "var(--txt)", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
          {loading && <div style={{ padding: 16, color: "var(--txt-faint)", fontSize: 13 }}>Buscando…</div>}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <div style={{ padding: 16, color: "var(--txt-faint)", fontSize: 13 }}>Nada encontrado.</div>
          )}
          {!loading && q.trim().length < 2 && (
            <div style={{ padding: 16, color: "var(--txt-faint)", fontSize: 13 }}>Digite ao menos 2 letras…</div>
          )}
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "10px 16px", borderTop: "1px solid var(--line)" }}
            >
              <span className="fx-dot" style={{ background: t.status?.color || "#a3a3a3" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                <span style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>
                  {t.list?.name}
                  {t.status?.name ? ` · ${t.status.name}` : ""}
                </span>
              </span>
              {(t.assignees || []).slice(0, 2).map((a, i) => (
                <span key={a.id} className="fx-avatar" style={{ width: 20, height: 20, fontSize: 9, background: a.color, marginLeft: i ? -5 : 0 }}>
                  {a.name.charAt(0).toUpperCase()}
                </span>
              ))}
            </button>
          ))}
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--txt-faint)" }}>Enter abre a primeira · Esc fecha</div>
      </div>
    </div>
  );
}
