"use client";
import { useState } from "react";
import { AsaasPanel } from "./AsaasPanel";
import { InterPanel } from "./InterPanel";
import { IuguPanel } from "./IuguPanel";

export function CobrancaGateway({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
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
