"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceT, SpaceT, FolderT, ListLite } from "@/lib/types";

const SPACE_COLORS = ["#9250ac", "#ff7e59", "#1d9e75", "#534ab7", "#d85a30", "#3b82f6", "#ec4899", "#f59e0b"];

export default function SpacePanel({ id }: { id: string }) {
  const router = useRouter();
  const [sp, setSp] = useState<SpaceT | null>(null);
  const [wsName, setWsName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((d) => {
        for (const w of (d.workspaces || []) as WorkspaceT[]) {
          const i = w.spaces.findIndex((s) => s.id === id);
          if (i >= 0) {
            setSp(w.spaces[i]);
            setWsName(w.name);
            setColor(w.spaces[i].color || SPACE_COLORS[i % SPACE_COLORS.length]);
            return;
          }
        }
        setSp(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const looseLists: ListLite[] = sp?.lists || [];
  const folders: FolderT[] = sp?.folders || [];

  function ListRow({ l }: { l: ListLite }) {
    return (
      <div
        onClick={() => router.push(`/list/${l.id}`)}
        className="fx-hoverable"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", cursor: "pointer", fontSize: 13.5, borderTop: "1px solid var(--line)" }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
        <span style={{ fontSize: 11, color: "var(--txt-faint)", background: "var(--col)", borderRadius: 999, padding: "1px 8px" }}>{l._count?.tasks ?? 0}</span>
      </div>
    );
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>{wsName || "Espaço"}</div>
          <div className="fx-title">{sp?.name || "Espaço"}</div>
        </div>
      </div>
      <div className="fx-accent" style={{ background: color }} />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 48px", maxWidth: 760 }}>
        {loading && <p style={{ color: "var(--txt-soft)" }}>Carregando…</p>}
        {!loading && !sp && <p style={{ color: "var(--txt-faint)" }}>Espaço não encontrado ou sem acesso.</p>}

        {sp && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {looseLists.length > 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)" }}>Listas</div>
                {looseLists.map((l) => <ListRow key={l.id} l={l} />)}
              </div>
            )}

            {folders.map((f) => (
              <div key={f.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--txt)", display: "flex", alignItems: "center", gap: 7 }}>
                  <span>📁</span>{f.name}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--txt-faint)" }}>{f.lists.length} {f.lists.length === 1 ? "lista" : "listas"}</span>
                </div>
                {f.lists.map((l) => <ListRow key={l.id} l={l} />)}
                {f.lists.length === 0 && <p style={{ padding: "10px 14px", fontSize: 13, color: "var(--txt-faint)", borderTop: "1px solid var(--line)" }}>Nenhuma lista nesta pasta.</p>}
              </div>
            ))}

            {looseLists.length === 0 && folders.length === 0 && (
              <p style={{ color: "var(--txt-faint)" }}>Nenhuma lista neste espaço ainda. Crie pela barra lateral (+ Lista).</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
