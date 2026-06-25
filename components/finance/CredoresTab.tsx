"use client";
import { useState } from "react";
import { Row, Field } from "./ui";
import { Credor } from "./types";

export function CredoresTab({ companyId, credores, reload }: { companyId: string; credores: Credor[]; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ nome: "", documento: "", tipo: "fornecedor", pixKey: "", categoriaPadrao: "" });
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const res = await fetch("/api/finance/credores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, companyId }) });
    const d = await res.json();
    if (res.ok) { setF({ nome: "", documento: "", tipo: "fornecedor", pixKey: "", categoriaPadrao: "" }); setAdding(false); reload(); } else setErr(d.error || "Erro.");
  }
  return (
    <>
      {!adding ? <button className="fx-btn fx-btn-primary" onClick={() => setAdding(true)}>+ Novo credor</button> : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, marginBottom: 14 }}>
          <Row><Field label="Nome*"><input className="fx-input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
            <Field label="CPF/CNPJ*"><input className="fx-input" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></Field></Row>
          <Row><Field label="Tipo"><select className="fx-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{["fornecedor", "profissional", "funcionario", "socio", "locador", "concessionaria", "orgao"].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="Chave PIX / forma"><input className="fx-input" value={f.pixKey} onChange={(e) => setF({ ...f, pixKey: e.target.value })} /></Field></Row>
          {err && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}><button className="fx-btn fx-btn-primary" onClick={save}>Salvar</button><button className="fx-btn" onClick={() => setAdding(false)}>Cancelar</button></div>
        </div>
      )}
      <div style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {credores.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 12, padding: "10px 15px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
            <span style={{ flex: 1, fontWeight: 500 }}>{c.nome}</span>
            <span style={{ color: "var(--txt-faint)" }}>{c.tipo}</span>
            <span style={{ color: "var(--txt-faint)" }}>{c.documento}</span>
            <span style={{ color: "var(--txt-faint)" }}>{c.pixKey || "—"}</span>
          </div>
        ))}
        {credores.length === 0 && <p style={{ padding: 15, color: "var(--txt-faint)", fontSize: 13 }}>Nenhum credor cadastrado.</p>}
      </div>
    </>
  );
}

/* ---------- Configuração de aprovadores ---------- */
