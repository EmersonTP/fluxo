"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha deve ter ao menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await res.json();
      if (res.ok) setDone(true);
      else setError(d.error || "Não foi possível redefinir.");
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = { width: "100%", border: "1px solid #e6ddd0", borderRadius: 10, padding: "10px 12px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#f3e9f6,#f7f1e8)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,.12)", padding: 32, fontFamily: "system-ui,sans-serif" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#9250ac", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", fontWeight: 600, fontSize: 22, marginBottom: 16 }}>S</div>
        {done ? (
          <>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, margin: "0 0 8px", color: "#33302c" }}>Senha alterada! ✅</h1>
            <p style={{ color: "#6b655d", fontSize: 15 }}>Pronto, já pode entrar com a nova senha.</p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 16, background: "#9250ac", color: "#fff", textDecoration: "none", padding: "10px 22px", borderRadius: 10, fontWeight: 600 }}>Entrar</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, margin: "0 0 4px", color: "#33302c" }}>Criar nova senha</h1>
            <p style={{ color: "#6b655d", fontSize: 14, marginTop: 0 }}>Escolha uma senha nova pra sua conta.</p>
            <form onSubmit={submit}>
              <input type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} required />
              <input type="password" placeholder="Confirme a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inp} required />
              {error && <p style={{ color: "#d85a30", fontSize: 13, margin: "4px 0" }}>{error}</p>}
              <button type="submit" disabled={loading || !token} style={{ width: "100%", background: "#9250ac", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading || !token ? 0.6 : 1 }}>
                {loading ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
            {!token && <p style={{ color: "#d85a30", fontSize: 13, marginTop: 10 }}>Link inválido. Peça um novo em “Esqueci minha senha”.</p>}
          </>
        )}
      </div>
    </div>
  );
}
