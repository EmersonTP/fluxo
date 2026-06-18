"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { WorkspaceT, SpaceT } from "@/lib/types";

type User = { id: string; name: string; email: string; role: string };

export default function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<WorkspaceT[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [width, setWidth] = useState(248);
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside
        className="fx-side"
        style={{
          width: collapsed ? 0 : width,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: collapsed ? 0 : "18px 12px",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 10px 10px" }}>
          <Link href="/" className="fx-brand">
            Sandra<b>.</b>
          </Link>
          <button onClick={toggleCollapse} title="Recolher barra" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--txt-faint)", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
            «
          </button>
        </div>

        <div className="fx-navgroup">Geral</div>
        <Link href="/" className={`fx-navitem ${pathname === "/" ? "active" : ""}`}>
          <span className="fx-dot" style={{ background: "var(--roxo)" }} />
          Início
        </Link>
        <Link href="/minhas-tarefas" className={`fx-navitem ${pathname === "/minhas-tarefas" ? "active" : ""}`}>
          <span className="fx-dot" style={{ background: "var(--coral)" }} />
          Minhas tarefas
        </Link>
        <Link href="/chat" className={`fx-navitem ${pathname === "/chat" ? "active" : ""}`}>
          <span className="fx-dot" style={{ background: "var(--sage)" }} />
          Chat
        </Link>
        {(user.role === "owner" || user.role === "admin") && (
          <Link href="/admin" className={`fx-navitem ${pathname === "/admin" ? "active" : ""}`}>
            <span className="fx-dot" style={{ background: "var(--sage)" }} />
            Administração
          </Link>
        )}
        <Link href="/configuracoes" className={`fx-navitem ${pathname === "/configuracoes" ? "active" : ""}`}>
          <span className="fx-dot" style={{ background: "var(--roxo-deep)" }} />
          Configurações
        </Link>

        {loading && <p className="fx-navgroup">Carregando...</p>}
        {workspaces.map((ws, i) => (
          <WorkspaceNode key={ws.id} ws={ws} pathname={pathname} color={COMPANY_COLORS[i % COMPANY_COLORS.length]} onCreateList={createList} />
        ))}
        {!loading && workspaces.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--txt-faint)", padding: "12px 10px" }}>
            Sem dados ainda. Rode a importação do ClickUp.
          </p>
        )}

        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <button className="fx-theme" onClick={toggleTheme}>
            {dark ? "☀️" : "🌙"}
            <span>{dark ? "Modo claro" : "Modo escuro"}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 10px 2px" }}>
            <span className="fx-avatar" style={{ background: "var(--roxo)" }}>
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--txt-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
            </div>
            <button onClick={logout} title="Sair" style={{ background: "none", border: "none", color: "var(--txt-soft)", cursor: "pointer", fontSize: 12 }}>
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          title="Arraste para redimensionar"
          style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: "var(--line)" }}
        />
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
