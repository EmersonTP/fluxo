"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { WorkspaceT, SpaceT } from "@/lib/types";

type User = { id: string; name: string; email: string; role: string };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  tasks: "M9 11l3 3 8-8M4 6h.01M4 12h.01M4 18h.01M9 18h11M9 6h11",
  chat: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z",
  admin: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 8l2 2 4-4",
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
  const widthRef = useRef(248);

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

  useEffect(() => {
    loadHierarchy().finally(() => setLoading(false));
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
    { icon: "chat", label: "Chat", href: "/chat" },
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
        <div style={{ marginTop: "auto", position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
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

      {/* Wider sidebar (spaces) */}
      <aside
        className="fx-side"
        style={{
          width: collapsed ? 0 : width,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: collapsed ? 0 : "16px 12px",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 10px 10px" }}>
          <Link href="/" className="fx-brand">
            Sandra<b>.</b>
          </Link>
          <button onClick={toggleCollapse} title="Recolher barra" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
            «
          </button>
        </div>

        {loading && <p className="fx-navgroup">Carregando...</p>}
        {workspaces.map((ws, i) => (
          <WorkspaceNode key={ws.id} ws={ws} pathname={pathname} color={COMPANY_COLORS[i % COMPANY_COLORS.length]} onCreateList={createList} />
        ))}
        {!loading && workspaces.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: "12px 10px" }}>Sem dados ainda. Rode a importação do ClickUp.</p>
        )}
      </aside>

      {/* Resize handle */}
      {!collapsed && (
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
    </div>
  );
}

const SPACE_COLORS = ["var(--roxo)", "var(--coral)", "var(--sage)", "var(--roxo-deep)", "var(--coral-deep)"];
const COMPANY_COLORS = ["#9250ac", "#d85a30", "#1d9e75", "#534ab7", "#ff7e59", "#3b82f6"];

type CreateList = (name: string, parent: { spaceId?: string; folderId?: string }) => void | Promise<void>;

function WorkspaceNode({ ws, pathname, color, onCreateList }: { ws: WorkspaceT; pathname: string; color: string; onCreateList: CreateList }) {
  const initial = ws.name.charAt(0).toUpperCase();
  return (
    <div style={{ marginTop: 12, borderRadius: 10, background: color + "12", paddingBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
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
        <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--txt)", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ws.name}
        </span>
      </div>
      <div style={{ borderLeft: `2px solid ${color}`, marginLeft: 20, paddingLeft: 4 }}>
        {ws.spaces.map((sp, i) => (
          <SpaceNode key={sp.id} sp={sp} pathname={pathname} color={sp.color || SPACE_COLORS[i % SPACE_COLORS.length]} onCreateList={onCreateList} />
        ))}
      </div>
    </div>
  );
}

function SpaceNode({ sp, pathname, color, onCreateList }: { sp: SpaceT; pathname: string; color: string; onCreateList: CreateList }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="fx-navitem" onClick={() => setOpen(!open)}>
        <span className="fx-dot" style={{ background: color }} />
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp.name}</span>
        <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginLeft: 14, borderLeft: "1px solid var(--line)", paddingLeft: 6 }}>
          {sp.lists.map((l) => (
            <ListLink key={l.id} id={l.id} name={l.name} count={l._count?.tasks} pathname={pathname} />
          ))}
          {sp.folders.map((f) => (
            <FolderNode key={f.id} folder={f} pathname={pathname} onCreateList={onCreateList} />
          ))}
          <AddListInput onCreate={(name) => onCreateList(name, { spaceId: sp.id })} />
        </div>
      )}
    </div>
  );
}

function FolderNode({ folder, pathname, onCreateList }: { folder: SpaceT["folders"][number]; pathname: string; onCreateList: CreateList }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="fx-navitem" onClick={() => setOpen(!open)} style={{ fontSize: 13 }}>
        <span style={{ opacity: 0.6 }}>📁</span>
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{folder.name}</span>
        <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginLeft: 14, borderLeft: "1px solid var(--line)", paddingLeft: 6 }}>
          {folder.lists.map((l) => (
            <ListLink key={l.id} id={l.id} name={l.name} count={l._count?.tasks} pathname={pathname} />
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

function ListLink({ id, name, count, pathname }: { id: string; name: string; count?: number; pathname: string }) {
  const active = pathname === `/list/${id}`;
  return (
    <Link href={`/list/${id}`} className={`fx-navitem ${active ? "active" : ""}`} style={{ fontSize: 13 }}>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      {count !== undefined && count > 0 && <span style={{ fontSize: 11, opacity: 0.5 }}>{count}</span>}
    </Link>
  );
}
