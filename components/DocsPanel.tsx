"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DocLite = { id: string; title: string; updatedAt: string; companyId: string | null; company?: { name: string } | null };
type DocFull = { id: string; title: string; content: string; updatedAt: string };

export default function DocsPanel() {
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocFull | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDocs = useCallback(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents || []))
      .finally(() => setDocsLoaded(true));
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (!active) {
      setDoc(null);
      return;
    }
    setDoc(null);
    setDocLoading(true);
    fetch(`/api/documents/${active}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.document) {
          setDoc(d.document);
          setTitle(d.document.title);
          setContent(d.document.content || "");
          setSaved(true);
        }
      })
      .finally(() => setDocLoading(false));
  }, [active]);

  const save = useCallback(
    async (t: string, c: string) => {
      if (!active) return;
      await fetch(`/api/documents/${active}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content: c }),
      });
      setSaved(true);
      loadDocs();
    },
    [active, loadDocs]
  );

  function scheduleSave(t: string, c: string) {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(t, c), 900);
  }

  async function createDoc() {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Documento sem título" }),
    });
    const d = await res.json();
    if (d.document) {
      await loadDocs();
      setActive(d.document.id);
    }
  }

  async function removeDoc(id: string) {
    if (!confirm("Apagar este documento?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (active === id) {
      setActive(null);
      setDoc(null);
    }
    loadDocs();
  }

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Base de conhecimento</div>
          <div className="fx-title">Documentos</div>
        </div>
        <button className="fx-addbtn-top" style={{ marginLeft: "auto" }} onClick={createDoc}>+ Novo documento</button>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 250, borderRight: "1px solid var(--line)", overflowY: "auto", padding: "10px 8px", flexShrink: 0 }}>
          {!docsLoaded && <p style={{ fontSize: 12.5, color: "var(--txt-faint)", padding: 10 }}>Carregando…</p>}
          {docsLoaded && docs.length === 0 && <p style={{ fontSize: 12.5, color: "var(--txt-faint)", padding: 10 }}>Nenhum documento ainda. Crie o primeiro acima.</p>}
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setActive(d.id)}
              className={`fx-navitem ${active === d.id ? "active" : ""}`}
              style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, height: "auto", padding: "8px 10px" }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", textAlign: "left" }}>{d.title}</span>
              <span style={{ fontSize: 10.5, color: "var(--txt-faint)" }}>{d.company?.name || "Geral"}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!active && (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--txt-faint)" }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
              <p style={{ fontSize: 14 }}>Selecione um documento ou crie um novo.</p>
            </div>
          )}
          {active && docLoading && !doc && (
            <div style={{ margin: "auto" }}><div className="fx-spinner" /></div>
          )}
          {active && doc && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 32px", overflowY: "auto", maxWidth: 820, width: "100%", margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); scheduleSave(e.target.value, content); }}
                  placeholder="Título do documento"
                  className="serif"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 28, fontWeight: 600, color: "var(--txt)" }}
                />
                <span style={{ fontSize: 11.5, color: "var(--txt-faint)", whiteSpace: "nowrap" }}>{saved ? "Salvo" : "Salvando…"}</span>
                <button onClick={() => removeDoc(active)} title="Apagar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--coral-deep)", fontSize: 13 }}>Apagar</button>
              </div>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); scheduleSave(title, e.target.value); }}
                onBlur={() => save(title, content)}
                placeholder="Comece a escrever…"
                style={{ flex: 1, marginTop: 16, border: "none", outline: "none", background: "transparent", resize: "none", fontFamily: "inherit", fontSize: 15, lineHeight: 1.7, color: "var(--txt)", minHeight: 360 }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
