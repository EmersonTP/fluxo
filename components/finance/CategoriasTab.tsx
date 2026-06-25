"use client";
import { useState, useEffect, useCallback } from "react";

export function CategoriasTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [cats, setCats] = useState<{ id: string; grupo: string; nome: string; tipo: string; dre: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/categorias?company=${companyId}`).then((r) => r.json()).then((d) => setCats(d.categorias || [])).finally(() => setLoaded(true));
  }, [companyId]);
  useEffect(load, [load]);

  async function importar() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/finance/categorias/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    const d = await res.json();
    setBusy(false);
    if (res.ok) { setMsg(`Plano de contas importado: ${d.total} categorias.`); load(); }
    else setMsg(d.error || "Não foi possível importar.");
  }

  const grupos: { grupo: string; tipo: string; itens: typeof cats }[] = [];
  for (const c of cats) {
    let g = grupos.find((x) => x.grupo === c.grupo);
    if (!g) { g = { grupo: c.grupo, tipo: c.tipo, itens: [] }; grupos.push(g); }
    g.itens.push(c);
  }
  const despesas = grupos.filter((g) => g.tipo === "despesa");
  const receitas = grupos.filter((g) => g.tipo === "receita");

  function Bloco({ titulo, lista }: { titulo: string; lista: typeof grupos }) {
    if (lista.length === 0) return null;
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>{titulo}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {lista.map((g) => {
            const aberto = open[g.grupo] ?? false;
            return (
              <div key={g.grupo} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
                <button onClick={() => setOpen((o) => ({ ...o, [g.grupo]: !aberto }))} className="fx-hoverable" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 13px", background: "var(--surface)", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 11, color: "var(--txt-faint)", transform: aberto ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{g.grupo}</span>
                  <span style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{g.itens.length}</span>
                </button>
                {aberto && (
                  <div style={{ padding: "4px 13px 10px 30px", display: "flex", flexDirection: "column", gap: 2 }}>
                    {g.itens.map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                        <span style={{ flex: 1 }}>{c.nome}</span>
                        {c.dre && <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{c.dre}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: "var(--txt-soft)", flex: 1, minWidth: 220 }}>Plano de contas (Grupo › Categoria), no padrão do seu Omie. Usado na classificação das solicitações.</div>
        {isAdmin && <button className="fx-btn fx-btn-primary" disabled={busy} onClick={importar}>{busy ? "Importando…" : cats.length ? "Reimportar do padrão" : "Importar plano de contas"}</button>}
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {!loaded && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {loaded && cats.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma categoria ainda. {isAdmin ? "Clique em “Importar plano de contas”." : "Peça ao admin para importar."}</p>}
      <Bloco titulo="Despesas" lista={despesas} />
      <Bloco titulo="Receitas" lista={receitas} />
    </>
  );
}

/* ---------- Contas a Receber ---------- */
