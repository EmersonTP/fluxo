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
  prazoPagamento: string | null; prioridade: string | null; observacao: string | null;
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
  const [flash, setFlash] = useState("");
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const tabInit = useRef(false);

  useEffect(() => {
    fetch("/api/finance/companies").then((r) => r.json()).then((d) => {
      const cs: Company[] = (d.companies || []).filter((c: Company) => (c.modules || "").includes("financeiro"));
      setCompanies(cs);
      let saved = "";
      try { saved = localStorage.getItem("fx:company") || localStorage.getItem("fx:fin:company") || ""; } catch {}
      setCompanyId(cs.find((c) => c.id === saved)?.id || cs[0]?.id || "");
    }).finally(() => setCompaniesLoaded(true));
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
    if (tabInit.current) return;
    if (config.length === 0 && !isAdmin) return;
    tabInit.current = true;
    if (isAdmin || isFinanceiro) setTab("home");
    else if (isApprover) setTab("aprov");
  }, [config, isApprover, isAdmin]);

  function refresh() { loadRequests(companyId); loadAll(companyId); }

  const [acting, setActing] = useState<string | null>(null);
  async function actOn(id: string, action: string, extra: Record<string, unknown> = {}) {
    setActing(id);
    await fetch(`/api/finance/requests/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }).catch(() => {});
    setActing(null);
    refresh();
  }

  function pendingOnMe(r: Req) {
    if (r.status === "solicitada") return isAdmin || myGestorAreas.includes(r.spaceId);
    if (r.status === "aprovada_gestor") return isAdmin || isFinanceiro;
    if (r.status === "conferida") return isAdmin || isPagador;
    return false;
  }
  const minhas = requests.filter((r) => r.solicitanteId === meId);
  const aprovacoes = requests.filter(pendingOnMe);
  const painel = statusFilter ? requests.filter((r) => r.status === statusFilter) : requests;
  const emAberto = requests.filter((r) => ["solicitada", "aprovada_gestor", "conferida"].includes(r.status));
  const abertoTotal = emAberto.reduce((s, r) => s + r.valor, 0);
  const pagoTotal = requests.filter((r) => r.status === "paga").reduce((s, r) => s + r.valor, 0);
  const hojeYMD = new Date().toISOString().slice(0, 10);
  const mesAtual = hojeYMD.slice(0, 7);
  const vencidasTotal = emAberto.filter((r) => r.vencimento && r.vencimento.slice(0, 10) < hojeYMD).reduce((s, r) => s + r.valor, 0);
  const pagoMesTotal = requests.filter((r) => r.status === "paga" && (r.dataPagamento || "").slice(0, 7) === mesAtual).reduce((s, r) => s + r.valor, 0);
  const porGrupo = Object.entries(
    emAberto.reduce((acc: Record<string, number>, r) => {
      const g = (r.categoria || "Sem categoria").split(" › ")[0];
      acc[g] = (acc[g] || 0) + r.valor;
      return acc;
    }, {})
  ).map(([grupo, total]) => ({ grupo, total })).sort((a, b) => b.total - a.total).slice(0, 8);

  if (companies.length === 0) {
    return (
      <>
        <div className="fx-topbar"><div><div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Financeiro</div><div className="fx-title">Financeiro</div></div></div>
        <div className="fx-accent" />
        <div style={{ padding: 26, color: "var(--txt-soft)" }}>{companiesLoaded ? "O módulo Financeiro não está habilitado para nenhuma empresa sua. Peça pro admin habilitar." : "Carregando…"}</div>
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
  type NavItem = { k: string; l: string; soon?: boolean };
  const af = isAdmin || isFinanceiro;
  const groups: { g: string; items: NavItem[] }[] = [
    ...(af ? [{ g: "", items: [{ k: "home", l: "Visão geral" }] as NavItem[] }] : []),
    { g: "Operação", items: [
      { k: "solicitar", l: "Solicitar" },
      ...(isApprover ? [{ k: "aprov", l: "Aprovações" }] : []),
      ...(af ? [{ k: "painel", l: "Contas a Pagar" }] : []),
      ...(af ? [{ k: "receber", l: "Contas a Receber" }] : []),
    ] },
    { g: "Relatórios", items: [
      ...(af ? [{ k: "fluxo", l: "Fluxo de Caixa" }] : []),
      ...(af ? [{ k: "dre", l: "DRE" }] : []),
      ...(af ? [{ k: "gestao", l: "Gestão" }] : []),
      { k: "relatorios", l: "Relatórios", soon: true },
    ] },
    { g: "Cadastros", items: [
      ...(af ? [{ k: "contas", l: "Contas Bancárias" }] : []),
      ...(af ? [{ k: "categorias", l: "Categorias" }] : []),
      ...(af ? [{ k: "cred", l: "Credores" }] : []),
      ...(isTP ? [{ k: "aulas", l: "Aulas Particulares", soon: true }] : []),
    ] },
    { g: "Sistema", items: [
      ...(isAdmin ? [{ k: "saude", l: "Saúde" }] : []),
      ...(isAdmin ? [{ k: "conciliar", l: "Conciliação" }] : []),
      ...(isAdmin ? [{ k: "seguranca", l: "Segurança & LGPD" }] : []),
      ...(isAdmin ? [{ k: "cfg", l: "Configuração" }] : []),
    ] },
  ];
  const SOON: Record<string, string> = {
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
          {groups.filter((gr) => gr.items.length > 0).map((gr) => (
            <div key={gr.g || "_top"} style={{ marginBottom: 4 }}>
              {gr.g && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--txt-faint)", padding: "10px 10px 3px", fontWeight: 700 }}>{gr.g}</div>}
              {gr.items.map((s) => (
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
            </div>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px 48px", minWidth: 0 }}>
        {flash && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "11px 15px", fontSize: 13.5, fontWeight: 500, marginBottom: 16 }}>{flash}</div>}
        {tab === "home" && (isAdmin || isFinanceiro) && <HomeTab companyId={companyId} go={setTab} />}
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

        {tab === "aprov" && (() => {
          const grupos = [
            { key: "solicitada", label: "Aguardando sua aprovação (gestor)", cor: "#274b6d", acao: null as null | "conferir" | "pagar", botao: "Revisar e aprovar" },
            { key: "aprovada_gestor", label: "Aguardando sua conferência (financeiro)", cor: "#7a3fa0", acao: "conferir" as const, botao: "Conferir" },
            { key: "conferida", label: "Aguardando seu pagamento (pagador)", cor: "#0f6b50", acao: "pagar" as const, botao: "Marcar como pago" },
          ];
          const totalGeral = aprovacoes.reduce((s, r) => s + r.valor, 0);
          return (
            <>
              <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 16 }}>
                Esperando você: <b>{aprovacoes.length}</b>{aprovacoes.length > 0 ? ` · ${BRL(totalGeral)}` : ""}. Só aparece o que precisa de uma ação sua.
              </div>
              {aprovacoes.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nada esperando você. 🎉</p>}
              {grupos.map((g) => {
                const itens = aprovacoes.filter((r) => r.status === g.key);
                if (itens.length === 0) return null;
                const soma = itens.reduce((s, r) => s + r.valor, 0);
                return (
                  <div key={g.key} style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: g.cor }}>{g.label}</span>
                      <span style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{itens.length} · {BRL(soma)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {itens.map((r) => {
                        const late = r.vencimento && r.vencimento.slice(0, 10) < hojeYMD;
                        const temNF = (r._count?.attachments || 0) > 0;
                        return (
                          <div key={r.id} className="fx-hoverable" onClick={() => setOpenId(r.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${g.cor}`, borderRadius: "var(--r-card)", padding: "11px 14px", cursor: "pointer" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>#{r.code}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.descricao || "(sem descrição)"}</span>
                                {r.prioridade === "urgente" && <span style={{ fontSize: 10, fontWeight: 700, color: "#a8332c", background: "#f3dcd8", borderRadius: 999, padding: "1px 7px" }}>urgente</span>}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <span>{r.areaName}{r.credor?.nome ? ` · ${r.credor.nome}` : ""}</span>
                                <span style={{ color: late ? "#a8332c" : "var(--txt-faint)", fontWeight: late ? 700 : 400 }}>{r.vencimento ? `${late ? "venceu" : "vence"} ${fmt(r.vencimento)}` : "sem vencimento"}</span>
                                <span style={{ color: temNF ? "#0f6b50" : "#a8332c" }}>{temNF ? "✓ anexo" : "! sem anexo"}</span>
                              </div>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>{BRL(r.valor)}</span>
                            <span style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              {g.acao ? (
                                <button className="fx-btn fx-btn-primary" disabled={acting === r.id} onClick={() => actOn(r.id, g.acao!)} style={{ fontSize: 12.5 }}>{acting === r.id ? "..." : g.botao}</button>
                              ) : (
                                <button className="fx-btn fx-btn-primary" onClick={() => setOpenId(r.id)} style={{ fontSize: 12.5 }}>{g.botao}</button>
                              )}
                              <button className="fx-btn" onClick={() => setOpenId(r.id)} style={{ fontSize: 12.5 }}>Abrir</button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}

        {tab === "painel" && (isAdmin || isFinanceiro) && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <Metric label="Em aberto" value={BRL(abertoTotal)} />
              <Metric label="Vencidas" value={BRL(vencidasTotal)} tone={vencidasTotal > 0 ? "alert" : undefined} />
              <Metric label="Pago no mês" value={BRL(pagoMesTotal)} />
              <Metric label="Pago (total)" value={BRL(pagoTotal)} />
            </div>
            {porGrupo.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Em aberto por grupo</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {porGrupo.map((g) => (
                    <div key={g.grupo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12.5, color: "var(--txt-soft)", width: 220, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.grupo}</span>
                      <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--col)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${Math.max(4, (g.total / porGrupo[0].total) * 100)}%`, background: "var(--roxo)" }} />
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, width: 110, textAlign: "right", flexShrink: 0 }}>{BRL(g.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

        {tab === "gestao" && (isAdmin || isFinanceiro) && <GestaoTab companyId={companyId} />}
        {tab === "contas" && (isAdmin || isFinanceiro) && <ContasTab companyId={companyId} isAdmin={isAdmin} />}
        {tab === "fluxo" && (isAdmin || isFinanceiro) && <FluxoCaixaTab companyId={companyId} isAdmin={isAdmin} />}
        {tab === "conciliar" && isAdmin && <ConciliacaoTab companyId={companyId} />}
        {tab === "dre" && (isAdmin || isFinanceiro) && <DreTab companyId={companyId} />}
        {tab === "saude" && isAdmin && <SaudeTab companyId={companyId} />}
        {tab === "seguranca" && isAdmin && <SegurancaTab companyId={companyId} />}
        {tab === "categorias" && <CategoriasTab companyId={companyId} isAdmin={isAdmin} />}
        {tab === "receber" && <ContasReceber companyId={companyId} isAdmin={isAdmin} />}
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
        <NewRequest companyId={companyId} areas={areas} credores={credores} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refresh(); setFlash("Solicitação enviada ✓ — você e o gestor da área foram avisados."); setTimeout(() => setFlash(""), 4500); }} reloadCred={() => loadAll(companyId)} />
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

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "alert" }) {
  const alert = tone === "alert";
  return (
    <div style={{ background: alert ? "#f3dcd8" : "var(--col)", borderRadius: "var(--r-card)", padding: "12px 18px", minWidth: 130 }}>
      <div style={{ fontSize: 12, color: alert ? "#a8332c" : "var(--txt-faint)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2, color: alert ? "#a8332c" : "var(--txt)" }}>{value}</div>
    </div>
  );
}

/* ---------- Categorias (plano de contas) ---------- */
function CategoriasTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
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
function ContasReceber({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [sub, setSub] = useState<"titulos" | "memberships" | "cobranca">("titulos");
  const subs = [["titulos", "Títulos"], ["memberships", "Memberships"], ["cobranca", "Cobrança (gateway)"]] as const;
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {subs.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className="fx-btn" style={{ fontWeight: sub === k ? 700 : 400, background: sub === k ? "rgba(146,80,172,.12)" : "var(--surface)" }}>{l}</button>
        ))}
      </div>
      {sub === "titulos" && <TitulosTab companyId={companyId} isAdmin={isAdmin} />}
      {sub === "memberships" && <MembershipsTab companyId={companyId} isAdmin={isAdmin} />}
      {sub === "cobranca" && <CobrancaGateway companyId={companyId} isAdmin={isAdmin} />}
    </>
  );
}

/* ---------- Títulos a receber (livro) ---------- */
function TitulosTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  type Tit = { id: string; descricao: string; valor: number; status: string; metodo: string | null; vencimento: string | null; pagoEm: string | null; origem: string; provider: string; cliente: string | null; recorrente: boolean };
  const [list, setList] = useState<Tit[]>([]);
  const [resumo, setResumo] = useState({ aReceber: 0, vencido: 0, recebidoMes: 0 });
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ descricao: "", valor: "", vencimento: "", clienteId: "", metodo: "" });
  const [open, setOpen] = useState(false);
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/receber?company=${companyId}`).then((r) => r.json()).then((d) => { setList(d.recebiveis || []); setResumo(d.resumo || { aReceber: 0, vencido: 0, recebidoMes: 0 }); }).finally(() => setLoading(false));
    fetch(`/api/finance/clientes?company=${companyId}`).then((r) => r.json()).then((d) => setClientes(d.clientes || []));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function lancar() {
    if (!form.descricao.trim() || !Number(form.valor)) return;
    await fetch("/api/finance/receber", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...form, valor: Number(form.valor) }) });
    setForm({ descricao: "", valor: "", vencimento: "", clienteId: "", metodo: "" }); setOpen(false); load();
  }
  async function acao(id: string, action: string) {
    if (action === "delete") { if (!confirm("Excluir este título?")) return; await fetch(`/api/finance/receber/${id}`, { method: "DELETE" }); }
    else await fetch(`/api/finance/receber/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }
  const tone = (s: string) => s === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50", l: "Recebido" } : s === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c", l: "Vencido" } : s === "cancelada" ? { bg: "var(--line)", fg: "var(--txt-faint)", l: "Cancelado" } : { bg: "#f6e7cd", fg: "#b5781f", l: "A receber" };
  const shown = filtro ? list.filter((r) => r.status === filtro) : list;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {([["A receber", resumo.aReceber, "#b5781f"], ["Vencido", resumo.vencido, "#a8332c"], ["Recebido no mês", resumo.recebidoMes, "#0f6b50"]] as const).map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, minWidth: 150, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{money(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select className="fx-input" style={{ maxWidth: 180 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos os status</option><option value="pendente">A receber</option><option value="vencida">Vencidos</option><option value="paga">Recebidos</option><option value="cancelada">Cancelados</option>
        </select>
        {isAdmin && <button className="fx-btn fx-btn-primary" onClick={() => setOpen(!open)}>{open ? "Fechar" : "+ Lançar título"}</button>}
      </div>

      {open && isAdmin && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, marginBottom: 16, maxWidth: 760 }}>
          <Row><Field label="Descrição*"><input className="fx-input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: Sessão avulsa — João" /></Field>
            <Field label="Valor (R$)*"><input className="fx-input" type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field></Row>
          <Row><Field label="Vencimento"><input className="fx-input" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
            <Field label="Cliente"><select className="fx-input" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}><option value="">— opcional —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label="Método"><select className="fx-input" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}><option value="">—</option><option value="pix">Pix</option><option value="bank_slip">Boleto</option><option value="credit_card">Cartão</option></select></Field></Row>
          <button className="fx-btn fx-btn-primary" disabled={!form.descricao.trim() || !Number(form.valor)} onClick={lancar}>Lançar</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
        {!loading && shown.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum título. Lance um avulso ou gere os das memberships na aba Memberships.</p>}
        {shown.map((r) => { const t = tone(r.status); return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.descricao} {r.recorrente && <span style={{ fontSize: 10, fontWeight: 700, color: "#7a4fb0", background: "rgba(146,80,172,.12)", borderRadius: 999, padding: "1px 7px" }}>membership</span>}</div>
              <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{r.cliente ? r.cliente + " · " : ""}{r.vencimento ? "vence " + new Date(r.vencimento).toLocaleDateString("pt-BR") : "sem vencimento"}{r.pagoEm ? " · recebido " + new Date(r.pagoEm).toLocaleDateString("pt-BR") : ""}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(r.valor)}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: "2px 10px" }}>{t.l}</span>
            {isAdmin && r.status !== "paga" && r.status !== "cancelada" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => acao(r.id, "receber")}>Receber</button>}
            {isAdmin && r.status === "paga" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => acao(r.id, "reabrir")}>Reabrir</button>}
            {isAdmin && r.provider === "manual" && r.status !== "paga" && <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => acao(r.id, "delete")}>Excluir</button>}
          </div>
        ); })}
      </div>
      <p style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 14, maxWidth: 700 }}>“Receber” marca o título como recebido. A conciliação automática com a entrada no extrato entra junto da tela de Conciliação.</p>
    </>
  );
}

/* ---------- Memberships (planos + assinaturas) ---------- */
function MembershipsTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  type Plano = { id: string; nome: string; valor: number; intervalo: number; intervaloTipo: string; ativo: boolean; assinaturas: number };
  type Assin = { id: string; status: string; proximaCobranca: string | null; cliente: string; plano: string; valor: number };
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assin, setAssin] = useState<Assin[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string; documento?: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [np, setNp] = useState({ nome: "", valor: "" });
  const [nc, setNc] = useState({ nome: "", email: "", documento: "", rg: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", consentimentoLGPD: false });
  const [docsCli, setDocsCli] = useState<string>("");
  const [docs, setDocs] = useState<any[]>([]);
  const [docTipo, setDocTipo] = useState("contrato");
  const [docMsg, setDocMsg] = useState("");
  const [na, setNa] = useState({ clienteId: "", planoId: "", proximaCobranca: "", valor: "", diaCobranca: "" });
  const [links, setLinks] = useState<{ id: string; token: string; label: string | null; ativo: boolean; usos: number; plano: string; valor: number }[]>([]);
  const [nl, setNl] = useState({ planoId: "", valor: "", diaCobranca: "", label: "" });
  const [copiado, setCopiado] = useState("");
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    fetch(`/api/finance/planos?company=${companyId}`).then((r) => r.json()).then((d) => setPlanos(d.planos || []));
    fetch(`/api/finance/assinaturas?company=${companyId}`).then((r) => r.json()).then((d) => setAssin(d.assinaturas || []));
    fetch(`/api/finance/clientes?company=${companyId}`).then((r) => r.json()).then((d) => setClientes(d.clientes || []));
    fetch(`/api/finance/onboarding-links?company=${companyId}`).then((r) => r.json()).then((d) => setLinks(d.links || []));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function addPlano() { if (!np.nome.trim() || !Number(np.valor)) return; await fetch("/api/finance/planos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, nome: np.nome, valor: Number(np.valor) }) }); setNp({ nome: "", valor: "" }); load(); }
  async function delPlano(id: string) { if (!confirm("Excluir plano?")) return; await fetch(`/api/finance/planos?id=${id}`, { method: "DELETE" }); load(); }
  async function abrirDocs(id: string) { if (docsCli === id) { setDocsCli(""); return; } setDocsCli(id); setDocs([]); const d = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${id}`).then((r) => r.json()); setDocs(d.documentos || []); }
  async function subirDoc(id: string, file: File) {
    setDocMsg("Enviando…");
    const b64: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    const r = await fetch("/api/finance/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, clienteId: id, tipo: docTipo, filename: file.name, mime: file.type, base64: b64 }) });
    const d = await r.json(); setDocMsg(r.ok ? "Enviado." : (d.error || "Erro."));
    const dd = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${id}`).then((x) => x.json()); setDocs(dd.documentos || []);
  }
  async function delDoc(docId: string, cliId: string) { if (!confirm("Excluir documento?")) return; await fetch(`/api/finance/documentos/${docId}`, { method: "DELETE" }); const dd = await fetch(`/api/finance/documentos?company=${companyId}&cliente=${cliId}`).then((x) => x.json()); setDocs(dd.documentos || []); }
  async function addCliente() { if (!nc.nome.trim()) return; await fetch("/api/finance/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...nc }) }); setNc({ nome: "", email: "", documento: "", rg: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", consentimentoLGPD: false }); load(); }
  async function addAssin() { if (!na.clienteId || !na.planoId) return; await fetch("/api/finance/assinaturas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...na }) }); setNa({ clienteId: "", planoId: "", proximaCobranca: "", valor: "", diaCobranca: "" }); load(); }
  async function delCliente(id: string) { if (!confirm("Excluir cliente? (precisa não ter títulos a receber)")) return; const r = await fetch(`/api/finance/clientes?id=${id}`, { method: "DELETE" }); if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error || "Erro ao excluir."); } load(); }
  async function cancelAssin(id: string) { if (!confirm("Cancelar assinatura?")) return; await fetch(`/api/finance/assinaturas?id=${id}`, { method: "DELETE" }); load(); }
  async function addLink() { if (!nl.planoId) return; await fetch("/api/finance/onboarding-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...nl }) }); setNl({ planoId: "", valor: "", diaCobranca: "", label: "" }); load(); }
  async function delLink(id: string) { if (!confirm("Desativar este link?")) return; await fetch(`/api/finance/onboarding-links?id=${id}`, { method: "DELETE" }); load(); }
  function linkUrl(token: string) { return `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro/${token}`; }
  async function copiar(token: string) { try { await navigator.clipboard.writeText(linkUrl(token)); setCopiado(token); setTimeout(() => setCopiado(""), 1500); } catch { /* */ } }
  async function gerarMes() { setMsg("Gerando…"); const r = await fetch("/api/finance/receber/gerar-mes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }); const d = await r.json(); setMsg(r.ok ? `Gerados ${d.criados} títulos do mês (${d.pulados} já existiam/sem vencimento).` : (d.error || "Erro.")); }

  if (!isAdmin) return <p style={{ color: "var(--txt-faint)" }}>Apenas administradores gerenciam memberships.</p>;
  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 16, maxWidth: 720 }}><b>Memberships (recorrente).</b> Cada cliente vira uma assinatura de um plano. No início do mês você gera os títulos a receber de todas as assinaturas ativas com um clique.</div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14, maxWidth: 640 }}>{msg}</div>}
      <button className="fx-btn fx-btn-primary" onClick={gerarMes} style={{ marginBottom: 18 }}>Gerar títulos do mês</button>

      <Section title="Link de cadastro (paciente se cadastra sozinho)">
        <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 10, maxWidth: 700 }}>Gere um link por plano e mande pro paciente. Ele preenche os dados, aceita o contrato e a Sandra já cria o cadastro, a assinatura e a 1ª conta a receber.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {links.filter((l) => l.ativo).map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><b>{l.label || l.plano}</b> <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>· {money(l.valor)} · {l.usos} cadastro(s)</span><div style={{ fontSize: 11.5, color: "var(--txt-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkUrl(l.token)}</div></div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => copiar(l.token)}>{copiado === l.token ? "Copiado!" : "Copiar link"}</button>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delLink(l.id)}>Desativar</button>
            </div>
          ))}
          {links.filter((l) => l.ativo).length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum link ativo.</p>}
        </div>
        <Row><Field label="Plano"><select className="fx-input" value={nl.planoId} onChange={(e) => setNl({ ...nl, planoId: e.target.value })}><option value="">— selecione —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field>
          <Field label="Valor (R$) — opcional"><input className="fx-input" type="number" value={nl.valor} onChange={(e) => setNl({ ...nl, valor: e.target.value })} placeholder="usa o do plano" /></Field>
          <Field label="Dia cobrança"><input className="fx-input" type="number" value={nl.diaCobranca} onChange={(e) => setNl({ ...nl, diaCobranca: e.target.value })} placeholder="ex.: 5" /></Field></Row>
        <button className="fx-btn" disabled={!nl.planoId} onClick={addLink}>+ Gerar link</button>
      </Section>

      <Section title="Planos">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {planos.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{p.nome}</b><div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{money(p.valor)} / {p.intervalo > 1 ? p.intervalo + " " : ""}{p.intervaloTipo === "weeks" ? "semana(s)" : "mês"} · {p.assinaturas} assinante(s)</div></div>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delPlano(p.id)}>Excluir</button>
            </div>
          ))}
          {planos.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum plano ainda.</p>}
        </div>
        <Row><Field label="Nome do plano"><input className="fx-input" value={np.nome} onChange={(e) => setNp({ ...np, nome: e.target.value })} placeholder="ex.: Membership Emerson" /></Field>
          <Field label="Valor mensal (R$)"><input className="fx-input" type="number" value={np.valor} onChange={(e) => setNp({ ...np, valor: e.target.value })} /></Field></Row>
        <button className="fx-btn" disabled={!np.nome.trim() || !Number(np.valor)} onClick={addPlano}>+ Adicionar plano</button>
      </Section>

      <Section title="Clientes / Pacientes">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {clientes.map((c) => (
            <div key={c.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{c.nome}</b>{c.documento ? <span style={{ fontSize: 12, color: "var(--txt-faint)" }}> · {c.documento}</span> : null}</div>
              <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => abrirDocs(c.id)}>Documentos</button>
              <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={`/api/finance/clientes/${c.id}/contrato`} target="_blank" rel="noopener">Gerar contrato</a>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => delCliente(c.id)}>Excluir</button>
            </div>
            {docsCli === c.id && (
              <div style={{ border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 var(--r-card) var(--r-card)", padding: "10px 14px", background: "var(--bg-soft, rgba(0,0,0,.02))" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <select className="fx-input" style={{ maxWidth: 150 }} value={docTipo} onChange={(e) => setDocTipo(e.target.value)}><option value="contrato">Contrato</option><option value="nf">NF</option><option value="comprovante">Comprovante</option><option value="outro">Outro</option></select>
                  <label className="fx-btn" style={{ fontSize: 12, cursor: "pointer" }}>Subir arquivo<input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(c.id, f); e.currentTarget.value = ""; }} /></label>
                  {docMsg && <span style={{ fontSize: 12, color: "var(--txt-faint)" }}>{docMsg}</span>}
                  <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>protegido · LGPD · auditado</span>
                </div>
                {docs.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--txt-faint)", margin: 0 }}>Nenhum documento ainda.</p> : docs.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#7a4fb0", background: "rgba(146,80,172,.12)", borderRadius: 999, padding: "1px 7px", textTransform: "uppercase" }}>{d.tipo}</span>
                    <a href={`/api/finance/documentos/${d.id}`} target="_blank" rel="noopener" style={{ flex: 1, color: "var(--txt)" }}>{d.filename}</a>
                    <span style={{ color: "var(--txt-faint)" }}>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
                    <button className="fx-btn" style={{ fontSize: 11, color: "var(--coral-deep)" }} onClick={() => delDoc(d.id, c.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
            </div>
          ))}
          {clientes.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum cliente cadastrado.</p>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--txt-soft)", marginBottom: 6 }}>+ Novo cliente / paciente</div>
        <Row><Field label="Nome completo*"><input className="fx-input" value={nc.nome} onChange={(e) => setNc({ ...nc, nome: e.target.value })} /></Field>
          <Field label="CPF/CNPJ"><input className="fx-input" value={nc.documento} onChange={(e) => setNc({ ...nc, documento: e.target.value })} /></Field>
          <Field label="RG"><input className="fx-input" value={nc.rg} onChange={(e) => setNc({ ...nc, rg: e.target.value })} /></Field></Row>
        <Row><Field label="E-mail"><input className="fx-input" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
          <Field label="CEP"><input className="fx-input" value={nc.cep} onChange={(e) => setNc({ ...nc, cep: e.target.value })} /></Field></Row>
        <Row><Field label="Logradouro"><input className="fx-input" value={nc.logradouro} onChange={(e) => setNc({ ...nc, logradouro: e.target.value })} /></Field>
          <Field label="Número"><input className="fx-input" value={nc.numero} onChange={(e) => setNc({ ...nc, numero: e.target.value })} /></Field>
          <Field label="Complemento"><input className="fx-input" value={nc.complemento} onChange={(e) => setNc({ ...nc, complemento: e.target.value })} /></Field></Row>
        <Row><Field label="Bairro"><input className="fx-input" value={nc.bairro} onChange={(e) => setNc({ ...nc, bairro: e.target.value })} /></Field>
          <Field label="Cidade"><input className="fx-input" value={nc.cidade} onChange={(e) => setNc({ ...nc, cidade: e.target.value })} /></Field>
          <Field label="UF"><input className="fx-input" value={nc.uf} onChange={(e) => setNc({ ...nc, uf: e.target.value })} maxLength={2} /></Field></Row>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--txt-soft)", marginBottom: 10 }}><input type="checkbox" checked={nc.consentimentoLGPD} onChange={(e) => setNc({ ...nc, consentimentoLGPD: e.target.checked })} /> Consentimento LGPD registrado (execução de contrato)</label>
        <button className="fx-btn" disabled={!nc.nome.trim()} onClick={addCliente}>+ Adicionar cliente</button>
      </Section>

      <Section title="Assinaturas ativas">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {assin.filter((a) => a.status === "ativa").map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
              <div style={{ flex: 1 }}><b>{a.cliente}</b> · {a.plano}<div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{money(a.valor)} · próxima {a.proximaCobranca ? new Date(a.proximaCobranca).toLocaleDateString("pt-BR") : "—"}</div></div>
              <button className="fx-btn" style={{ fontSize: 12, color: "var(--coral-deep)" }} onClick={() => cancelAssin(a.id)}>Cancelar</button>
            </div>
          ))}
          {assin.filter((a) => a.status === "ativa").length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhuma assinatura ativa.</p>}
        </div>
        <Row><Field label="Cliente"><select className="fx-input" value={na.clienteId} onChange={(e) => setNa({ ...na, clienteId: e.target.value })}><option value="">— selecione —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          <Field label="Plano"><select className="fx-input" value={na.planoId} onChange={(e) => setNa({ ...na, planoId: e.target.value })}><option value="">— selecione —</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field></Row>
        <Row><Field label="Valor mensal (R$)"><input className="fx-input" type="number" value={na.valor} onChange={(e) => setNa({ ...na, valor: e.target.value })} placeholder="usa o do plano se vazio" /></Field>
          <Field label="Dia de cobrança"><input className="fx-input" type="number" value={na.diaCobranca} onChange={(e) => setNa({ ...na, diaCobranca: e.target.value })} placeholder="ex.: 5" /></Field>
          <Field label="1ª cobrança"><input className="fx-input" type="date" value={na.proximaCobranca} onChange={(e) => setNa({ ...na, proximaCobranca: e.target.value })} /></Field></Row>
        <button className="fx-btn" disabled={!na.clienteId || !na.planoId} onClick={addAssin}>+ Criar assinatura</button>
      </Section>
    </>
  );
}

/* ---------- Cobrança (gateway: boleto/PIX/cartão) ---------- */
function CobrancaGateway({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [prov, setProv] = useState<"asaas" | "inter" | "iugu">("asaas");
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {([["asaas", "Asaas (gateway)"], ["inter", "Inter (banco)"], ["iugu", "Iugu (gateway)"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setProv(k)} className="fx-btn" style={{ fontWeight: prov === k ? 700 : 400, background: prov === k ? "rgba(146,80,172,.12)" : "var(--surface)" }}>{l}</button>
        ))}
      </div>
      {prov === "asaas" ? <AsaasPanel companyId={companyId} isAdmin={isAdmin} /> : prov === "inter" ? <InterPanel companyId={companyId} isAdmin={isAdmin} /> : <IuguPanel companyId={companyId} isAdmin={isAdmin} />}
    </>
  );
}

/* ---------- Asaas (gateway: boleto/PIX/cartão) ---------- */
function AsaasPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<{ connected: boolean; testMode: boolean; lastSyncAt: string | null }>({ connected: false, testMode: false, lastSyncAt: null });
  const [recebiveis, setRecebiveis] = useState<{ id: string; descricao: string; valorCents: number; status: string; secureUrl: string | null; createdAt: string }[]>([]);
  const [token, setToken] = useState(""); const [testMode, setTestMode] = useState(true);
  const [cob, setCob] = useState({ valorReais: "", descricao: "", devedorNome: "", devedorDoc: "", billingType: "BOLETO", vencimento: "" });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/asaas?company=${companyId}`).then((r) => r.json()).then((d) => setSt(d)).finally(() => setLoaded(true));
    fetch(`/api/finance/asaas/cobranca?company=${companyId}`).then((r) => r.json()).then((d) => setRecebiveis(d.recebiveis || [])).catch(() => {});
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/asaas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, apiToken: token.trim(), testMode }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setToken(""); setMsg(d.webhookRegistered ? "Asaas conectada e webhook registrado ✓" : `Asaas conectada ✓ (webhook não registrou: ${d.webhookError || "configure no painel da Asaas"})`); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar a Asaas? Os recebíveis já registrados continuam salvos.")) return;
    await fetch(`/api/finance/asaas?company=${companyId}`, { method: "DELETE" }); load();
  }
  async function emitir() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/asaas/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...cob }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setCob({ valorReais: "", descricao: "", devedorNome: "", devedorDoc: "", billingType: "BOLETO", vencimento: "" }); setMsg("Cobrança criada ✓"); load(); }
    else setErr(d.error || "Erro ao emitir.");
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 640 }}>
        Recebimento via <b>Asaas</b> — boleto, PIX e cartão (com link de pagamento e parcelamento). A cobrança nasce na Sandra e o pagamento confirma por webhook.
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {st.connected ? (
        <>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, background: "var(--surface)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
              <b style={{ fontSize: 14 }}>Asaas conectada</b>
              {st.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>sandbox</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>Última sincronização: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString("pt-BR") : "ainda sem eventos"}</div>
            {isAdmin && <button className="fx-btn" style={{ marginTop: 12, color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>}
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Nova cobrança</div>
            <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={cob.valorReais} onChange={(e) => setCob({ ...cob, valorReais: e.target.value })} /></Field>
              <Field label="Vencimento*"><input className="fx-input" type="date" value={cob.vencimento} onChange={(e) => setCob({ ...cob, vencimento: e.target.value })} /></Field></Row>
            <Row><Field label="Forma"><select className="fx-input" value={cob.billingType} onChange={(e) => setCob({ ...cob, billingType: e.target.value })}><option value="BOLETO">Boleto</option><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartão</option><option value="UNDEFINED">Cliente escolhe</option></select></Field>
              <Field label="Descrição"><input className="fx-input" value={cob.descricao} onChange={(e) => setCob({ ...cob, descricao: e.target.value })} placeholder="ex.: Mensalidade junho" /></Field></Row>
            <Row><Field label="Pagador (nome)*"><input className="fx-input" value={cob.devedorNome} onChange={(e) => setCob({ ...cob, devedorNome: e.target.value })} /></Field>
              <Field label="CPF/CNPJ do pagador"><input className="fx-input" value={cob.devedorDoc} onChange={(e) => setCob({ ...cob, devedorDoc: e.target.value })} /></Field></Row>
            <button className="fx-btn fx-btn-primary" disabled={busy || !Number(cob.valorReais) || !cob.devedorNome || !cob.vencimento} onClick={emitir}>{busy ? "Emitindo…" : "Emitir cobrança"}</button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Recebíveis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 720 }}>
            {recebiveis.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma cobrança ainda.</p>}
            {recebiveis.map((r) => {
              const tone = r.status === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50" } : r.status === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c" } : { bg: "#f6e7cd", fg: "#b5781f" };
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 13px", background: "var(--surface)" }}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{r.descricao}</span>
                  {r.secureUrl && r.status !== "paga" && <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={r.secureUrl} target="_blank" rel="noreferrer">Abrir link</a>}
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{BRLcents(r.valorCents)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 9px" }}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Conectar Asaas</div>
          <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>Pegue a chave de API no painel da Asaas (Integrações → API). Comece pela chave de <b>sandbox</b> pra testar. A chave fica só no servidor.</p>
          <Field label="API Key (access_token)"><input className="fx-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="$aact_..." autoComplete="off" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Chave de sandbox (recomendado pra testar)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy || token.trim().length < 20} onClick={connect}>{busy ? "Validando…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>A Asaas ainda não foi conectada. Peça a um admin.</p>
      )}
    </>
  );
}

function BRLcents(c: number) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

/* ---------- Inter (banco direto, Pix) ---------- */
function InterPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<{ connected: boolean; contaCorrente: string | null; pixKey: string | null; testMode: boolean; lastSyncAt: string | null }>({ connected: false, contaCorrente: null, pixKey: null, testMode: false, lastSyncAt: null });
  const [recebiveis, setRecebiveis] = useState<{ id: string; descricao: string; valorCents: number; status: string; pixCopiaECola: string | null; secureUrl: string | null; vencimento: string | null; createdAt: string }[]>([]);
  // form de conexão
  const [f, setF] = useState({ clientId: "", clientSecret: "", certPem: "", keyPem: "", contaCorrente: "", pixKey: "", testMode: true });
  // form de cobrança (boleto + Pix — boleto exige endereço do pagador)
  const [cob, setCob] = useState({ valorReais: "", descricao: "", vencimento: "", devedorNome: "", devedorDoc: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/inter?company=${companyId}`).then((r) => r.json()).then((d) => setSt(d)).finally(() => setLoaded(true));
    fetch(`/api/finance/inter/cobranca?company=${companyId}`).then((r) => r.json()).then((d) => setRecebiveis(d.recebiveis || [])).catch(() => {});
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/inter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...f }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setF((x) => ({ ...x, clientSecret: "", certPem: "", keyPem: "" })); setMsg(d.webhookRegistered ? "Inter conectado e webhook de cobrança registrado ✓" : `Inter conectado ✓ (webhook não registrou: ${d.webhookError || "—"})`); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar o Inter? Os recebíveis já registrados continuam salvos.")) return;
    await fetch(`/api/finance/inter?company=${companyId}`, { method: "DELETE" }); load();
  }
  async function emitir() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/inter/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...cob }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setCob({ valorReais: "", descricao: "", vencimento: "", devedorNome: "", devedorDoc: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "" }); setMsg("Cobrança criada ✓ (boleto + Pix)"); load(); }
    else setErr(d.error || "Erro ao emitir.");
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 640 }}>
        Recebimento <b>direto no Banco Inter</b> via <b>boleto com Pix</b> (mTLS, API de Cobrança). A cobrança nasce na Sandra, o cliente paga o boleto ou o QR Code Pix, e o Inter confirma por webhook — o dinheiro cai direto na conta da empresa.
      </div>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {st.connected ? (
        <>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, background: "var(--surface)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
              <b style={{ fontSize: 14 }}>Inter conectado</b>
              {st.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>homologação</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>Chave Pix: {st.pixKey || "—"} · Conta: {st.contaCorrente || "—"}</div>
            <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginTop: 2 }}>Última sincronização: {st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString("pt-BR") : "ainda sem eventos"}</div>
            {isAdmin && <button className="fx-btn" style={{ marginTop: 12, color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>}
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640, marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Nova cobrança (boleto + Pix)</div>
            <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>O boleto exige os dados completos do pagador (nome, CPF/CNPJ e endereço). O cliente recebe boleto e QR Code Pix na mesma cobrança.</p>
            <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={cob.valorReais} onChange={(e) => setCob({ ...cob, valorReais: e.target.value })} /></Field>
              <Field label="Vencimento*"><input className="fx-input" type="date" value={cob.vencimento} onChange={(e) => setCob({ ...cob, vencimento: e.target.value })} /></Field></Row>
            <Field label="Descrição"><input className="fx-input" value={cob.descricao} onChange={(e) => setCob({ ...cob, descricao: e.target.value })} placeholder="ex.: Mensalidade junho" /></Field>
            <Row><Field label="Pagador (nome)*"><input className="fx-input" value={cob.devedorNome} onChange={(e) => setCob({ ...cob, devedorNome: e.target.value })} /></Field>
              <Field label="CPF/CNPJ do pagador*"><input className="fx-input" value={cob.devedorDoc} onChange={(e) => setCob({ ...cob, devedorDoc: e.target.value })} /></Field></Row>
            <Row><Field label="CEP*"><input className="fx-input" value={cob.cep} onChange={(e) => setCob({ ...cob, cep: e.target.value })} placeholder="00000-000" /></Field>
              <Field label="Endereço*"><input className="fx-input" value={cob.endereco} onChange={(e) => setCob({ ...cob, endereco: e.target.value })} placeholder="Rua / Av." /></Field></Row>
            <Row><Field label="Número"><input className="fx-input" value={cob.numero} onChange={(e) => setCob({ ...cob, numero: e.target.value })} placeholder="S/N" /></Field>
              <Field label="Bairro"><input className="fx-input" value={cob.bairro} onChange={(e) => setCob({ ...cob, bairro: e.target.value })} /></Field></Row>
            <Row><Field label="Cidade*"><input className="fx-input" value={cob.cidade} onChange={(e) => setCob({ ...cob, cidade: e.target.value })} /></Field>
              <Field label="UF*"><input className="fx-input" maxLength={2} value={cob.uf} onChange={(e) => setCob({ ...cob, uf: e.target.value.toUpperCase() })} placeholder="SC" /></Field></Row>
            <button className="fx-btn fx-btn-primary" disabled={busy || !Number(cob.valorReais) || !cob.vencimento || !cob.devedorNome || !cob.devedorDoc || !cob.cep || !cob.endereco || !cob.cidade || !cob.uf} onClick={emitir}>{busy ? "Emitindo…" : "Emitir boleto + Pix"}</button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Recebíveis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 720 }}>
            {recebiveis.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhuma cobrança ainda.</p>}
            {recebiveis.map((r) => {
              const tone = r.status === "paga" ? { bg: "#d7ebe2", fg: "#0f6b50" } : r.status === "vencida" ? { bg: "#f3dcd8", fg: "#a8332c" } : { bg: "#f6e7cd", fg: "#b5781f" };
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 13px", background: "var(--surface)" }}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{r.descricao}</span>
                  {r.secureUrl && r.status !== "paga" && <a className="fx-btn" style={{ fontSize: 12, textDecoration: "none" }} href={r.secureUrl} target="_blank" rel="noopener noreferrer">Boleto</a>}
                  {r.pixCopiaECola && r.status !== "paga" && <button className="fx-btn" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(r.pixCopiaECola || ""); setMsg("Pix copia-e-cola copiado ✓"); }}>Copiar Pix</button>}
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{BRLcents(r.valorCents)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 9px" }}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 640 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Conectar Banco Inter</div>
          <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>Cole o client_id, o client_secret e a chave Pix. O <b>certificado e a chave são opcionais</b> — preencha só se a sua integração exigir mTLS (se conectar sem eles, é porque não precisa). Tudo fica guardado só no servidor.</p>
          <Row><Field label="Client ID"><input className="fx-input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} autoComplete="off" /></Field>
            <Field label="Client Secret"><input className="fx-input" type="password" value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })} autoComplete="off" /></Field></Row>
          <Field label="Certificado (.crt — opcional, só se exigir mTLS)"><textarea className="fx-input" rows={3} value={f.certPem} onChange={(e) => setF({ ...f, certPem: e.target.value })} placeholder="-----BEGIN CERTIFICATE----- (deixe vazio se não tiver)" /></Field>
          <Field label="Chave privada (.key — opcional)"><textarea className="fx-input" rows={3} value={f.keyPem} onChange={(e) => setF({ ...f, keyPem: e.target.value })} placeholder="-----BEGIN PRIVATE KEY----- (deixe vazio se não tiver)" /></Field>
          <Row><Field label="Conta corrente (opcional)"><input className="fx-input" value={f.contaCorrente} onChange={(e) => setF({ ...f, contaCorrente: e.target.value })} /></Field>
            <Field label="Chave Pix de recebimento*"><input className="fx-input" value={f.pixKey} onChange={(e) => setF({ ...f, pixKey: e.target.value })} placeholder="e-mail, CNPJ ou aleatória" /></Field></Row>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={f.testMode} onChange={(e) => setF({ ...f, testMode: e.target.checked })} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Credenciais de homologação (recomendado pra testar antes)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy} onClick={connect}>{busy ? "Validando com o Inter…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>O Inter ainda não foi conectado. Peça a um admin.</p>
      )}
    </>
  );
}

/* ---------- Gestão (extrato bancário Inter) ---------- */
function GestaoTab({ companyId }: { companyId: string }) {
  const hoje = new Date();
  const fmtY = (d: Date) => d.toISOString().slice(0, 10);
  const [de, setDe] = useState(fmtY(new Date(2026, 3, 1))); // abril/2026 (início Emerson)
  const [ate, setAte] = useState(fmtY(hoje));
  const [data, setData] = useState<{ totalCredito: number; totalDebito: number; saldoMovimento: number; quantidade: number; lancamentos: { data: string | null; tipo: string; valor: number; titulo: string; descricao: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(() => {
    setLoading(true); setErr(""); setData(null);
    fetch(`/api/finance/inter/extrato?company=${companyId}&de=${de}&ate=${ate}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro ao buscar o extrato."); return d; })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [companyId, de, ate]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 680 }}>
        <b>Extrato bancário</b> — direto do Banco Inter. É a base da conciliação: o que de fato entrou e saiu da conta.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <Field label="De"><input className="fx-input" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
        <Field label="Até"><input className="fx-input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
        <button className="fx-btn fx-btn-primary" disabled={loading} onClick={load}>{loading ? "Buscando…" : "Atualizar"}</button>
      </div>

      {err && (
        <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "12px 15px", fontSize: 13.5, maxWidth: 680 }}>
          {err}
          {/conectado|conexão|não conectado/i.test(err) && <div style={{ marginTop: 6, color: "var(--txt-soft)" }}>Conecte o Inter em <b>Contas a Receber → Inter</b>.</div>}
        </div>
      )}

      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando extrato…</p>}

      {data && !loading && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <Metric label="Entradas (crédito)" value={money(data.totalCredito)} />
            <Metric label="Saídas (débito)" value={money(data.totalDebito)} tone={data.totalDebito > 0 ? "alert" : undefined} />
            <Metric label="Saldo do movimento" value={money(data.saldoMovimento)} />
            <Metric label="Lançamentos" value={String(data.quantidade)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
            {data.lancamentos.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum lançamento no período.</p>}
            {data.lancamentos.map((l, i) => {
              const cred = l.tipo === "credito";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "10px 14px", background: "var(--surface)" }}>
                  <span style={{ fontSize: 12, color: "var(--txt-faint)", width: 86, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "—"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.descricao || l.titulo || "—"}</div>
                    {l.titulo && l.descricao && <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{l.titulo}</div>}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: cred ? "#0f6b50" : "#a8332c", whiteSpace: "nowrap" }}>{cred ? "+" : "−"} {money(l.valor)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Contas Bancárias (multi-conta) ---------- */
function ContasTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [contas, setContas] = useState<{ id: string; nome: string; banco: string | null; conexao: string; tipo?: string; _count: { transacoes: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: "", banco: "c6", tipo: "caixa" });
  const [msg, setMsg] = useState("");
  const [lancarEm, setLancarEm] = useState<string | null>(null);
  const [lanc, setLanc] = useState({ data: new Date().toISOString().slice(0, 10), tipo: "debito", valor: "", descricao: "" });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/contas?company=${companyId}`).then((r) => r.json()).then((d) => setContas(d.contas || [])).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!novo.nome.trim()) return;
    await fetch("/api/finance/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, nome: novo.nome, banco: novo.banco, tipo: novo.tipo, conexao: "manual" }) });
    setNovo({ nome: "", banco: "c6", tipo: "caixa" }); load();
  }
  async function importar(id: string, file: File) {
    setMsg("Importando…");
    const csv = await file.text();
    const r = await fetch(`/api/finance/contas/${id}/importar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
    const d = await r.json();
    setMsg(r.ok ? `Importado: ${d.criados} lançamentos (${d.pulados} pulados/duplicados).` : (d.error || "Erro ao importar."));
    load();
  }
  async function lancarManual(id: string) {
    const r = await fetch(`/api/finance/contas/${id}/lancar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lanc) });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error || "Erro ao lançar."); return; }
    setMsg("Lançamento registrado.");
    setLancarEm(null); setLanc({ data: new Date().toISOString().slice(0, 10), tipo: "debito", valor: "", descricao: "" }); load();
  }
  const TIPO: Record<string, { l: string; c: string; bg: string }> = {
    caixa: { l: "caixa", c: "#0f6b50", bg: "var(--verde-soft, #d7ebe2)" },
    cartao: { l: "cartão", c: "#7a3fa0", bg: "rgba(146,80,172,.12)" },
    socio: { l: "sócio (PF)", c: "#274b6d", bg: "#dce8f2" },
  };

  return (
    <>
      <TabHeader title="Contas bancárias" subtitle="O caixa soma as contas de tipo caixa. Cartão e sócio (PF) entram na DRE, mas ficam fora do Fluxo. Inter é ao vivo; as demais você importa CSV ou lança manual." />
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14, maxWidth: 640 }}>{msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50", flexShrink: 0 }} />
          <div style={{ flex: 1 }}><b>Inter PJ</b> <span className="pill" style={{ background: "var(--verde-soft)", color: "var(--verde)", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>conectada (API)</span><div style={{ fontSize: 12, color: "var(--txt-faint)" }}>Extrato ao vivo · conciliação automática</div></div>
        </div>
        {contas.map((c) => {
          const t = TIPO[c.tipo || "caixa"] || TIPO.caixa;
          const aberto = lancarEm === c.id;
          return (
            <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.c, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <b>{c.nome}</b>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.c, background: t.bg, borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>{t.l}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#b5781f", background: "var(--amarelo)", borderRadius: 999, padding: "2px 9px", marginLeft: 6 }}>manual</span>
                  <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{c._count.transacoes} lançamentos</div>
                </div>
                {isAdmin && <button className="fx-btn" style={{ fontSize: 12.5 }} onClick={() => setLancarEm(aberto ? null : c.id)}>{aberto ? "Fechar" : "Lançar"}</button>}
                <input ref={(el) => { fileRefs.current[c.id] = el; }} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(c.id, f); e.currentTarget.value = ""; }} />
                <button className="fx-btn" style={{ fontSize: 12.5 }} onClick={() => fileRefs.current[c.id]?.click()}>Importar CSV</button>
              </div>
              {aberto && (
                <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg, #faf8fb)", padding: "12px 15px" }}>
                  <Row>
                    <Field label="Data"><input className="fx-input" type="date" value={lanc.data} onChange={(e) => setLanc({ ...lanc, data: e.target.value })} /></Field>
                    <Field label="Tipo"><select className="fx-input" value={lanc.tipo} onChange={(e) => setLanc({ ...lanc, tipo: e.target.value })}><option value="debito">Saída (despesa)</option><option value="credito">Entrada</option></select></Field>
                    <Field label="Valor (R$)"><input className="fx-input" inputMode="decimal" value={lanc.valor} onChange={(e) => setLanc({ ...lanc, valor: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="2000,00" /></Field>
                  </Row>
                  <Field label="Descrição (use o nome do fornecedor p/ classificar)"><input className="fx-input" value={lanc.descricao} onChange={(e) => setLanc({ ...lanc, descricao: e.target.value })} placeholder="ex.: MILENA - atendimento psicológico" /></Field>
                  <button className="fx-btn fx-btn-primary" disabled={!lanc.valor || !lanc.descricao.trim()} onClick={() => lancarManual(c.id)}>Registrar lançamento</button>
                </div>
              )}
            </div>
          );
        })}
        {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      </div>

      {isAdmin && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 560 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>+ Adicionar conta (manual)</div>
          <Row>
            <Field label="Nome"><input className="fx-input" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="ex.: PF — Giancarlo (sócio)" /></Field>
            <Field label="Banco"><select className="fx-input" value={novo.banco} onChange={(e) => setNovo({ ...novo, banco: e.target.value })}><option value="c6">C6</option><option value="nubank">Nubank</option><option value="bradesco">Bradesco</option><option value="itau">Itaú</option><option value="outro">Outro</option></select></Field>
            <Field label="Tipo"><select className="fx-input" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}><option value="caixa">Caixa (entra no fluxo)</option><option value="cartao">Cartão (fora do fluxo)</option><option value="socio">Sócio PF (fora do fluxo)</option></select></Field>
          </Row>
          <button className="fx-btn fx-btn-primary" disabled={!novo.nome.trim()} onClick={add}>Adicionar</button>
        </div>
      )}
    </>
  );
}

/* ---------- DRE (regime de competência) ---------- */
function DreTab({ companyId }: { companyId: string }) {
  type Item = { data: string; descricao: string; valor: number };
  type Cat = { grupo: string; nome: string; total: number; porMes: Record<string, number>; itens: Item[] };
  type Grp = { total: number; porMes: Record<string, number>; categorias: Cat[] };
  type Dados = { regime: string; meses: string[]; receitas: Grp; despesasOperacional: Grp; resultadoOperacional: { total: number; porMes: Record<string, number> }; naoOperacional: { investimento: Cat[]; financiamento: Cat[] } };
  const [d, setD] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { setLoading(true); fetch(`/api/finance/dre?company=${companyId}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, [companyId]);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mesLabel = (m: string) => { const [a, mm] = m.split("-"); return `${mm}/${a.slice(2)}`; };
  if (loading) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;
  if (!d || !d.meses) return <p style={{ color: "var(--txt-faint)" }}>Sem dados.</p>;
  const meses = d.meses;
  const cell: React.CSSProperties = { padding: "6px 10px", textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" };
  const head: React.CSSProperties = { ...cell, fontWeight: 700, color: "var(--txt-soft)", borderBottom: "1px solid var(--line)" };

  const totalRow = (nome: string, porMes: Record<string, number>, total: number, color?: string) => (
    <tr style={{ background: "var(--surface)" }}>
      <td style={{ padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color }}>{nome}</td>
      {meses.map((m) => <td key={m} style={{ ...cell, fontWeight: 700, color }}>{porMes[m] ? money(porMes[m]) : "—"}</td>)}
      <td style={{ ...cell, fontWeight: 700, color }}>{money(total)}</td>
    </tr>
  );
  const catRows = (cats: Cat[], color?: string) => cats.flatMap((c) => {
    const key = `${c.grupo}|${c.nome}`; const isOpen = open[key];
    const rows = [
      <tr key={key} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} style={{ cursor: "pointer" }}>
        <td style={{ padding: "6px 10px 6px 22px", fontSize: 12.5 }}><span style={{ color: "var(--txt-faint)", marginRight: 5 }}>{isOpen ? "▾" : "▸"}</span>{c.grupo} › {c.nome} <span style={{ fontSize: 10.5, color: "var(--txt-faint)" }}>({c.itens.length})</span></td>
        {meses.map((m) => <td key={m} style={{ ...cell, color }}>{c.porMes[m] ? money(c.porMes[m]) : "—"}</td>)}
        <td style={{ ...cell, fontWeight: 600, color }}>{money(c.total)}</td>
      </tr>,
    ];
    if (isOpen) rows.push(
      <tr key={key + "-d"}><td colSpan={meses.length + 2} style={{ padding: 0 }}>
        <div style={{ background: "var(--bg-soft, rgba(0,0,0,.02))", padding: "6px 10px 8px 38px" }}>
          {c.itens.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.8, color: "var(--txt-soft)", padding: "2px 0", borderBottom: "1px dashed var(--line)" }}>
              <span>{new Date(it.data).toLocaleDateString("pt-BR")} · {it.descricao}</span><span style={{ fontWeight: 600 }}>{money(it.valor)}</span>
            </div>
          ))}
        </div>
      </td></tr>
    );
    return rows;
  });

  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 14, maxWidth: 780 }}><b>DRE — {d.regime}.</b> Lê os lançamentos reais (extrato + cartão + recebíveis). <b>Clique numa categoria</b> para ver os lançamentos que a compõem. Investimento e aportes ficam no memo (fora do resultado).</div>
      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-card)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 540 }}>
          <thead><tr><th style={{ ...head, textAlign: "left" }}>Conta</th>{meses.map((m) => <th key={m} style={head}>{mesLabel(m)}</th>)}<th style={head}>Total</th></tr></thead>
          <tbody>
            {totalRow("RECEITAS", d.receitas.porMes, d.receitas.total, "#0f6b50")}
            {catRows(d.receitas.categorias)}
            {d.receitas.categorias.length === 0 && <tr><td colSpan={meses.length + 2} style={{ padding: "6px 22px", fontSize: 12, color: "var(--txt-faint)" }}>Sem receitas no período.</td></tr>}
            {totalRow("(−) DESPESAS OPERACIONAIS", d.despesasOperacional.porMes, d.despesasOperacional.total, "#a8332c")}
            {catRows(d.despesasOperacional.categorias)}
            {totalRow("= RESULTADO OPERACIONAL", d.resultadoOperacional.porMes, d.resultadoOperacional.total)}
          </tbody>
        </table>
      </div>
      {(d.naoOperacional.investimento.length > 0 || d.naoOperacional.financiamento.length > 0) && (
        <Section title="Memo — fora do resultado (vão pro Balanço)">
          {[...d.naoOperacional.investimento.map((c) => ["Investimento", c] as const), ...d.naoOperacional.financiamento.map((c) => ["Financiamento", c] as const)].map(([b, c], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: "var(--txt-soft)" }}><span>{b} · {c.grupo} › {c.nome}</span><b>{money(c.total)}</b></div>
          ))}
        </Section>
      )}
    </>
  );
}

