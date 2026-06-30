"use client";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Item = { nome: string; lista: string; acoes?: string[] };
type Rep = { pessoa: { id: string; name: string }; date: string; concluidas: { name: string; list?: { name: string } }[]; trabalhadas: Item[]; texto: string };

function hoje() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function ReportDiaPage() {
  const [membros, setMembros] = useState<{ id: string; name: string }[]>([]);
  const [me, setMe] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [date, setDate] = useState<string>(hoje());
  const [rep, setRep] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => { const id = d?.user?.id || d?.id || ""; setMe(id); setUserId((u) => u || id); }).catch(() => {});
    fetch("/api/members").then((r) => r.json()).then((d) => setMembros(d.members || [])).catch(() => {});
  }, []);

  const carregar = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/report-dia?date=${date}&userId=${userId}`).then((r) => r.json()).then((d) => setRep(d)).catch(() => setRep(null)).finally(() => setLoading(false));
  }, [userId, date]);

  useEffect(() => { carregar(); }, [carregar]);

  async function copiar() {
    if (!rep?.texto) return;
    try { await navigator.clipboard.writeText(rep.texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
  }

  const total = (rep?.concluidas?.length || 0) + (rep?.trabalhadas?.length || 0);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="fx-topbar">
        <div>
          <div style={{ fontSize: 11, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>Fim do dia</div>
          <div className="fx-title">Report do dia</div>
        </div>
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 760 }}>
        <p style={{ color: "var(--txt-soft)", fontSize: 14, marginTop: 0 }}>
          A Sandra monta o report automaticamente com o que você fez na plataforma hoje. Revise e copie pro grupo.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "14px 0 18px" }}>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={sel}>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (eu)` : m.name}</option>
            ))}
          </select>
          <input type="date" value={date} max={hoje()} onChange={(e) => setDate(e.target.value)} style={sel} />
          <button onClick={carregar} style={{ ...sel, cursor: "pointer", background: "var(--surface)" }}>Atualizar</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--txt-faint)", padding: "30px 0" }}>Montando o report…</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 14 }}>
              <button onClick={copiar} disabled={!rep?.texto} style={{ background: "var(--roxo, #7a3fa0)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {copiado ? "✓ Copiado!" : "Copiar pro grupo"}
              </button>
              <span style={{ color: "var(--txt-faint)", fontSize: 13 }}>{total} item(ns) no dia</span>
            </div>

            {rep && total > 0 ? (
              <>
                {rep.concluidas?.length > 0 && (
                  <Bloco titulo={`✅ Concluí (${rep.concluidas.length})`}>
                    {rep.concluidas.map((t, i) => (
                      <Linha key={i} nome={t.name} lista={t.list?.name} />
                    ))}
                  </Bloco>
                )}
                {rep.trabalhadas?.length > 0 && (
                  <Bloco titulo={`🔧 Trabalhei em (${rep.trabalhadas.length})`}>
                    {rep.trabalhadas.map((t, i) => (
                      <Linha key={i} nome={t.nome} lista={t.lista} acoes={t.acoes} />
                    ))}
                  </Bloco>
                )}
              </>
            ) : (
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "26px 20px", textAlign: "center", color: "var(--txt-soft)" }}>
                Nenhuma atividade registrada na Sandra nesse dia.
                <div style={{ fontSize: 12.5, color: "var(--txt-faint)", marginTop: 6 }}>O que foi feito fora da plataforma (ligações, reuniões) não aparece aqui.</div>
              </div>
            )}

            {rep?.texto && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 11.5, color: "var(--txt-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Prévia (texto pro WhatsApp)</div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", color: "var(--txt)", lineHeight: 1.5 }}>{rep.texto}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const sel: CSSProperties = { padding: "8px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--txt)", fontSize: 14 };

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="serif" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function Linha({ nome, lista, acoes }: { nome: string; lista?: string; acoes?: string[] }) {
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 14 }}>{nome}</div>
        {lista && <div style={{ fontSize: 12, color: "var(--txt-faint)" }}>{lista}</div>}
      </div>
      {acoes && acoes.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {acoes.map((a, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--txt-soft)", background: "var(--bg, #f4eef7)", borderRadius: 999, padding: "2px 8px" }}>{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}
