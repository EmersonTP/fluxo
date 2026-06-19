"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { WorkspaceT, SpaceT } from "@/lib/types";
import NotificationBell from "./NotificationBell";
import SearchPalette from "./SearchPalette";
import PrivacyMenu from "./PrivacyMenu";

type User = { id: string; name: string; email: string; role: string };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  spaces: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  tasks: "M9 11l3 3 8-8M4 6h.01M4 12h.01M4 18h.01M9 18h11M9 6h11",
  sprint: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  chat: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z",
  reports: "M3 3v18h18M7 16V9M12 16V5M17 16v-7",
  productivity: "M22 12h-4l-3 9L9 3l-3 9H2",
  docs: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6",
  admin: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 8l2 2 4-4",
  finance: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5z",
};

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<WorkspaceT[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [width, setWidth] = useState(248);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string; modules: string }[]>([]);
  const [activeCompany, setActiveCompany] = useState<string>("");
  const [companyMenu, setCompanyMenu] = useState(false);
  const widthRef = useRef(248);

  function switchCompany(id: string) {
    setActiveCompany(id);
    setCompanyMenu(false);
    try { localStorage.setItem("fx:company", id); } catch {}
  }

  function loadHierarchy() {
    return fetch("/api/hierarchy")
      .then((r) => r.json())
      .then((d) => setWorkspaces(d.workspaces || []));
  }

  async function createList(name: string, parent: { spaceId?: string; folderId?: string }) {
    if (!name.trim()) return;
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), ...parent }),
    });
    await loadHierarchy();
  }

  async function createSpace(name: string, workspaceId: string) {
    if (!name.trim()) return;
    await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), workspaceId }),
    });
    await loadHierarchy();
  }

  useEffect(() => {
    loadHierarchy().finally(() => setLoading(false));
    fetch("/api/companies").then((r) => r.json()).then((d) => {
      const cs = d.companies || [];
      setCompanies(cs);
      let saved = "";
      try { saved = localStorage.getItem("fx:company") || ""; } catch {}
      const valid = cs.find((c: { id: string }) => c.id === saved);
      setActiveCompany(valid ? saved : cs[0]?.id || "");
    });
    try {
      setDark(localStorage.getItem("fluxo:theme") === "dark");
      const w = Number(localStorage.getItem("fluxo:sidebarW"));
      if (w >= 180 && w <= 460) {
        setWidth(w);
        widthRef.current = w;
      }
      setCollapsed(localStorage.getItem("fluxo:sidebarCollapsed") === "1");
    } catch {}
  }, []);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    function onMove(ev: MouseEvent) {
      const w = Math.min(460, Math.max(180, startW + ev.clientX - startX));
      widthRef.current = w;
      setWidth(w);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem("fluxo:sidebarW", String(widthRef.current));
      } catch {}
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Detecta tela pequena (celular/tablet) e recolhe a barra por padrão
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      setMobile(mq.matches);
      if (mq.matches) setCollapsed(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // No celular, fecha a gaveta ao navegar
  useEffect(() => {
    if (mobile) setCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("fluxo:sidebarCollapsed", next ? "1" : "0");
    } catch {}
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("fluxo:theme", next ? "dark" : "light");
    } catch {}
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isAdmin = user.role === "owner" || user.role === "admin";
  const railItems = [
    { icon: "home", label: "Início", href: "/" },
    { icon: "tasks", label: "Tarefas", href: "/minhas-tarefas" },
    { icon: "sprint", label: "Sprints", href: "/sprints" },
    { icon: "chat", label: "Chat", href: "/chat" },
    { icon: "docs", label: "Docs", href: "/documentos" },
    { icon: "finance", label: "Contas a Pagar", href: "/financeiro" },
    { icon: "reports", label: "Relatórios", href: "/relatorios" },
    ...(isAdmin ? [{ icon: "productivity", label: "Produtividade", href: "/produtividade" }] : []),
    ...(isAdmin ? [{ icon: "admin", label: "Admin", href: "/admin" }] : []),
    { icon: "gear", label: "Config", href: "/configuracoes" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Icon rail */}
      <div className="fx-rail">
        <Link href="/" className="fx-rail-brand" title="Sandra">
          S
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, width: "100%", alignItems: "center" }}>
          <button className="fx-rail-item" title="Buscar (⌘K)" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
            <span className="fx-rail-label">Buscar</span>
          </button>
          <button
            className={`fx-rail-item ${!collapsed ? "active" : ""}`}
            title="Espaços (abrir/fechar barra)"
            onClick={toggleCollapse}
          >
            <Icon name="spaces" />
            <span className="fx-rail-label">Espaços</span>
          </button>
          {railItems.map((it) => {
            const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} className={`fx-rail-item ${active ? "active" : ""}`} title={it.label}>
                <Icon name={it.icon} />
                <span className="fx-rail-label">{it.label}</span>
              </Link>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <NotificationBell />
        </div>
        <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
          <button onClick={() => setMenuOpen((o) => !o)} className="fx-rail-avatar" title={user.name}>
            {user.name.charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div className="fx-usermenu">
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-faint)", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                </div>
                <Link href="/configuracoes" className="fx-menuitem" onClick={() => setMenuOpen(false)}>
                  Configurações
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="fx-menuitem" onClick={() => setMenuOpen(false)}>
                    Adicionar usuário
                  </Link>
                )}
                <button className="fx-menuitem" onClick={toggleTheme}>
                  {dark ? "Modo claro" : "Modo escuro"}
                </button>
                <button className="fx-menuitem" style={{ color: "var(--coral-deep)" }} onClick={logout}>
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Backdrop da gaveta no mobile */}
      {mobile && !collapsed && (
        <div onClick={toggleCollapse} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 44 }} />
      )}

      {/* Wider sidebar (spaces) */}
      <aside
        className="fx-side"
        style={
          mobile
            ? {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 66,
                width: collapsed ? 0 : "min(82vw, 300px)",
                zIndex: 45,
                boxShadow: collapsed ? "none" : "var(--shadow-modal)",
                display: "flex",
                flexDirection: "column",
                padding: collapsed ? 0 : "16px 12px",
                overflowX: "hidden",
                overflowY: "auto",
              }
            : {
                width: collapsed ? 0 : width,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                padding: collapsed ? 0 : "16px 12px",
                overflowX: "hidden",
                overflowY: "auto",
              }
        }
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px 10px" }}>
          <Link href="/" className="fx-brand">
            Sandra<b>.</b>
          </Link>
          <button onClick={toggleCollapse} title="Recolher barra" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
            «
          </button>
        </div>

        {/* Switcher de empresa (abrir por empresa) */}
        {companies.length > 0 && (
          <div style={{ position: "relative", margin: "0 4px 12px" }}>
            <button
              onClick={() => setCompanyMenu((s) => !s)}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, cursor: "pointer", font: "inherit", textAlign: "left" }}
              title="Trocar de empresa"
            >
              {(() => { const c = companies.find((x) => x.id === activeCompany); const color = COMPANY_COLORS[Math.max(0, companies.findIndex((x) => x.id === activeCompany)) % COMPANY_COLORS.length]; return (
                <>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: color, color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{(c?.name || "?").charAt(0).toUpperCase()}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c?.name || "Empresa"}</span>
                  <span style={{ fontSize: 11, color: "var(--txt-faint)" }}>{companies.length > 1 ? "▾" : ""}</span>
                </>
              ); })()}
            </button>
            {companyMenu && companies.length > 1 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-hover)", zIndex: 30, overflow: "hidden", padding: 4 }}>
                {companies.map((c, i) => (
                  <button key={c.id} onClick={() => switchCompany(c.id)} className="fx-navitem" style={{ width: "100%", fontSize: 13, fontWeight: c.id === activeCompany ? 700 : 400 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: COMPANY_COLORS[i % COMPANY_COLORS.length], color: "#fff", fontWeight: 600, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.name.charAt(0).toUpperCase()}</span>
                    <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    {c.id === activeCompany && <span style={{ color: "var(--roxo)" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {pathname.startsWith("/financeiro") ? (
          <div style={{ fontSize: 12, color: "var(--txt-faint)", padding: "10px 10px", lineHeight: 1.5 }}>
            Módulo <b style={{ color: "var(--txt)" }}>Financeiro</b> da empresa ativa. Use o menu ao lado (Solicitar, Aprovações, Contas a Pagar…). Troque a empresa no seletor acima.
          </div>
        ) : (
          <>
            {loading && <p className="fx-navgroup">Carregando...</p>}
            {workspaces.filter((ws) => !activeCompany || ws.companyId === activeCompany).map((ws, i) => (
              <WorkspaceNode key={ws.id} ws={ws} pathname={pathname} color={COMPANY_COLORS[i % COMPANY_COLORS.length]} onCreateList={createList} onCreateSpace={createSpace} isAdmin={isAdmin} refresh={loadHierarchy} />
            ))}
            {!loading && workspaces.length === 0 && isAdmin && (
              <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: "12px 10px" }}>Sem dados ainda. Rode a importação do ClickUp.</p>
            )}
            {!loading && workspaces.length === 0 && !isAdmin && <AccessRequest />}
          </>
        )}
      </aside>

      {/* Resize handle (apenas desktop) */}
      {!collapsed && !mobile && (
        <div onMouseDown={startResize} title="Arraste para redimensionar" style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: "var(--line)" }} />
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {collapsed && (
          <button
            onClick={toggleCollapse}
            title="Expandir barra"
            style={{ position: "absolute", left: 8, top: 12, zIndex: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer", color: "var(--txt-soft)", fontSize: 16, padding: "4px 9px", boxShadow: "var(--shadow-card)" }}
          >
            »
          </button>
        )}
        {children}
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function AccessRequest() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function request() {
    setLoading(true);
    await fetch("/api/access-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setLoading(false);
    setSent(true);
  }
  return (
    <div style={{ padding: "14px 12px" }}>
      <p style={{ fontSize: 12.5, color: "var(--txt-soft)", lineHeight: 1.5, marginTop: 0 }}>
        Você ainda não tem acesso a nenhum espaço. Solicite ao administrador para ele liberar.
      </p>
      {sent ? (
        <p style={{ fontSize: 12.5, color: "var(--sage)", fontWeight: 600 }}>✓ Solicitação enviada! Aguarde a liberação.</p>
      ) : (
        <button className="fx-btn fx-btn-primary" style={{ width: "100%" }} onClick={request} disabled={loading}>
          {loading ? "Enviando…" : "Solicitar acesso"}
        </button>
      )}
    </div>
  );
}

const SPACE_COLORS = ["var(--roxo)", "var(--coral)", "var(--sage)", "var(--roxo-deep)", "var(--coral-deep)"];
const COMPANY_COLORS = ["#9250ac", "#d85a30", "#1d9e75", "#534ab7", "#ff7e59", "#3b82f6"];

type CreateList = (name: string, parent: { spaceId?: string; folderId?: string }) => void | Promise<void>;

// Botão de 3 pontinhos (⋯) com menu de privacidade — só admin/owner
function Kebab({ type, id, isPrivate, memberIds, refresh }: { type: "space" | "list"; id: string; isPrivate: boolean; memberIds: string[]; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Privacidade / acesso"
        style={{ background: "none", border: "none", cursor: "pointer", color: isPrivate ? "var(--roxo)" : "var(--txt-faint)", fontSize: 15, lineHeight: 1, padding: "0 2px" }}
      >
        {isPrivate ? "🔒" : "⋯"}
      </button>
      {open && (
        <PrivacyMenu type={type} id={id} initialPrivate={isPrivate} initialMemberIds={memberIds} onClose={() => setOpen(false)} onSaved={refresh} />
      )}
    </span>
  );
}

function WorkspaceNode({ ws, pathname, color, onCreateList, onCreateSpace, isAdmin, refresh }: { ws: WorkspaceT; pathname: string; color: string; onCreateList: CreateList; onCreateSpace: (name: string, workspaceId: string) => void | Promise<void>; isAdmin: boolean; refresh: () => void }) {
  const initial = ws.name.charAt(0).toUpperCase();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(ws.name);
  const active = pathname === `/workspace/${ws.id}`;
  async function save() {
    setEditing(false);
    if (val.trim() && val.trim() !== ws.name) {
      await fetch(`/api/workspaces/${ws.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
      refresh();
    }
  }
  return (
    <div style={{ marginTop: 12, borderRadius: 10, background: color + "12", paddingBottom: open ? 4 : 0 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", width: "100%", background: active ? color + "20" : "none", borderRadius: 8 }}
      >
        {editing ? (
          <input
            autoFocus
            className="fx-input"
            style={{ fontSize: 12.5, margin: "1px 0", flex: 1 }}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onBlur={save}
          />
        ) : (
          <Link
            href={`/workspace/${ws.id}`}
            onDoubleClick={(e) => { if (isAdmin) { e.preventDefault(); setVal(ws.name); setEditing(true); } }}
            style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, textDecoration: "none", cursor: "pointer" }}
            title={isAdmin ? "Abrir workspace · duplo-clique pra renomear" : "Abrir workspace"}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: color,
                color: "#fff",
                fontWeight: 600,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {initial}
            </span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5, color: "var(--txt)", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ws.name}
            </span>
          </Link>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--txt-faint)", padding: "2px 4px" }}
          title={open ? "Recolher" : "Expandir"}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>
      {open && (
        <div style={{ borderLeft: `2px solid ${color}`, marginLeft: 20, paddingLeft: 4 }}>
          {ws.spaces.map((sp, i) => (
            <SpaceNode key={sp.id} sp={sp} pathname={pathname} color={sp.color || SPACE_COLORS[i % SPACE_COLORS.length]} onCreateList={onCreateList} isAdmin={isAdmin} refresh={refresh} />
          ))}
          {ws.spaces.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: "4px 10px" }}>Nenhum espaço ainda.</p>
          )}
          {isAdmin && <AddSpaceInput onCreate={(name) => onCreateSpace(name, ws.id)} />}
        </div>
      )}
    </div>
  );
}

function AddSpaceInput({ onCreate }: { onCreate: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!adding) {
    return (
      <button className="fx-navitem" onClick={() => setAdding(true)} style={{ fontSize: 13, color: "var(--roxo)", fontWeight: 600 }}>
        + Espaço
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="fx-input"
      style={{ fontSize: 13, margin: "2px 0" }}
      placeholder="Nome do espaço"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && name.trim()) {
          onCreate(name.trim());
          setName("");
          setAdding(false);
        }
        if (e.key === "Escape") {
          setAdding(false);
          setName("");
        }
      }}
      onBlur={() => {
        setAdding(false);
        setName("");
      }}
    />
  );
}

function SpaceNode({ sp, pathname, color, onCreateList, isAdmin, refresh }: { sp: SpaceT; pathname: string; color: string; onCreateList: CreateList; isAdmin: boolean; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(sp.name);
  async function save() {
    setEditing(false);
    if (val.trim() && val.trim() !== sp.name) {
      await fetch(`/api/spaces/${sp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
      refresh();
    }
  }
  return (
    <div>
      <div className="fx-navitem fx-row-hover" style={{ display: "flex" }}>
        {editing ? (
          <input
            autoFocus
            className="fx-input"
            style={{ fontSize: 13, margin: "1px 0", flex: 1 }}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onBlur={save}
          />
        ) : (
          <>
            <Link
              href={`/space/${sp.id}`}
              onDoubleClick={(e) => { if (isAdmin) { e.preventDefault(); setVal(sp.name); setEditing(true); } }}
              title={isAdmin ? "Abrir espaço · duplo-clique pra renomear" : "Abrir espaço"}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", minWidth: 0 }}
            >
              <span className="fx-dot" style={{ background: color }} />
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{sp.name}</span>
            </Link>
            <button
              onClick={() => setOpen(!open)}
              title={open ? "Recolher" : "Expandir"}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 11, opacity: 0.5, padding: "0 4px" }}
            >
              {open ? "▾" : "▸"}
            </button>
          </>
        )}
        {isAdmin && !editing && <Kebab type="space" id={sp.id} isPrivate={!!sp.private} memberIds={(sp.members || []).map((m) => m.id)} refresh={refresh} />}
      </div>
      {open && (
        <div style={{ marginLeft: 14, borderLeft: "1px solid var(--line)", paddingLeft: 6 }}>
          {sp.lists.map((l) => (
            <ListLink key={l.id} id={l.id} name={l.name} count={l._count?.tasks} pathname={pathname} isPrivate={!!l.private} memberIds={(l.members || []).map((m) => m.id)} isAdmin={isAdmin} refresh={refresh} />
          ))}
          {sp.folders.map((f) => (
            <FolderNode key={f.id} folder={f} pathname={pathname} onCreateList={onCreateList} isAdmin={isAdmin} refresh={refresh} />
          ))}
          <AddListInput onCreate={(name) => onCreateList(name, { spaceId: sp.id })} />
        </div>
      )}
    </div>
  );
}

function FolderNode({ folder, pathname, onCreateList, isAdmin, refresh }: { folder: SpaceT["folders"][number]; pathname: string; onCreateList: CreateList; isAdmin: boolean; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(folder.name);
  async function save() {
    setEditing(false);
    if (val.trim() && val.trim() !== folder.name) {
      await fetch(`/api/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
      refresh();
    }
  }
  return (
    <div>
      {editing ? (
        <input
          autoFocus
          className="fx-input"
          style={{ fontSize: 13, margin: "2px 0" }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          onBlur={save}
        />
      ) : (
        <button
          className="fx-navitem"
          onClick={() => setOpen(!open)}
          onDoubleClick={() => { if (isAdmin) { setVal(folder.name); setEditing(true); } }}
          title={isAdmin ? "Duplo-clique para renomear" : undefined}
          style={{ fontSize: 13 }}
        >
          <span style={{ opacity: 0.6 }}>📁</span>
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{folder.name}</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? "▾" : "▸"}</span>
        </button>
      )}
      {open && (
        <div style={{ marginLeft: 14, borderLeft: "1px solid var(--line)", paddingLeft: 6 }}>
          {folder.lists.map((l) => (
            <ListLink key={l.id} id={l.id} name={l.name} count={l._count?.tasks} pathname={pathname} isPrivate={!!l.private} memberIds={(l.members || []).map((m) => m.id)} isAdmin={isAdmin} refresh={refresh} />
          ))}
          <AddListInput onCreate={(name) => onCreateList(name, { folderId: folder.id })} />
        </div>
      )}
    </div>
  );
}

function AddListInput({ onCreate }: { onCreate: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!adding) {
    return (
      <button className="fx-navitem" onClick={() => setAdding(true)} style={{ fontSize: 13, color: "var(--txt-faint)" }}>
        + Lista
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="fx-input"
      style={{ fontSize: 13, margin: "2px 0" }}
      placeholder="Nome da lista"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && name.trim()) {
          onCreate(name.trim());
          setName("");
          setAdding(false);
        }
        if (e.key === "Escape") {
          setAdding(false);
          setName("");
        }
      }}
      onBlur={() => {
        setAdding(false);
        setName("");
      }}
    />
  );
}

function ListLink({
  id,
  name,
  count,
  pathname,
  isPrivate,
  memberIds,
  isAdmin,
  refresh,
}: {
  id: string;
  name: string;
  count?: number;
  pathname: string;
  isPrivate?: boolean;
  memberIds?: string[];
  isAdmin?: boolean;
  refresh?: () => void;
}) {
  const active = pathname === `/list/${id}`;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  async function save() {
    setEditing(false);
    if (val.trim() && val.trim() !== name) {
      await fetch(`/api/lists/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
      refresh && refresh();
    }
  }
  if (editing) {
    return (
      <input
        autoFocus
        className="fx-input"
        style={{ fontSize: 13, margin: "2px 0" }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        onBlur={save}
      />
    );
  }
  return (
    <div className={`fx-navitem ${active ? "active" : ""}`} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
      <Link
        href={`/list/${id}`}
        onDoubleClick={(e) => { if (isAdmin) { e.preventDefault(); setVal(name); setEditing(true); } }}
        title={isAdmin ? "Duplo-clique para renomear" : undefined}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0, color: "inherit", textDecoration: "none" }}
      >
        {isPrivate && <span style={{ fontSize: 10 }}>🔒</span>}
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {count !== undefined && count > 0 && <span style={{ fontSize: 11, opacity: 0.5 }}>{count}</span>}
      </Link>
      {isAdmin && refresh && <Kebab type="list" id={id} isPrivate={!!isPrivate} memberIds={memberIds || []} refresh={refresh} />}
    </div>
  );
}
