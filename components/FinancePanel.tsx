"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Company = { id: string; name: string; modules: string };
type Area = { id: string; name: string; color: string };
type Member = { id: string; name: string; color: string; role: string };
type Credor = { id: string; nome: string; documento: string; tipo: string; pixKey?: string | null; categoriaPadrao?: string | null };
type Cfg = { id: string; role: string; spaceId: string | null; userId: string };
type Att = { id: string; filename: string; mime: string; size: number; tag: string | null };
type Step = { id: string; action: string; toStatus: string | null; note: string | null; userName: string | null; createdAt: string };
type Req = {
  id: string; code: number; kind: string; status: string; areaName: string; spaceId: string | null;
  descricao: string; valor: number; vencimento: string | null; formaPagamento: string | null;
  categoria: string | null; centroCusto: string | null; classeGerencial: string | null;
  docTipo: string | null; docNumero: string | null; recorrencia: string; cotacaoDispensa: boolean;
  contaOrigem: string | null; dataPagamento: string | null; recusaMotivo: string | null;
  solicitanteId: string | null; gestorId: string | null; financeiroId: string | null; pagadorId: string | null;
  credor?: { nome: string; documento: string } | null; _count?: { attachments: number };
};

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  solicitada: { label: "Solicitada", bg: "#f6e7cd", fg: "#b5781f" },
  aprovada_gestor: { label: "Aprovada (gestor)", bg: "#dde7f0", fg: "#274b6d" },
  conferida: { label: "Conferida (financeiro)", bg: "#e9ddf2", fg: "#7a3fa0" },
  paga: { label: "Paga", bg: "#d7ebe2", fg: "#0f6b50" },
  recusada: { label: "Recusada", bg: "#f3dcd8", fg: "#a8332c" },
  cancelada: { label: "Cancelada", bg: "#eee", fg: "#777" },
};
const CATS = ["Aluguel", "Condomínio", "IPTU", "Energia Elétrica", "Água", "Internet/Telefone", "Contabilidade", "Tecnologia/Software", "Marketing", "Aulas/Professores", "Coordenação", "Salários", "Prestador PJ", "Impostos (DAS/INSS/FGTS)", "Retirada de Sócios", "Manutenção", "Materiais/Insumos", "Reembolso", "Outros"];
const BRL = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export default function FinancePanel({ meId, isAdmin }: { meId: string; isAdmin: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [tab, setTab] = useState<string>("solicitar");
  const [areas, setAreas] = useState<Area[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [config, setConfig] = useState<Cfg[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; color: string }>>({});
  const [credores, setCredores] = useState<Credor[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const tabInit = useRef(false);

  useEffect(() => {
    fetch("/api/finance/companies").then((r) => r.json()).then((d) => {
      const cs: Company[] = (d.companies || []).filter((c: Company) => (c.modules || "").includes("financeiro"));
      setCompanies(cs);
      let saved = "";
      try { saved = localStorage.getItem("fx:company") || localStorage.getItem("fx:fin:company") || ""; } catch {}
      setCompanyId(cs.find((c) => c.id === saved)?.id || cs[0]?.id || "");
    });
  }, []);

  const loadAll = useCallback((cid: string) => {
    if (!cid) return;
    fetch(`/api/finance/areas?company=${cid}`).then((r) => r.json()).then((d) => setAreas(d.areas || []));
    fetch(`/api/finance/members?company=${cid}`).then((r) => r.json()).then((d) => setMembers(d.members || []));
    fetch(`/api/finance/config?company=${cid}`).then((r) => r.json()).then((d) => setConfig(d.config || []));
    fetch(`/api/finance/credores?company=${cid}`).then((r) => r.json()).then((d) => setCredores(d.credores || []));
  }, []);

  const loadRequests = useCallback((cid: string) => {
    if (!cid) return;
    fetch(`/api/finance/requests?company=${cid}`).then((r) => r.json()).then((d) => { setRequests(d.requests || []); setNames(d.names || {}); });
  }, []);

  useEffect(() => {
    if (!companyId) return;
    try { localStorage.setItem("fx:fin:company", companyId); } catch {}
    loadAll(companyId);
    loadRequests(companyId);
  }, [companyId, loadAll, loadRequests]);

  const myGestorAreas = config.filter((c) => c.role === "gestor" && c.userId === meId).map((c) => c.spaceId);
  const isFinanceiro = config.some((c) => c.role === "financeiro" && c.userId === meId);
  const isPagador = config.some((c) => c.role === "pagador" && c.userId === meId);
  const isApprover = isAdmin || myGestorAreas.length > 0 || isFinanceiro || isPagador;

  // Tela inicial por papel: aprovador cai em "Aprovações"; demais em "Solicitar".
  useEffect(() => {
    if (tabInit.current || config.length === 0) return;
    tabInit.current = true;
    if (isApprover) setTab("aprov");
  }, [config, isApprover]);

  function refresh() { loadRequests(companyId); loadAll(companyId); }

  function pendingOnMe(r: Req) {
    if (r.status === "solicitada") return isAdmin || myGestorAreas.includes(r.spaceId);
    if (r.status === "aprovada_gestor") return isAdmin || isFinanceiro;
    if (r.status === "conferida") return isAdmin || isPagador;
    return false;
  }
  const minhas = requests.filter((r) => r.solicitanteId === meId);
  const aprovacoes = requests.filter(pendingOnMe);
  const painel = statusFilter ? requests.filter((r) => r.status === statusFilter) : requests;
  const abertoTotal = requests.filter((r) => ["solicitada", "aprovada_gestor", "conferida"].includes(r.status)).reduce((s, r) => s + r.valor, 0);
  const pagoTotal = requests.filter((r) => r.status === "paga").reduce((s, r) => s + r.valor, 0);

  if (companies.length === 0) {
    return (
      <>
        <div className="fx-topbar"><div><div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Financeiro</div><div className="fx-title">Financeiro</div></div></div>
        <div className="fx-accent" />
        <div style={{ padding: 26, color: "var(--txt-soft)" }}>O módulo Financeiro não está habilitado para nenhuma empresa sua. Peça pro admin habilitar.</div>
      </>
    );
  }

  function RequestRow({ r, hint }: { r: Req; hint?: string }) {
    const st = STATUS[r.status] || STATUS.solicitada;
    const sol = r.solicitanteId ? names[r.solicitanteId] : null;
    return (
      <div onClick={() => setOpenId(r.id)} className="fx-hoverable" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", cursor: "pointer" }}>
        <span style={{ fontSize: 12, color: "var(--txt-faint)", fontVariantNumeric: "tabular-nums", width: 42 }}>#{r.code}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.descricao || "(sem descrição)"}</div>
          <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 2 }}>
            {r.kind === "reembolso" ? "Reembolso" : "Padrão"} · {r.areaName} · {r.credor?.nome || "—"} {sol ? `· por ${sol.name}` : ""}{hint ? ` · ${hint}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{BRL(r.valor)}</div>
          <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>vence {fmt(r.vencimento)}</div>
        </div>
        <span style={{ background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{st.label}</span>
      </div>
    );
  }

  const isTP = (companies.find((c) => c.id === companyId)?.name || "").toLowerCase().includes("tp");
  const sections: { k: string; l: string; soon?: boolean }[] = [
    { k: "solicitar", l: "Solicitar" },
    ...(isApprover ? [{ k: "aprov", l: "Aprovações" }] : []),
    ...(isAdmin || isFinanceiro ? [{ k: "painel", l: "Contas a Pagar" }] : []),
    { k: "cred", l: "Credores" },
    { k: "receber", l: "Contas a Receber", soon: true },
    { k: "categorias", l: "Categorias", soon: true },
    ...(isTP ? [{ k: "aulas", l: "Aulas Particulares", soon: true }] : []),
    { k: "relatorios", l: "Relatórios", soon: true },
    ...(isAdmin ? [{ k: "cfg", l: "Configuração" }] : []),
  ];
  const SOON: Record<string, string> = {
    receber: "Contas a Receber — mensalidades e títulos a receber, com régua de cobrança. Próxima fase.",
    categorias: "Plano de contas em árvore (Grupo → Categoria → Subcategoria), importado das suas planilhas. Próxima fase.",
    aulas: "Aulas Particulares — registro de aula gera conta a receber (aluno) + conta a pagar (professor) pela tabela de valores. Só TP. Próxima fase.",
    relatorios: "Relatórios — DRE por centro de custo / classe gerencial, aging e dashboard. Próxima fase.",
  };

  return (
    <>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Financeiro · Portal de Solicitações</div>
          <div className="fx-title">Pagamentos</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <select className="fx-input" value={companyId} onChange={(e) => { setOpenId(null); setCompanyId(e.target.value); }}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fx-accent" />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <nav style={{ width: 196, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "12px 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt-faint)", padding: "4px 10px 8px" }}>Financeiro</div>
          {sections.map((s) => (
            <button
              key={s.k}
              onClick={() => setTab(s.k)}
              className="fx-navitem"
              style={{ width: "100%", fontSize: 13.5, fontWeight: tab === s.k ? 700 : 400, background: tab === s.k ? "rgba(146,80,172,.12)" : "none", color: tab === s.k ? "var(--txt)" : "var(--txt-soft)" }}
            >
              <span style={{ flex: 1, textAlign: "left" }}>{s.l}</span>
              {s.soon && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--txt-faint)", background: "var(--col)", borderRadius: 999, padding: "1px 6px" }}>em breve</span>}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px 48px", minWidth: 0 }}>
        {tab === "solicitar" && (
          <>
            <button className="fx-btn fx-btn-primary" onClick={() => setShowNew(true)} style={{ marginBottom: 16 }}>+ Nova solicitação</button>
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 10 }}>Minhas solicitações</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {minhas.map((r) => <RequestRow key={r.id} r={r} />)}
              {minhas.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Você ainda não abriu nenhuma solicitação. Clique em “+ Nova solicitação”.</p>}
            </div>
          </>
        )}

        {tab === "aprov" && (
          <>
            <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 12 }}>Esperando você aprovar / conferir / pagar:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aprovacoes.map((r) => {
                const hint = r.status === "solicitada" ? "aprovar (gestor)" : r.status === "aprovada_gestor" ? "conferir (financeiro)" : "pagar (você)";
                return <RequestRow key={r.id} r={r} hint={hint} />;
              })}
              {aprovacoes.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nada esperando você. 🎉</p>}
            </div>
          </>
        )}

        {tab === "painel" && (isAdmin || isFinanceiro) && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <Metric label="Em aberto" value={BRL(abertoTotal)} />
              <Metric label="Pago (total)" value={BRL(pagoTotal)} />
              <Metric label="Solicitações" value={String(requests.length)} />
            </div>
            <select className="fx-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220, marginBottom: 14 }}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {painel.map((r) => <RequestRow key={r.id} r={r} />)}
              {painel.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma solicitação.</p>}
            </div>
          </>
        )}

        {tab === "cred" && <CredoresTab companyId={companyId} credores={credores} reload={() => loadAll(companyId)} />}
        {tab === "cfg" && isAdmin && <ConfigTab companyId={companyId} areas={areas} members={members} config={config} reload={() => loadAll(companyId)} />}
        {SOON[tab] && (
          <div style={{ border: "1.5px dashed var(--line)", borderRadius: "var(--r-card)", padding: 28, textAlign: "center", color: "var(--txt-faint)", maxWidth: 560 }}>
            {SOON[tab]}
          </div>
        )}
        </div>
      </div>

      {showNew && (
        <NewRequest companyId={companyId} areas={areas} credores={credores} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refresh(); }} reloadCred={() => loadAll(companyId)} />
      )}
      {openId && (
        <RequestDetail
          id={openId} meId={meId} isAdmin={isAdmin} members={members} names={names}
          canGestor={(sp) => isAdmin || myGestorAreas.includes(sp)} canFin={isAdmin || isFinanceiro} canPag={isAdmin || isPagador}
          onClose={() => setOpenId(null)} onChanged={refresh}
        />
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--col)", borderRadius: "var(--r-card)", padding: "12px 18px", minWidth: 130 }}>
      <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ---------- Nova solicitação ---------- */
function NewRequest({ companyId, areas, credores, onClose, onCreated, reloadCred }: { companyId: string; areas: Area[]; credores: Credor[]; onClose: () => void; onCreated: () => void; reloadCred: () => void }) {
  const [kind, setKind] = useState("padrao");
  const [spaceId, setSpaceId] = useState("");
  const [credorId, setCredorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [forma, setForma] = useState("pix");
  const [categoria, setCategoria] = useState("");
  const [recorrencia, setRecorrencia] = useState("unica");
  const [docNumero, setDocNumero] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    const area = areas.find((a) => a.id === spaceId);
    if (!area) return setErr("Escolha a área.");
    if (!descricao.trim()) return setErr("Descreva a solicitação.");
    if (!Number(valor)) return setErr("Informe o valor.");
    setBusy(true);
    const res = await fetch("/api/finance/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, kind, spaceId, areaName: area.name, credorId: credorId || null, descricao, valor: Number(valor), vencimento: vencimento || null, formaPagamento: forma, categoria: categoria || null, recorrencia, docNumero: docNumero || null }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) onCreated(); else setErr(d.error || "Erro ao criar.");
  }

  return (
    <Drawer title="Nova solicitação de pagamento" onClose={onClose}>
      <Row><Field label="Tipo"><select className="fx-input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="padrao">Padrão (compra/serviço)</option><option value="reembolso">Reembolso</option></select></Field>
        <Field label="Área*"><select className="fx-input" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}><option value="">Selecione…</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></Row>
      <Field label="Credor / Favorecido"><select className="fx-input" value={credorId} onChange={(e) => setCredorId(e.target.value)}><option value="">— selecione ou cadastre na aba Credores —</option>{credores.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.documento}</option>)}</select></Field>
      <Field label="Descrição / justificativa*"><textarea className="fx-input" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
      <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Field label="Vencimento"><input className="fx-input" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field></Row>
      <Row><Field label="Forma de pagamento"><select className="fx-input" value={forma} onChange={(e) => setForma(e.target.value)}><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="guia">Guia/DARF</option><option value="cartao">Cartão</option></select></Field>
        <Field label="Recorrência"><select className="fx-input" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)}><option value="unica">Única</option><option value="mensal">Mensal</option></select></Field></Row>
      <Row><Field label="Categoria (sugerida)"><select className="fx-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">—</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Nº documento / NF"><input className="fx-input" value={docNumero} onChange={(e) => setDocNumero(e.target.value)} /></Field></Row>
      <p style={{ fontSize: 12, color: "var(--txt-faint)", margin: "4px 0 0" }}>Acima de R$ 400 (padrão), o gestor vai exigir cotações ou dispensa. Anexos (NF, comprovante, cotação) você adiciona depois de criar, abrindo a solicitação.</p>
      {err && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="fx-btn fx-btn-primary" disabled={busy} onClick={submit}>Enviar solicitação</button>
        <button className="fx-btn" onClick={onClose}>Cancelar</button>
      </div>
    </Drawer>
  );
}

/* ---------- Detalhe + ações de etapa ---------- */
function RequestDetail({ id, meId, isAdmin, members, names, canGestor, canFin, canPag, onClose, onChanged }: {
  id: string; meId: string; isAdmin: boolean; members: Member[]; names: Record<string, { name: string; color: string }>;
  canGestor: (sp: string | null) => boolean; canFin: boolean; canPag: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [r, setR] = useState<Req | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [nm, setNm] = useState<Record<string, { name: string; color: string }>>(names);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState(""); const [cc, setCc] = useState(""); const [cg, setCg] = useState("");
  const [conta, setConta] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState("nf");

  const load = useCallback(() => {
    fetch(`/api/finance/requests/${id}`).then((x) => x.json()).then((d) => {
      if (!d.request) return;
      setR(d.request); setSteps(d.request.steps || []); setAtts(d.request.attachments || []); setNm(d.names || {});
      setCat(d.request.categoria || ""); setCc(d.request.centroCusto || ""); setCg(d.request.classeGerencial || ""); setConta(d.request.contaOrigem || "");
    });
  }, [id]);
  useEffect(load, [load]);

  async function act(action: string, extra: any = {}) {
    setErr(""); setBusy(true);
    const res = await fetch(`/api/finance/requests/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: note || null, ...extra }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setNote(""); load(); onChanged(); } else setErr(d.error || "Erro.");
  }
  async function upload(f: File) {
    const fd = new FormData(); fd.append("file", f); fd.append("tag", tag);
    await fetch(`/api/finance/requests/${id}/upload`, { method: "POST", body: fd });
    load();
  }

  if (!r) return <Drawer title="Solicitação" onClose={onClose}><p style={{ color: "var(--txt-faint)" }}>Carregando…</p></Drawer>;
  const st = STATUS[r.status] || STATUS.solicitada;
  const person = (uid: string | null) => (uid && nm[uid]?.name) || "—";

  return (
    <Drawer title={`Solicitação #${r.code}`} onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 700, padding: "3px 11px", borderRadius: 999 }}>{st.label}</span>
        <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{r.kind === "reembolso" ? "Reembolso" : "Padrão"} · {r.areaName}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 2 }}>{BRL(r.valor)}</div>
      <div style={{ fontSize: 14, marginBottom: 12 }}>{r.descricao}</div>

      <Esteira status={r.status} />

      <Grid2>
        <Info label="Credor">{r.credor?.nome || "—"}{r.credor?.documento ? ` · ${r.credor.documento}` : ""}</Info>
        <Info label="Vencimento">{fmt(r.vencimento)}</Info>
        <Info label="Forma">{r.formaPagamento || "—"}</Info>
        <Info label="Recorrência">{r.recorrencia === "mensal" ? "Mensal" : "Única"}</Info>
        <Info label="Categoria">{r.categoria || "—"}</Info>
        <Info label="Centro de custo">{r.centroCusto || "—"}</Info>
        <Info label="Classe gerencial">{r.classeGerencial || "—"}</Info>
        <Info label="Nº documento">{r.docNumero || "—"}</Info>
        <Info label="Solicitante">{person(r.solicitanteId)}</Info>
        <Info label="Conta origem">{r.contaOrigem || "—"}</Info>
      </Grid2>

      {/* Anexos */}
      <Section title="Documentos">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <select className="fx-input" value={tag} onChange={(e) => setTag(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="nf">NF</option><option value="boleto">Boleto</option><option value="comprovante">Comprovante</option><option value="cotacao">Cotação</option><option value="outro">Outro</option>
          </select>
          <button className="fx-btn" onClick={() => fileRef.current?.click()}>📎 Anexar</button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {atts.map((a) => (
            <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, padding: "5px 10px", border: "1px solid var(--line)", borderRadius: 8, textDecoration: "none", color: "var(--txt)", background: "var(--col)" }}>
              {a.tag ? `[${a.tag}] ` : ""}{a.filename}
            </a>
          ))}
          {atts.length === 0 && <span style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>Nenhum documento anexado.</span>}
        </div>
      </Section>

      {/* Ações por etapa */}
      {err && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>{err}</p>}
      {r.status === "solicitada" && canGestor(r.spaceId) && (
        <Section title="Aprovação do gestor — classifique e aprove">
          <Grid2>
            <Field label="Categoria*"><select className="fx-input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">—</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Centro de Custo*"><input className="fx-input" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="ex.: Cursinho / Obra / Marketing" /></Field>
            <Field label="Classe Gerencial (DRE)*"><input className="fx-input" value={cg} onChange={(e) => setCg(e.target.value)} placeholder="ex.: Despesa fixa / variável" /></Field>
          </Grid2>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="fx-btn fx-btn-primary" disabled={busy} onClick={() => act("aprovar_gestor", { categoria: cat, centroCusto: cc, classeGerencial: cg })}>Aprovar e enviar ao financeiro</button>
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={() => act("recusar")}>Recusar</button>
          </div>
        </Section>
      )}
      {r.status === "aprovada_gestor" && canFin && (
        <Section title="Conferência do financeiro">
          <Field label="Conta de origem (de qual conta sai)"><input className="fx-input" value={conta} onChange={(e) => setConta(e.target.value)} placeholder="ex.: Inter PJ / Cora" /></Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="fx-btn fx-btn-primary" disabled={busy} onClick={() => act("conferir", { contaOrigem: conta })}>Conferir e enviar ao pagador</button>
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={() => act("recusar")}>Recusar</button>
          </div>
        </Section>
      )}
      {r.status === "conferida" && canPag && (
        <Section title="Pagamento (sócio)">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fx-btn fx-btn-primary" disabled={busy} onClick={() => act("pagar")}>Marcar como PAGO</button>
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={() => act("recusar")}>Recusar</button>
          </div>
        </Section>
      )}
      {(r.status === "solicitada" || r.status === "aprovada_gestor" || r.status === "conferida") && (
        <Field label="Observação (opcional, vai no histórico)"><input className="fx-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      )}
      {r.status === "recusada" && r.recusaMotivo && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>Motivo da recusa: {r.recusaMotivo}</p>}

      {/* Histórico */}
      <Section title="Histórico">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {steps.map((s) => (
            <div key={s.id} style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>
              <b>{s.userName || "—"}</b> · {s.action}{s.note ? ` — ${s.note}` : ""} <span style={{ color: "var(--txt-faint)" }}>· {new Date(s.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </Section>
    </Drawer>
  );
}

function Esteira({ status }: { status: string }) {
  const stages = ["solicitada", "aprovada_gestor", "conferida", "paga"];
  const labels = ["Solicitada", "Gestor", "Financeiro", "Pago"];
  const failed = status === "recusada" || status === "cancelada";
  const idx = stages.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0 14px" }}>
      {labels.map((l, i) => {
        const done = !failed && idx >= i;
        return (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: done ? "var(--sage)" : "var(--col)", color: done ? "#fff" : "var(--txt-faint)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{done ? "✓" : i + 1}</span>
              <span style={{ fontSize: 12, color: done ? "var(--txt)" : "var(--txt-faint)", fontWeight: done ? 600 : 400 }}>{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 2, background: !failed && idx > i ? "var(--sage)" : "var(--line)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Credores ---------- */
function CredoresTab({ companyId, credores, reload }: { companyId: string; credores: Credor[]; reload: () => void }) {
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
function ConfigTab({ companyId, areas, members, config, reload }: { companyId: string; areas: Area[]; members: Member[]; config: Cfg[]; reload: () => void }) {
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
function Drawer({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.32)", zIndex: 60, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: wide ? 560 : 460, maxWidth: "94vw", background: "var(--bg)", height: "100%", overflowY: "auto", padding: "20px 22px", boxShadow: "-12px 0 40px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--txt-faint)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ flex: 1, minWidth: 150, marginBottom: 10 }}><div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 4 }}>{label}</div>{children}</div>; }
function Grid2({ children }: { children: React.ReactNode }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", margin: "6px 0 12px" }}>{children}</div>; }
function Info({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ padding: "5px 0", borderBottom: "1px solid var(--line)" }}><div style={{ fontSize: 11, color: "var(--txt-faint)" }}>{label}</div><div style={{ fontSize: 13.5 }}>{children}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}><div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 10 }}>{title}</div>{children}</div>; }
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16 }}><div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{title}</div>{children}</div>; }
function Chip({ children, onX }: { children: React.ReactNode; onX: () => void }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--col)", borderRadius: 999, padding: "3px 6px 3px 11px", fontSize: 12.5 }}>{children}<button onClick={onX} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 14 }}>×</button></span>; }
