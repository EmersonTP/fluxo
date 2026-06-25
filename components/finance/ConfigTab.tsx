"use client";
import { useState, useEffect } from "react";
import { Block, Chip } from "./ui";
import { Member, Area, Cfg } from "./types";

export function ConfigTab({ companyId, areas, members, config, reload }: { companyId: string; areas: Area[]; members: Member[]; config: Cfg[]; reload: () => void }) {
  const [drive, setDrive] = useState<any>(null);
  useEffect(() => { fetch(`/api/finance/gdrive/status?company=${companyId}`).then((r) => r.json()).then(setDrive).catch(() => {}); }, [companyId]);
  const [fechadoAte, setFechadoAte] = useState<string | null>(null);
  const [fechaData, setFechaData] = useState("");
  useEffect(() => { fetch(`/api/finance/fechamento?company=${companyId}`).then((r) => r.json()).then((d) => setFechadoAte(d.fechadoAte)).catch(() => {}); }, [companyId]);
  async function setFechamento(data: string | null) {
    const r = await fetch(`/api/finance/fechamento`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, fechadoAte: data }) });
    const d = await r.json(); if (r.ok) { setFechadoAte(d.fechadoAte); setFechaData(""); }
  }
  async function add(role: string, userId: string, spaceId?: string) {
    if (!userId) return;
    await fetch("/api/finance/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, role, userId, spaceId }) });
    reload();
  }
  async function rm(id: string) { await fetch(`/api/finance/config?id=${id}`, { method: "DELETE" }); reload(); }
  const mname = (uid: string) => members.find((m) => m.id === uid)?.name || uid;
  const fin = config.filter((c) => c.role === "financeiro");
  const pag = config.filter((c) => c.role === "pagador");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <p style={{ fontSize: 13.5, color: "var(--txt-soft)", margin: 0 }}>Defina quem aprova em cada portão desta empresa. A solicitação roteia sozinha: gestor da área → financeiro → pagador.</p>

      <Block title="Google Drive (Cofre de Documentos)">
        {!drive ? <p style={{ fontSize: 13, color: "var(--txt-faint)", margin: 0 }}>Carregando…</p> :
          !drive.credsOk ? <p style={{ fontSize: 13, color: "var(--txt-soft)", margin: 0 }}>Falta configurar <b>GOOGLE_CLIENT_ID</b> e <b>GOOGLE_CLIENT_SECRET</b> no servidor (Railway). Depois disso, o botão de conectar aparece aqui.</p> :
          drive.conectado ? <div style={{ fontSize: 13.5, color: "var(--txt-soft)" }}>✓ <b>Conectado ao Google Drive.</b> Os documentos do Cofre são copiados pra pasta "Sandra - Documentos" no Drive da empresa.{drive.email ? ` (${drive.email})` : ""}</div> :
          <div><p style={{ fontSize: 13.5, color: "var(--txt-soft)", marginTop: 0 }}>Conecte o Drive da empresa pra guardar os contratos/NFs também lá.</p><a className="fx-btn fx-btn-primary" style={{ textDecoration: "none" }} href={`/api/finance/gdrive/connect?company=${companyId}`}>Conectar Google Drive</a></div>}
      </Block>

      <Block title="Fechamento de mês (trava de período)">
        <p style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 0 }}>Trava lançamentos até a data escolhida — depois de fechar, o mês não aceita novos lançamentos, importação nem reclassificação. Garante que os relatórios fechados não mudam.</p>
        <div style={{ fontSize: 13.5, marginBottom: 10 }}>Status: {fechadoAte ? <b style={{ color: "#0f6b50" }}>fechado até {new Date(fechadoAte + "T12:00:00").toLocaleDateString("pt-BR")}</b> : <b style={{ color: "#b5781f" }}>nenhum mês fechado</b>}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="fx-input" type="date" value={fechaData} onChange={(e) => setFechaData(e.target.value)} style={{ maxWidth: 170 }} />
          <button className="fx-btn fx-btn-primary" disabled={!fechaData} onClick={() => setFechamento(fechaData)}>Fechar até esta data</button>
          {fechadoAte && <button className="fx-btn" onClick={() => setFechamento(null)}>Reabrir (limpar)</button>}
        </div>
      </Block>

      <Block title="Gestor por área">
        {areas.map((a) => {
          const gs = config.filter((c) => c.role === "gestor" && c.spaceId === a.id);
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
              <span style={{ width: 150, fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
              <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {gs.map((g) => <Chip key={g.id} onX={() => rm(g.id)}>{mname(g.userId)}</Chip>)}
              </div>
              <select className="fx-input" defaultValue="" onChange={(e) => { if (e.target.value) { add("gestor", e.target.value, a.id); e.target.value = ""; } }} style={{ maxWidth: 200 }}>
                <option value="">+ adicionar gestor…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          );
        })}
        {areas.length === 0 && <p style={{ fontSize: 13, color: "var(--txt-faint)" }}>Sem áreas. Crie Espaços nesta empresa primeiro.</p>}
      </Block>

      <Block title="Financeiro (conferência)">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{fin.map((c) => <Chip key={c.id} onX={() => rm(c.id)}>{mname(c.userId)}</Chip>)}</div>
        <select className="fx-input" defaultValue="" onChange={(e) => { if (e.target.value) { add("financeiro", e.target.value); e.target.value = ""; } }} style={{ maxWidth: 240 }}>
          <option value="">+ adicionar financeiro…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Block>

      <Block title="Pagador (sócio)">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{pag.map((c) => <Chip key={c.id} onX={() => rm(c.id)}>{mname(c.userId)}</Chip>)}</div>
        <select className="fx-input" defaultValue="" onChange={(e) => { if (e.target.value) { add("pagador", e.target.value); e.target.value = ""; } }} style={{ maxWidth: 240 }}>
          <option value="">+ adicionar pagador…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Block>
    </div>
  );
}

/* ---------- UI helpers ---------- */
