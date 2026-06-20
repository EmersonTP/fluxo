"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Member = { id: string; name: string; color: string };

export default function PrivacyMenu({
  type,
  id,
  initialPrivate,
  initialMemberIds,
  onClose,
  onSaved,
  anchorRect,
}: {
  type: "space" | "list";
  id: string;
  initialPrivate: boolean;
  initialMemberIds: string[];
  onClose: () => void;
  onSaved: () => void;
  anchorRect?: DOMRect | null;
}) {
  const [priv, setPriv] = useState(initialPrivate);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialMemberIds));
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/members").then((r) => r.json()).then((d) => setMembers(d.members || []));
  }, []);

  function toggle(uid: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/${type === "space" ? "spaces" : "lists"}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ private: priv, memberIds: priv ? [...selected] : [] }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  const width = 248;
  const top = anchorRect ? Math.min(anchorRect.bottom + 4, window.innerHeight - 380) : 80;
  const left = anchorRect ? Math.max(8, Math.min(anchorRect.right - width, window.innerWidth - width - 8)) : 80;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000 }} />
      <div
        className="fx-popover"
        style={{ position: "fixed", top, left, width, zIndex: 2001, padding: 12, maxHeight: 360, overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt)", cursor: "pointer", marginBottom: priv ? 10 : 4 }}>
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--roxo)" }} />
          {type === "space" ? "Espaço privado" : "Lista privada"}
        </label>
        <p style={{ fontSize: 11, color: "var(--txt-faint)", margin: "0 0 8px" }}>
          {priv ? "Só as pessoas marcadas (e admins) veem." : "Visível a todos da empresa."}
        </p>

        {priv && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            {members.map((m) => {
              const on = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderRadius: 6, border: "none", background: on ? "rgba(146,80,172,.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--txt)", textAlign: "left", width: "100%" }}
                >
                  <span className="fx-avatar" style={{ width: 20, height: 20, fontSize: 9, background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  {on && <span style={{ color: "var(--roxo)" }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        <button className="fx-btn fx-btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>,
    document.body
  );
}
