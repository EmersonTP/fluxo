"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function VerifyPage() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMsg("Link inválido.");
      return;
    }
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setState("ok");
        else {
          setState("error");
          setMsg(d.error || "Não foi possível confirmar.");
        }
      })
      .catch(() => {
        setState("error");
        setMsg("Falha de conexão.");
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#f3e9f6,#f7f1e8)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,.12)", padding: 32, textAlign: "center", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#9250ac", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", fontWeight: 600, fontSize: 22, margin: "0 auto 16px" }}>S</div>
        {state === "loading" && <p style={{ color: "#6b655d" }}>Confirmando seu e-mail…</p>}
        {state === "ok" && (
          <>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, margin: "0 0 8px", color: "#33302c" }}>E-mail confirmado! ✅</h1>
            <p style={{ color: "#6b655d", fontSize: 15 }}>Sua conta está ativa. Agora é só entrar.</p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 16, background: "#9250ac", color: "#fff", textDecoration: "none", padding: "10px 22px", borderRadius: 10, fontWeight: 600 }}>Entrar na Sandra</Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, margin: "0 0 8px", color: "#d85a30" }}>Ops…</h1>
            <p style={{ color: "#6b655d", fontSize: 15 }}>{msg}</p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 16, color: "#6f3a87", fontWeight: 600 }}>Voltar ao login</Link>
          </>
        )}
      </div>
    </div>
  );
}
