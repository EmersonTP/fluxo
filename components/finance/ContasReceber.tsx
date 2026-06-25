"use client";
import { useState } from "react";
import { CobrancaGateway } from "./CobrancaGateway";
import { MembershipsTab } from "./MembershipsTab";
import { TitulosTab } from "./TitulosTab";

export function ContasReceber({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
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
