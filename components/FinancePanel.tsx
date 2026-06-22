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
    if (isApprover) setTab("aprov");
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
  const sections: { k: string; l: string; soon?: boolean }[] = [
    { k: "solicitar", l: "Solicitar" },
    ...(isApprover ? [{ k: "aprov", l: "Aprovações" }] : []),
    ...(isAdmin || isFinanceiro ? [{ k: "painel", l: "Contas a Pagar" }] : []),
    ...(isAdmin || isFinanceiro ? [{ k: "cred", l: "Credores" }] : []),
    ...(isAdmin || isFinanceiro ? [{ k: "receber", l: "Contas a Receber" }] : []),
    ...(isAdmin || isFinanceiro ? [{ k: "categorias", l: "Categorias" }] : []),
    ...(isTP ? [{ k: "aulas", l: "Aulas Particulares", soon: true }] : []),
    { k: "relatorios", l: "Relatórios", soon: true },
    ...(isAdmin ? [{ k: "cfg", l: "Configuração" }] : []),
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
        {flash && <div style={{ background: "#d7ebe2", color: "#0f6b50", border: "1px solid #9fe1cb", borderRadius: "var(--r-card)", padding: "11px 15px", fontSize: 13.5, fontWeight: 500, marginBottom: 16 }}>{flash}</div>}
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
      body: JSON.stringify({ companyId, kind, spaceId, areaName: area.name, credorId: credorId || null, descricao, valor: Number(valor), vencimento: vencimento || null, formaPagamento: forma, categoriaId: categoriaId || null, categoria: categoriaTexto, recorrencia, docNumero: docNumero || null, prazoPagamento: prazo, prioridade, centroCusto: centroCusto || null, observacao: obs || null }),
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
      <Field label="Centro de custo (opcional)"><input className="fx-input" value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} placeholder="ex.: Sede / Obra / Cursinho" /></Field>
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
