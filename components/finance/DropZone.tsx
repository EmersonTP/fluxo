"use client";
import { useState, useRef } from "react";

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const fs = Array.from(e.dataTransfer.files); if (fs.length) onFiles(fs); }}
      onClick={() => ref.current?.click()}
      style={{ border: `1.5px dashed ${over ? "var(--roxo)" : "var(--line)"}`, background: over ? "rgba(146,80,172,.07)" : "var(--surface)", borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", fontSize: 13, color: over ? "var(--roxo)" : "var(--txt-soft)" }}
    >
      📎 Arraste um PDF/arquivo aqui ou clique para anexar
      <input ref={ref} type="file" hidden multiple onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) onFiles(fs); e.currentTarget.value = ""; }} />
    </div>
  );
}



/* ---------- Categorias (plano de contas) ---------- */