function ConciliacaoTab({ companyId }: { companyId: string }) {
  type Sug = { tipo: string; id: string; descricao: string; valor: number; status: string };
  type Lanc = { id: string; data: string; descricao: string; valor: number; tipo: string; conta: string; conciliado: boolean; requestId: string | null; sugestoes: Sug[] };
  const [data, setData] = useState<{ pendentes: number; total: number; lancamentos: Lanc[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [soPend, setSoPend] = useState(true);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/conciliar?company=${companyId}${soPend ? "&pendentes=1" : ""}`).then((r) => r.json()).then(setData).finally(() => setLoading(false)); }, [companyId, soPend]);
  useEffect(() => { load(); }, [load]);
  async function act(transactionId: string, body: any) { await fetch("/api/finance/conciliar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId, ...body }) }); load(); }
  return (
    <>
      <div style={{ fontSize: 13.5, color: "var(--txt-soft)", marginBottom: 12, maxWidth: 760 }}><b>Conciliação.</b> Cada lançamento do extrato é amarrado ao pagamento/recebimento que o originou. A Sandra sugere o que casa pelo valor; você confirma. (Cartão fica de fora — não é caixa.)</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: "var(--txt-soft)", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={soPend} onChange={(e) => setSoPend(e.target.checked)} /> Só pendentes</label>
        {data && <span style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>{data.pendentes} pendente(s) de {data.total}</span>}
        <button className="fx-btn" onClick={load} style={{ marginLeft: "auto" }}>Recarregar</button>
      </div>
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data && data.lancamentos.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nada para conciliar no período. 🎉</p>}
        {data && data.lancamentos.map((l) => (
          <div key={l.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "11px 14px", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)" }}>{new Date(l.data).toLocaleDateString("pt-BR")} · {l.conta}</div>
              </div>
              <div style={{ fontWeight: 700, color: l.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{l.tipo === "credito" ? "+" : "−"}{money(l.valor)}</div>
              {l.conciliado
                ? <><span style={{ fontSize: 11, fontWeight: 700, color: "#0f6b50", background: "#d7ebe2", borderRadius: 999, padding: "2px 9px" }}>✓ conciliado</span><button className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { action: "desconciliar" })}>Desfazer</button></>
                : <button className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { conciliado: true })}>Marcar conciliado</button>}
            </div>
            {!l.conciliado && l.sugestoes.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 11.5, color: "var(--txt-faint)", alignSelf: "center" }}>Casa com:</span>
                {l.sugestoes.map((sg) => (
                  <button key={sg.id} className="fx-btn" style={{ fontSize: 11.5 }} onClick={() => act(l.id, { requestId: sg.id, conciliado: true })}>{sg.tipo === "pagar" ? "Pagar" : "Receber"}: {sg.descricao?.slice(0, 30)} ({money(sg.valor)})</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Cabeçalho padrão de aba (consistência visual) ---------- */
function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--txt-soft)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Visão geral (home do financeiro) ---------- */
function HomeTab({ companyId, go }: { companyId: string; go: (k: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/resumo?company=${companyId}`).then((r) => r.json()).then(setD).finally(() => setLoading(false)); }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR");
  function quando(iso: string | null) {
    if (!iso) return "sem sincronização";
    const ms = Date.now() - new Date(iso).getTime(); const min = Math.floor(ms / 60000), h = Math.floor(min / 60), dias = Math.floor(h / 24);
    return min < 60 ? `há ${min} min` : h < 24 ? `há ${h} h` : dias === 1 ? "ontem" : `há ${dias} dias`;
  }

  const Card = ({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) => (
    <div onClick={onClick} style={{ flex: 1, minWidth: 170, border: "1px solid var(--line)", borderLeft: `3px solid ${tone || "var(--roxo, #7a4fb0)"}`, borderRadius: "var(--r-card)", padding: "13px 16px", background: "var(--surface)", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: tone || "var(--txt)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <TabHeader title="Visão geral" subtitle="O resumo do financeiro da empresa — atualizado direto do banco." right={<button className="fx-btn" onClick={load} disabled={loading}>{loading ? "…" : "Recarregar"}</button>} />
      {loading && !d && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {d && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Card label="Saldo em caixa" value={money(d.saldoTotal)} sub={`sincronizado ${quando(d.ultimoSync)}`} tone="#7a4fb0" onClick={() => go("fluxo")} />
            <Card label="A pagar (em aberto)" value={money(d.aPagar.total)} sub={`${d.aPagar.qtd} título(s)${d.aPagar.vencidas ? ` · ${d.aPagar.vencidas} vencido(s)` : ""}`} tone={d.aPagar.vencidas ? "#a8332c" : "#274b6d"} onClick={() => go("painel")} />
            <Card label="A receber (em aberto)" value={money(d.aReceber.total)} sub={`${d.aReceber.qtd} título(s)${d.aReceber.vencidas ? ` · ${d.aReceber.vencidas} vencido(s)` : ""}`} tone={d.aReceber.vencidas ? "#b5781f" : "#0f6b50"} onClick={() => go("receber")} />
            <Card label="Sem categoria" value={String(d.semCategoria)} sub="lançamentos a identificar (90d)" tone={d.semCategoria ? "#b5781f" : "#0f6b50"} onClick={() => go("conciliar")} />
          </div>

          {(d.aPagar.vencidas > 0 || d.aReceber.vencidas > 0 || d.semCategoria > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxWidth: 760 }}>
              {d.aPagar.vencidas > 0 && <Alerta tone="critico" txt={`${d.aPagar.vencidas} conta(s) a pagar vencida(s) — ${money(d.aPagar.totalVencidas)}.`} acao="Ver contas a pagar" onClick={() => go("painel")} />}
              {d.aReceber.vencidas > 0 && <Alerta tone="atencao" txt={`${d.aReceber.vencidas} recebível(is) vencido(s) — ${money(d.aReceber.totalVencidas)}.`} acao="Ver contas a receber" onClick={() => go("receber")} />}
              {d.semCategoria > 0 && <Alerta tone="atencao" txt={`${d.semCategoria} lançamento(s) sem categoria nos últimos 90 dias.`} acao="Identificar na conciliação" onClick={() => go("conciliar")} />}
            </div>
          )}

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Últimos lançamentos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {d.ultimos.length === 0 && <p style={{ color: "var(--txt-faint)", fontSize: 13 }}>Nenhum lançamento ainda.</p>}
                {d.ultimos.map((l: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)" }}>
                    <span style={{ width: 70, color: "var(--txt-faint)" }}>{l.data.slice(5)}</span>
                    <span style={{ flex: 1, color: "var(--txt-soft)" }}>{l.descricao}<span style={{ color: "var(--txt-faint)" }}> · {l.conta}</span></span>
                    <span style={{ color: l.tipo === "credito" ? "#0f6b50" : "#a8332c", fontWeight: 600 }}>{l.tipo === "credito" ? "+" : "−"}{money(l.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Atalhos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[["solicitar", "Solicitar pagamento"], ["fluxo", "Fluxo de Caixa"], ["dre", "DRE"], ["receber", "Contas a Receber"], ["saude", "Saúde do financeiro"]].map(([k, l]) => (
                  <button key={k} className="fx-btn" style={{ justifyContent: "flex-start" }} onClick={() => go(k)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
function Alerta({ tone, txt, acao, onClick }: { tone: "critico" | "atencao"; txt: string; acao: string; onClick: () => void }) {
  const c = tone === "critico" ? { bg: "#f3dcd8", fg: "#a8332c", dot: "#c0392b" } : { bg: "#f6e7cd", fg: "#b5781f", dot: "#d68910" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: c.bg, borderRadius: "var(--r-card)", padding: "9px 14px" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: c.fg }}>{txt}</span>
      <button onClick={onClick} style={{ background: "none", border: "none", color: c.fg, fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{acao} →</button>
    </div>
  );
}

function FluxoCaixaTab({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const hoje = new Date();
  const fmtY = (d: Date) => d.toISOString().slice(0, 10);
  const [de, setDe] = useState(fmtY(new Date(2026, 2, 1)));
  const [ate, setAte] = useState(fmtY(hoje));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [aberta, setAberta] = useState<string | null>(null); // categoria expandida (drill-down)
  const money = (v: number) => (v < 0 ? "−" : "") + "R$ " + Math.abs(v || 0).toLocaleString("pt-BR");
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesLabel = (m: string) => { const [y, mm] = m.split("-"); return `${MES[(+mm || 1) - 1]}/${y.slice(2)}`; };

  const load = useCallback(() => {
    setLoading(true); setErr("");
    fetch(`/api/finance/fluxo-caixa?company=${companyId}&de=${de}&ate=${ate}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro"); return d; })
      .then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [companyId, de, ate]);
  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true);
    await fetch(`/api/finance/plano/seed?company=${companyId}`, { method: "POST" });
    setSeeding(false); load();
  }
  async function sincronizar() {
    setSyncing(true); setSyncMsg("");
    try {
      const r = await fetch(`/api/finance/inter/sync?company=${companyId}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao sincronizar");
      setSyncMsg(typeof d.criados === "number" ? `${d.criados} novo(s) lançamento(s)` : "Sincronizado");
    } catch (e: any) { setSyncMsg(e.message || "Falha"); }
    setSyncing(false); load();
  }

  function quando(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso); const ms = Date.now() - d.getTime();
    const min = Math.floor(ms / 60000), h = Math.floor(min / 60), dias = Math.floor(h / 24);
    const rel = min < 1 ? "agora" : min < 60 ? `há ${min} min` : h < 24 ? `há ${h} h` : dias === 1 ? "ontem" : `há ${dias} dias`;
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${rel})`;
  }
  const fresco = data?.ultimoSync ? (Date.now() - new Date(data.ultimoSync).getTime()) < 36 * 3600 * 1000 : false;

  const BLOCO: Record<string, { l: string; c: string }> = {
    operacional: { l: "Operacional", c: "#7a3fa0" }, investimento: { l: "Investimento", c: "#274b6d" },
    financiamento: { l: "Financiamento", c: "#0f6b50" }, interno: { l: "Interno (transferências)", c: "#7a7f87" },
  };

  // ---- gráfico: barras entradas x saídas por mês + linha de saldo final ----
  function Chart({ porMes }: { porMes: any[] }) {
    if (!porMes || porMes.length === 0) return null;
    const W = 760, H = 260, padL = 8, padR = 8, padT = 18, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = porMes.length;
    const groupW = plotW / n;
    const maxFluxo = Math.max(1, ...porMes.map((p) => Math.max(p.entradas, p.saidas)));
    const saldos = porMes.map((p) => p.saldoFinal);
    const sMin = Math.min(0, ...saldos), sMax = Math.max(1, ...saldos);
    const barH = (v: number) => (v / maxFluxo) * plotH;
    const yBase = padT + plotH;
    const sY = (v: number) => padT + plotH - ((v - sMin) / (sMax - sMin || 1)) * plotH;
    const bw = Math.min(46, groupW * 0.3);
    const pts = porMes.map((p, i) => `${padL + groupW * (i + 0.5)},${sY(p.saldoFinal)}`).join(" ");
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", padding: "12px 14px 4px", marginBottom: 18, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 4, fontSize: 11.5, color: "var(--txt-soft)" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1f9d57", borderRadius: 2, marginRight: 5 }} />Entradas</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#d06b62", borderRadius: 2, marginRight: 5 }} />Saídas</span>
          <span><span style={{ display: "inline-block", width: 14, height: 3, background: "#7a4fb0", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Saldo no fim do mês</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, height: "auto", display: "block" }}>
          <line x1={padL} y1={yBase} x2={W - padR} y2={yBase} stroke="var(--line)" />
          {porMes.map((p, i) => {
            const cx = padL + groupW * (i + 0.5);
            return (
              <g key={i}>
                <rect x={cx - bw - 2} y={yBase - barH(p.entradas)} width={bw} height={barH(p.entradas)} rx={3} fill="#1f9d57" opacity={0.88} />
                <rect x={cx + 2} y={yBase - barH(p.saidas)} width={bw} height={barH(p.saidas)} rx={3} fill="#d06b62" opacity={0.88} />
                <text x={cx} y={H - 16} textAnchor="middle" fontSize={12} fill="var(--txt-soft)">{mesLabel(p.mes)}</text>
              </g>
            );
          })}
          <polyline points={pts} fill="none" stroke="#7a4fb0" strokeWidth={2.5} />
          {porMes.map((p, i) => {
            const cx = padL + groupW * (i + 0.5);
            return (
              <g key={"s" + i}>
                <circle cx={cx} cy={sY(p.saldoFinal)} r={4} fill="#7a4fb0" stroke="var(--surface)" strokeWidth={1.5} />
                <text x={cx} y={sY(p.saldoFinal) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="#7a4fb0">{(p.saldoFinal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13.5, color: "var(--txt-soft)" }}><b>Fluxo de Caixa</b> (regime de caixa) — saldo das contas e movimento mês a mês, direto do extrato do Inter.</div>
        </div>
        <Field label="De"><input className="fx-input" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
        <Field label="Até"><input className="fx-input" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
        <button className="fx-btn" disabled={loading} onClick={load}>{loading ? "…" : "Atualizar"}</button>
        {isAdmin && <button className="fx-btn" disabled={seeding} onClick={seed} title="Cria/atualiza o plano de contas e as regras de categorização">{seeding ? "Configurando…" : "Configurar plano"}</button>}
      </div>

      {/* selo de atualização + sincronizar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: fresco ? "#d7ebe2" : "#f6e7cd", color: fresco ? "#0f6b50" : "#b5781f", borderRadius: 999, padding: "3px 11px", fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: fresco ? "#1f9d57" : "#d68910" }} />
          {data?.ultimoSync ? `Atualizado ${quando(data.ultimoSync)}` : "Aguardando 1ª sincronização"}
        </span>
        <button className="fx-btn" disabled={syncing} onClick={sincronizar} title="Puxa o extrato do Inter agora">{syncing ? "Sincronizando…" : "↻ Sincronizar agora"}</button>
        {syncMsg && <span style={{ color: "var(--txt-faint)" }}>{syncMsg}</span>}
        <span style={{ color: "var(--txt-faint)" }}>· sincroniza sozinho todo dia às 7h</span>
      </div>

      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "12px 15px", fontSize: 13.5, maxWidth: 680 }}>{err}</div>}
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}

      {data && !loading && (
        <>
          {data.saldos && data.saldos.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
              {data.saldos.map((c: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 16px", background: "var(--surface)", minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>{c.nome}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.saldo == null ? "—" : money(c.saldo)}</div>
                </div>
              ))}
              <div style={{ border: "2px solid var(--roxo, #7a4fb0)", borderRadius: "var(--r-card)", padding: "12px 16px", background: "rgba(146,80,172,.06)", minWidth: 160 }}>
                <div style={{ fontSize: 12, color: "var(--txt-soft)" }}>Saldo total (caixa)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--roxo, #7a4fb0)" }}>{money(data.saldoTotal)}</div>
              </div>
            </div>
          )}

          <Chart porMes={data.porMes} />

          {/* tabela mês a mês: saldo inicial -> entradas -> saídas -> saldo final */}
          {data.porMes && data.porMes.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: 22, maxWidth: 980 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--txt-soft)", fontWeight: 600 }}> </th>
                    {data.porMes.map((p: any) => <th key={p.mes} style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>{mesLabel(p.mes)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { l: "Saldo inicial", k: "saldoInicial", c: "var(--txt-soft)", b: false },
                    { l: "(+) Entradas", k: "entradas", c: "#0f6b50", b: false },
                    { l: "(−) Saídas", k: "saidas", c: "#a8332c", b: false },
                    { l: "(=) Saldo final", k: "saldoFinal", c: "var(--txt)", b: true },
                  ].map((row) => (
                    <tr key={row.k} style={{ borderBottom: "1px solid var(--line)", background: row.b ? "rgba(146,80,172,.05)" : undefined }}>
                      <td style={{ padding: "8px 10px", color: row.c, fontWeight: row.b ? 700 : 500 }}>{row.l}</td>
                      {data.porMes.map((p: any) => (
                        <td key={p.mes} style={{ textAlign: "right", padding: "8px 10px", color: row.c, fontWeight: row.b ? 700 : 500 }}>
                          {row.k === "saidas" ? "−" : ""}{money(p[row.k]).replace("−", row.k === "saidas" ? "" : "−")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--txt-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Detalhe por categoria <span style={{ fontWeight: 400, textTransform: "none", color: "var(--txt-faint)" }}>— clique para ver os lançamentos</span></div>

          {data.blocos.map((b: any) => {
            const bl = BLOCO[b.bloco] || { l: b.bloco, c: "var(--txt-soft)" };
            return (
              <div key={b.bloco} style={{ marginBottom: 22, maxWidth: 980 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, borderLeft: `3px solid ${bl.c}`, paddingLeft: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: bl.c }}>{bl.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{money(b.liquido)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {b.categorias.map((c: any) => {
                    const key = b.bloco + c.grupo + c.nome;
                    const aberto = aberta === key;
                    return (
                      <div key={key} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", background: "var(--surface)", overflow: "hidden" }}>
                        <div onClick={() => setAberta(aberto ? null : key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", fontSize: 13, cursor: "pointer" }}>
                          <span style={{ width: 12, color: "var(--txt-faint)", fontSize: 11 }}>{aberto ? "▾" : "▸"}</span>
                          <span style={{ flex: 1 }}><span style={{ color: "var(--txt-faint)" }}>{c.grupo} ›</span> <b>{c.nome}</b> <span style={{ color: "var(--txt-faint)", fontSize: 11.5 }}>({c.itens.length})</span></span>
                          {c.entrada > 0 && <span style={{ color: "#0f6b50", fontSize: 12.5 }}>+{money(c.entrada)}</span>}
                          {c.saida > 0 && <span style={{ color: "#a8332c", fontSize: 12.5 }}>−{money(c.saida)}</span>}
                          <span style={{ fontWeight: 600, width: 110, textAlign: "right" }}>{money(c.liquido)}</span>
                        </div>
                        {aberto && (
                          <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg, #faf8fb)", padding: "4px 13px 8px 35px" }}>
                            {c.itens.map((it: any, idx: number) => (
                              <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: idx < c.itens.length - 1 ? "1px solid var(--line)" : undefined }}>
                                <span style={{ width: 78, color: "var(--txt-faint)" }}>{it.data}</span>
                                <span style={{ flex: 1, color: "var(--txt-soft)" }}>{it.descricao}</span>
                                <span style={{ color: it.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{it.tipo === "credito" ? "+" : "−"}{money(it.valor)}</span>
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
          })}

          {data.naoCategorizado.itens.length > 0 && (
            <div style={{ marginTop: 8, maxWidth: 980 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b5781f", marginBottom: 6 }}>Não categorizado ({data.naoCategorizado.itens.length}) — entradas {money(data.naoCategorizado.entrada)} · saídas {money(data.naoCategorizado.saida)}</div>
              <div style={{ fontSize: 12, color: "var(--txt-faint)", marginBottom: 8 }}>Lançamentos sem regra. Conforme criamos regras, eles entram nos blocos acima.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {data.naoCategorizado.itens.slice(0, 15).map((i: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--txt-soft)", padding: "4px 13px" }}>
                    <span style={{ width: 80, color: "var(--txt-faint)" }}>{i.data}</span>
                    <span style={{ flex: 1 }}>{i.descricao}</span>
                    <span style={{ color: i.tipo === "credito" ? "#0f6b50" : "#a8332c" }}>{i.tipo === "credito" ? "+" : "−"}{money(i.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Segurança & LGPD ---------- */
/* ---------- Saúde / Alertas do financeiro ---------- */
function SaudeTab({ companyId }: { companyId: string }) {
  type Check = { id: string; label: string; sev: "ok" | "atencao" | "critico"; detalhe: string; acao?: string };
  const [checks, setChecks] = useState<Check[]>([]);
  const [resumo, setResumo] = useState({ critico: 0, atencao: 0, ok: 0 });
  const [loading, setLoading] = useState(true);
  const [conc, setConc] = useState<any>(null);
  const [concLoad, setConcLoad] = useState(false);
  const load = useCallback(() => { setLoading(true); fetch(`/api/finance/saude?company=${companyId}`).then((r) => r.json()).then((d) => { setChecks(d.checks || []); setResumo(d.resumo || { critico: 0, atencao: 0, ok: 0 }); }).finally(() => setLoading(false)); }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const money = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function rodarConc() { setConcLoad(true); fetch(`/api/finance/conciliacao?company=${companyId}`).then((r) => r.json()).then(setConc).finally(() => setConcLoad(false)); }
  async function identificar(txId: string, categoriaId: string) {
    if (!categoriaId) return;
    await fetch(`/api/finance/lancamentos?company=${companyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txId, categoriaId }) });
    rodarConc();
  }
  const tone = (s: string) => s === "critico" ? { bg: "#f3dcd8", fg: "#a8332c", dot: "#c0392b", l: "Crítico" } : s === "atencao" ? { bg: "#f6e7cd", fg: "#b5781f", dot: "#d68910", l: "Atenção" } : { bg: "#d7ebe2", fg: "#0f6b50", dot: "#1f9d57", l: "OK" };
  const order: Record<string, number> = { critico: 0, atencao: 1, ok: 2 };
  const sorted = [...checks].sort((a, b) => order[a.sev] - order[b.sev]);
  return (
    <>
      <TabHeader title="Saúde do financeiro" subtitle="A Sandra checa sozinha o que falta configurar ou está pendente." />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {([["critico", resumo.critico, "#a8332c", "#f3dcd8"], ["atencao", resumo.atencao, "#b5781f", "#f6e7cd"], ["ok", resumo.ok, "#0f6b50", "#d7ebe2"]] as const).map(([k, n, fg, bg]) => (
          <div key={k} style={{ flex: 1, minWidth: 130, borderRadius: "var(--r-card)", padding: "12px 15px", background: bg }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: fg }}>{n}</div>
            <div style={{ fontSize: 12, color: fg }}>{k === "ok" ? "OK" : k === "atencao" ? "Atenção" : "Crítico"}</div>
          </div>
        ))}
        <button className="fx-btn" style={{ alignSelf: "center" }} onClick={load}>Recarregar</button>
      </div>
      {loading && <p style={{ color: "var(--txt-faint)" }}>Verificando…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((c) => { const t = tone(c.sev); return (
          <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 15px", background: "var(--surface)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.dot, marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{c.label} <span style={{ fontSize: 10.5, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: "1px 8px", marginLeft: 4 }}>{t.l}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--txt-soft)", marginTop: 2 }}>{c.detalhe}</div>
              {c.acao && <div style={{ fontSize: 12, color: "var(--txt-faint)", marginTop: 2 }}>→ {c.acao}</div>}
            </div>
          </div>
        ); })}
      </div>

      <Section title="Conciliação / vigilância dos dados">
        <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 10, maxWidth: 720 }}>Cruza o extrato com as contas e regras e aponta divergências: lançamentos sem categoria, contas desatualizadas, contas faltando. Roda nos últimos 90 dias.</div>
        <button className="fx-btn fx-btn-primary" onClick={rodarConc} disabled={concLoad}>{concLoad ? "Cruzando dados…" : "Rodar conciliação"}</button>
        {conc && (
          <div style={{ marginTop: 14 }}>
            {(conc.alertas || []).map((a: any, i: number) => { const t = tone(a.sev); return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--txt-soft)" }}>{a.texto}</span>
              </div>
            ); })}
            {conc.contas?.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--txt-soft)" }}>
                <b>Contas:</b> {conc.contas.map((c: any) => `${c.nome} (${c.total} lanç.${c.ultimo ? ", último " + new Date(c.ultimo).toLocaleDateString("pt-BR") : ""})`).join(" · ")}
              </div>
            )}
            {conc.naoCategorizado?.qtd > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--coral-deep)", marginBottom: 6 }}>Sem categoria ({conc.naoCategorizado.qtd}) — {money(conc.naoCategorizado.valor)}</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)", marginBottom: 6 }}>Identifique cada lançamento escolhendo a categoria — ela é fixada nesse lançamento e tem prioridade sobre as regras.</div>
                {conc.naoCategorizado.itens.map((it: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--txt-soft)", padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ width: 64, color: "var(--txt-faint)" }}>{new Date(it.data).toLocaleDateString("pt-BR").slice(0, 5)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{it.descricao} <span style={{ color: "var(--txt-faint)" }}>· {it.origem}</span></span>
                    <span style={{ color: it.tipo === "credito" ? "#0f6b50" : "#a8332c", width: 90, textAlign: "right" }}>{it.tipo === "credito" ? "+" : "−"}{money(it.valor)}</span>
                    {it.id && (
                      <select className="fx-input" defaultValue="" style={{ maxWidth: 190, fontSize: 12 }} onChange={(e) => { if (e.target.value) identificar(it.id, e.target.value); }}>
                        <option value="">categoria…</option>
                        {(conc.categorias || []).map((c: any) => <option key={c.id} value={c.id}>{c.grupo} › {c.nome}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}

function SegurancaTab({ companyId }: { companyId: string }) {
  const [data, setData] = useState<{ logs: { id: string; at: string; userName: string | null; action: string; entity: string; entityId: string | null; ip: string | null; meta: string | null }[]; encryption: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/audit?company=${companyId}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [companyId]);

  // PIN de pagamento (o proprio usuario define; nunca devolvemos o PIN)
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  const [pinMsg, setPinMsg] = useState(""); const [savingPin, setSavingPin] = useState(false);
  const loadPin = useCallback(() => { fetch(`/api/finance/payment-pin`).then((r) => r.json()).then((d) => setHasPin(!!d.hasPin)).catch(() => {}); }, []);
  useEffect(() => { loadPin(); }, [loadPin]);
  async function salvarPin() {
    setPinMsg("");
    if (pin.length < 4 || !/^[0-9]+$/.test(pin)) { setPinMsg("Use ao menos 4 dígitos numéricos."); return; }
    if (pin !== pin2) { setPinMsg("Os dois campos não conferem."); return; }
    setSavingPin(true);
    try {
      const r = await fetch(`/api/finance/payment-pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Falha");
      setPin(""); setPin2(""); setPinMsg("PIN salvo com segurança."); loadPin();
    } catch (e: any) { setPinMsg(e.message || "Falha"); }
    setSavingPin(false);
  }

  const ACT: Record<string, { l: string; c: string }> = {
    view: { l: "consultou", c: "#274b6d" }, create: { l: "criou", c: "#0f6b50" },
    update: { l: "alterou", c: "#b5781f" }, delete: { l: "excluiu", c: "#a8332c" },
    export: { l: "exportou", c: "#7a3fa0" }, pay: { l: "pagou", c: "#a8332c" },
  };
  const ENT: Record<string, string> = { extrato: "Extrato", solicitacao: "Solicitação", cobranca: "Cobrança", recebivel: "Recebível", cliente: "Cliente/Paciente", config: "Configuração" };

  return (
    <>
      <TabHeader title="Segurança & LGPD" subtitle="Quem acessou e alterou dados sensíveis. Dado de saúde é categoria especial na LGPD — registramos tudo e protegemos." />

      {/* Estado das proteções */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 680, marginBottom: 22 }}>
        {[
          { ok: true, t: "Acesso por papel", d: "Dados financeiros e de paciente só aparecem para admin e financeiro." },
          { ok: true, t: "Trilha de auditoria", d: "Cada acesso/alteração sensível fica registrado (abaixo)." },
          { ok: data?.encryption, t: "Criptografia em repouso (CPF)", d: data?.encryption ? "Chave configurada — CPFs cifrados (AES-256-GCM)." : "Falta definir a variável DATA_ENC_KEY no servidor para ativar." },
          { ok: true, t: "Segredos protegidos", d: "Chaves do banco/gateway nunca saem do servidor." },
        ].map((x) => (
          <div key={x.t} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "11px 14px", background: "var(--surface)" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: x.ok ? "#d7ebe2" : "#f6e7cd", color: x.ok ? "#0f6b50" : "#b5781f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{x.ok ? "✓" : "!"}</span>
            <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{x.t}</div><div style={{ fontSize: 12.5, color: "var(--txt-faint)" }}>{x.d}</div></div>
          </div>
        ))}
      </div>

      {/* PIN de pagamento */}
      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>PIN de pagamento</div>
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px", background: "var(--surface)", maxWidth: 480, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: hasPin ? "#d7ebe2" : "#f6e7cd", color: hasPin ? "#0f6b50" : "#b5781f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{hasPin ? "\u2713" : "!"}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{hasPin == null ? "Verificando…" : hasPin ? "PIN cadastrado" : "Você ainda não tem PIN"}</span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--txt-faint)", margin: "0 0 12px" }}>O PIN confirma os pagamentos antes de saírem. É pessoal e só você o conhece — fica guardado cifrado, ninguém (nem a Sandra) consegue lê-lo.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label={hasPin ? "Novo PIN" : "PIN (mín. 4 dígitos)"}><input className="fx-input" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} maxLength={8} style={{ maxWidth: 150 }} /></Field>
          <Field label="Repita o PIN"><input className="fx-input" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))} maxLength={8} style={{ maxWidth: 150 }} /></Field>
          <button className="fx-btn fx-btn-primary" disabled={savingPin} onClick={salvarPin} style={{ marginBottom: 10 }}>{savingPin ? "Salvando…" : hasPin ? "Trocar PIN" : "Cadastrar PIN"}</button>
        </div>
        {pinMsg && <div style={{ fontSize: 12.5, color: pinMsg.includes("salvo") ? "#0f6b50" : "#a8332c", marginTop: 2 }}>{pinMsg}</div>}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--txt-soft)", marginBottom: 8 }}>Trilha de auditoria</div>
      {loading && <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>}
      {data && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
          {data.logs.length === 0 && <p style={{ color: "var(--txt-faint)" }}>Nenhum acesso registrado ainda.</p>}
          {data.logs.map((l) => {
            const a = ACT[l.action] || { l: l.action, c: "var(--txt-soft)" };
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "9px 13px", background: "var(--surface)", fontSize: 13 }}>
                <span style={{ color: "var(--txt-faint)", width: 116, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{new Date(l.at).toLocaleString("pt-BR")}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{l.userName || "—"}</b> <span style={{ color: a.c, fontWeight: 600 }}>{a.l}</span> {ENT[l.entity] || l.entity}{l.meta ? <span style={{ color: "var(--txt-faint)" }}> · {l.meta}</span> : ""}</span>
                <span style={{ color: "var(--txt-faint)", fontSize: 11.5, flexShrink: 0 }}>{l.ip || ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Iugu (gateway) ---------- */
function IuguPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; accountId: string | null; testMode: boolean; lastSyncAt: string | null }>({ connected: false, accountId: null, testMode: false, lastSyncAt: null });
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch(`/api/finance/iugu?company=${companyId}`).then((r) => r.json()).then((d) => setStatus(d)).finally(() => setLoaded(true));
  }, [companyId]);
  useEffect(load, [load]);

  async function connect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch("/api/finance/iugu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, apiToken: token.trim(), accountId: accountId.trim() || null, testMode }) });
    const d = await res.json();
    setBusy(false);
    if (res.ok) { setToken(""); setMsg(d.webhookRegistered ? "Iugu conectada e webhook registrado ✓" : "Iugu conectada ✓ (webhook manual no painel da Iugu)"); load(); }
    else setErr(d.error || "Não foi possível conectar.");
  }
  async function disconnect() {
    if (!confirm("Desconectar a Iugu desta empresa?")) return;
    await fetch(`/api/finance/iugu?company=${companyId}`, { method: "DELETE" });
    load();
  }

  if (!loaded) return <p style={{ color: "var(--txt-faint)" }}>Carregando…</p>;

  return (
    <>
      {msg && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#f3dcd8", color: "#a8332c", border: "1px solid #e4b8b1", borderRadius: "var(--r-card)", padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
      {status.connected ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 620, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0f6b50" }} />
            <b style={{ fontSize: 14 }}>Iugu conectada</b>
            {status.testMode && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5781f", background: "#f6e7cd", borderRadius: 999, padding: "1px 7px" }}>modo teste</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--txt-soft)" }}>Conta: {status.accountId || "—"}</div>
          {isAdmin && <button className="fx-btn" style={{ marginTop: 12, color: "var(--coral-deep)" }} onClick={disconnect}>Desconectar</button>}
        </div>
      ) : isAdmin ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 16, maxWidth: 620 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Conectar Iugu</div>
          <Field label="API Token"><input className="fx-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole o token da Iugu" autoComplete="off" /></Field>
          <Field label="Account ID (opcional)"><input className="fx-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--txt-soft)", margin: "4px 0 12px", cursor: "pointer" }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--roxo)" }} />
            Token de teste (sandbox)
          </label>
          <button className="fx-btn fx-btn-primary" disabled={busy || token.trim().length < 10} onClick={connect}>{busy ? "Conectando…" : "Conectar e validar"}</button>
        </div>
      ) : (
        <p style={{ color: "var(--txt-faint)" }}>A Iugu ainda não foi conectada. Peça a um admin.</p>
      )}
    </>
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
  const [cats, setCats] = useState<{ id: string; grupo: string; nome: string }[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [grupo, setGrupo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [departamentos, setDepartamentos] = useState<{ id: string; nome: string }[]>([]);
  const [departamentoId, setDepartamentoId] = useState("");
  const [recorrencia, setRecorrencia] = useState("unica");
  const [docNumero, setDocNumero] = useState("");
  const [prazo, setPrazo] = useState("avista");
  const [prioridade, setPrioridade] = useState("normal");
  const [centroCusto, setCentroCusto] = useState("");
  const [obs, setObs] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/finance/categorias?company=${companyId}&tipo=despesa`)
      .then((r) => r.json())
      .then((d) => setCats(d.categorias || []))
      .finally(() => setCatsLoaded(true));
    fetch(`/api/finance/departamentos?company=${companyId}`)
      .then((r) => r.json())
      .then((d) => setDepartamentos(d.departamentos || []))
      .catch(() => {});
  }, [companyId]);

  const grupos = Array.from(new Set(cats.map((c) => c.grupo)));
  const catsDoGrupo = cats.filter((c) => c.grupo === grupo);
  const usaPlano = cats.length > 0;

  // Campos obrigatórios — a solicitação só é enviada com tudo preenchido.
  const faltando: string[] = [];
  if (!spaceId) faltando.push("Área");
  if (kind === "padrao" && !credorId) faltando.push("Credor/Favorecido");
  if (!descricao.trim()) faltando.push("Descrição");
  if (!Number(valor)) faltando.push("Valor");
  if (!vencimento) faltando.push("Vencimento");
  if (usaPlano && !categoriaId) faltando.push("Categoria");
  if (departamentos.length > 0 && !departamentoId) faltando.push("Departamento");
  const completo = faltando.length === 0;

  async function submit() {
    setErr("");
    if (faltando.length) return setErr(`Preencha tudo para enviar — falta: ${faltando.join(", ")}.`);
    const area = areas.find((a) => a.id === spaceId);
    if (!area) return setErr("Escolha a área.");
    const catObj = cats.find((c) => c.id === categoriaId);
    const categoriaTexto = catObj ? `${catObj.grupo} › ${catObj.nome}` : (categoria || null);
    setBusy(true);
    const res = await fetch("/api/finance/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, kind, spaceId, areaName: area.name, credorId: credorId || null, descricao, valor: Number(valor), vencimento: vencimento || null, formaPagamento: forma, categoriaId: categoriaId || null, categoria: categoriaTexto, departamentoId: departamentoId || null, recorrencia, docNumero: docNumero || null, prazoPagamento: prazo, prioridade, centroCusto: centroCusto || null, observacao: obs || null }),
    });
    const d = await res.json();
    if (res.ok) {
      if (files.length && d.request?.id) {
        for (const f of files) {
          const fd = new FormData(); fd.append("file", f); fd.append("tag", kind === "reembolso" ? "comprovante" : "nf");
          await fetch(`/api/finance/requests/${d.request.id}/upload`, { method: "POST", body: fd }).catch(() => {});
        }
      }
      setBusy(false);
      onCreated();
    } else { setBusy(false); setErr(d.error || "Erro ao criar."); }
  }

  return (
    <Drawer title="Nova solicitação de pagamento" onClose={onClose}>
      <Row><Field label="Tipo"><select className="fx-input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="padrao">Padrão (compra/serviço)</option><option value="reembolso">Reembolso</option></select></Field>
        <Field label="Área*"><select className="fx-input" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}><option value="">Selecione…</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></Row>
      <Field label={kind === "padrao" ? "Credor / Favorecido*" : "Credor / Favorecido"}><select className="fx-input" value={credorId} onChange={(e) => setCredorId(e.target.value)}><option value="">— selecione ou cadastre na aba Credores —</option>{credores.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.documento}</option>)}</select></Field>
      <Field label="Descrição / justificativa*"><textarea className="fx-input" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
      <Row><Field label="Valor (R$)*"><input className="fx-input" type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Field label="Vencimento*"><input className="fx-input" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field></Row>
      <Row><Field label="Forma de pagamento"><select className="fx-input" value={forma} onChange={(e) => setForma(e.target.value)}><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="guia">Guia/DARF</option><option value="cartao">Cartão</option></select></Field>
        <Field label="Recorrência"><select className="fx-input" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)}><option value="unica">Única</option><option value="mensal">Mensal</option></select></Field></Row>
      {usaPlano ? (
        <Row><Field label="Grupo (plano de contas)"><select className="fx-input" value={grupo} onChange={(e) => { setGrupo(e.target.value); setCategoriaId(""); }}><option value="">Selecione…</option>{grupos.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
          <Field label="Categoria*"><select className="fx-input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={!grupo}><option value="">{grupo ? "Selecione…" : "Escolha o grupo primeiro"}</option>{catsDoGrupo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field></Row>
      ) : (
        <Row><Field label="Categoria (sugerida)"><select className="fx-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">—</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Nº documento / NF"><input className="fx-input" value={docNumero} onChange={(e) => setDocNumero(e.target.value)} /></Field></Row>
      )}
      {usaPlano && <Field label="Nº documento / NF"><input className="fx-input" value={docNumero} onChange={(e) => setDocNumero(e.target.value)} /></Field>}
      {catsLoaded && !usaPlano && <p style={{ fontSize: 11.5, color: "var(--txt-faint)", margin: "-4px 0 0" }}>Dica: o admin pode importar o plano de contas completo em Financeiro › Categorias.</p>}
      <Row><Field label="Prazo de pagamento"><select className="fx-input" value={prazo} onChange={(e) => setPrazo(e.target.value)}><option value="avista">À vista</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="data">Na data do vencimento</option><option value="parcelado">Parcelado</option></select></Field>
        <Field label="Prioridade"><select className="fx-input" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field></Row>
      {departamentos.length > 0 ? (
        <Row><Field label="Departamento*"><select className="fx-input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}><option value="">Selecione…</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></Field>
          <Field label="Centro de custo (opcional)"><input className="fx-input" value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} placeholder="detalhe (ex.: Sede / Obra)" /></Field></Row>
      ) : (
        <Field label="Centro de custo (opcional)"><input className="fx-input" value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} placeholder="ex.: Sede / Obra / Cursinho" /></Field>
      )}
      <Field label="Observações (opcional)"><textarea className="fx-input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, color: "var(--txt-soft)", marginBottom: 5 }}>Documentos (NF, boleto, comprovante) — opcional, dá pra anexar depois</div>
        <DropZone onFiles={(fs) => setFiles((prev) => [...prev, ...fs])} />
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {files.map((f, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--col)", borderRadius: 999, padding: "3px 6px 3px 11px" }}>
                {f.name}<button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)" }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--txt-faint)", margin: "8px 0 0" }}>Acima de R$ 400 (padrão), o gestor vai exigir cotações ou dispensa.</p>
      {!completo && <p style={{ fontSize: 12.5, color: "var(--amber-deep, #b5781f)", margin: "8px 0 0" }}>Para enviar, preencha: <b>{faltando.join(", ")}</b>.</p>}
      {err && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="fx-btn fx-btn-primary" disabled={busy || !completo} onClick={submit}>Enviar solicitação</button>
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
  function recusar() {
    if (!note.trim()) { setErr("Informe o motivo da recusa no campo de observação abaixo."); return; }
    act("recusar");
  }
  async function upload(files: File[]) {
    for (const f of files) {
      const fd = new FormData(); fd.append("file", f); fd.append("tag", tag);
      await fetch(`/api/finance/requests/${id}/upload`, { method: "POST", body: fd });
    }
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

      {/* Envolvidos: a cadeia da solicitação */}
      <Section title="Envolvidos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {([
            { papel: "Solicitante", uid: r.solicitanteId, feito: true },
            { papel: "Gestor", uid: r.gestorId, feito: !!r.gestorId },
            { papel: "Financeiro", uid: r.financeiroId, feito: !!r.financeiroId },
            { papel: "Pagador", uid: r.pagadorId, feito: !!r.pagadorId },
          ] as { papel: string; uid: string | null; feito: boolean }[]).map((p) => (
            <div key={p.papel} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--col)", borderRadius: 10, padding: "7px 11px", minWidth: 150 }}>
              <span className="fx-avatar" style={{ background: p.uid && nm[p.uid] ? nm[p.uid].color : "var(--line)", width: 26, height: 26, fontSize: 11, opacity: p.uid ? 1 : 0.5 }}>{p.uid && nm[p.uid] ? nm[p.uid].name.charAt(0).toUpperCase() : "?"}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{p.papel}</div>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.uid ? person(p.uid) : "aguardando"}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

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
        <Info label="Prazo de pagamento">{({ avista: "À vista", "7": "7 dias", "15": "15 dias", "30": "30 dias", data: "Na data", parcelado: "Parcelado" } as Record<string, string>)[r.prazoPagamento || ""] || "—"}</Info>
        <Info label="Prioridade">{r.prioridade ? r.prioridade[0].toUpperCase() + r.prioridade.slice(1) : "Normal"}</Info>
      </Grid2>
      {r.observacao && <div style={{ fontSize: 13, color: "var(--txt-soft)", marginBottom: 8 }}><b>Obs.:</b> {r.observacao}</div>}

      {/* Anexos */}
      <Section title="Documentos">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>Tipo:</span>
          <select className="fx-input" value={tag} onChange={(e) => setTag(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="nf">NF</option><option value="boleto">Boleto</option><option value="comprovante">Comprovante</option><option value="cotacao">Cotação</option><option value="outro">Outro</option>
          </select>
        </div>
        <DropZone onFiles={(fs) => upload(fs)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={recusar}>Recusar</button>
          </div>
        </Section>
      )}
      {r.status === "aprovada_gestor" && canFin && (
        <Section title="Conferência do financeiro">
          <Field label="Conta de origem (de qual conta sai)"><input className="fx-input" value={conta} onChange={(e) => setConta(e.target.value)} placeholder="ex.: Inter PJ / Cora" /></Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="fx-btn fx-btn-primary" disabled={busy} onClick={() => act("conferir", { contaOrigem: conta })}>Conferir e enviar ao pagador</button>
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={recusar}>Recusar</button>
          </div>
        </Section>
      )}
      {r.status === "conferida" && canPag && (
        <Section title="Pagamento (sócio)">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fx-btn fx-btn-primary" disabled={busy} onClick={() => act("pagar")}>Marcar como PAGO</button>
            <button className="fx-btn" style={{ color: "var(--coral-deep)" }} disabled={busy} onClick={recusar}>Recusar</button>
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
  const [drive, setDrive] = useState<any>(null);
  useEffect(() => { fetch(`/api/finance/gdrive/status?company=${companyId}`).then((r) => r.json()).then(setDrive).catch(() => {}); }, [companyId]);
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
