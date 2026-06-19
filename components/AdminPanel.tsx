"use client";

import { useEffect, useState } from "react";

type Company = { id: string; name: string; active: boolean; _count?: { workspaces: number; users: number } };
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  companyId: string | null;
  company?: { id: string; name: string } | null;
};

const ROLE_LABEL: Record<string, string> = { owner: "Admin master", admin: "Admin", member: "Membro" };
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", active: "Ativo", disabled: "Desativado" };

export default function AdminPanel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"users" | "companies" | "import">("users");
  const [newCompany, setNewCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [openCompany, setOpenCompany] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "member", companyId: "" });

  // ClickUp import
  const [token, setToken] = useState("");
  const [importState, setImportState] = useState<any>(null);
  const importing = importState?.running;

  async function startImport() {
    if (!token.trim()) {
      alert("Cole o token de API do ClickUp (começa com pk_).");
      return;
    }
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    pollImport();
  }

  function pollImport() {
    fetch("/api/admin/import")
      .then((r) => r.json())
      .then((d) => {
        setImportState(d.state);
        if (d.state?.running) setTimeout(pollImport, 2000);
        else load();
      });
  }

  useEffect(() => {
    fetch("/api/admin/import").then((r) => r.json()).then((d) => {
      setImportState(d.state);
      if (d.state?.running) pollImport();
    });
  }, []);

  function load() {
    Promise.all([
      fetch("/api/admin/companies").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([c, u]) => {
      setCompanies(c.companies || []);
      setUsers(u.users || []);
      setLoading(false);
    });
  }
  useEffect(load, []);

  async function createCompany() {
    if (!newCompany.trim()) return;
    await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompany }),
    });
    setNewCompany("");
    load();
  }

  async function patchCompany(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.company) setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.company } : c)));
    else if (data.error) alert(data.error);
  }

  async function deleteCompany(c: Company) {
    if (!confirm(`Excluir a empresa "${c.name}"?\n\nIsso APAGA todos os espaços, listas e tarefas dela (${c._count?.workspaces ?? 0} workspaces). Os usuários continuam, mas ficam sem empresa.\n\nEsta ação não pode ser desfeita.`)) return;
    if (!confirm(`Confirma de novo: apagar TUDO da empresa "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/companies/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setCompanies((prev) => prev.filter((x) => x.id !== c.id));
      setOpenCompany(null);
    } else alert(data.error || "Não foi possível excluir.");
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.user) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
    else if (data.error) alert(data.error);
  }

  async function createUser() {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      alert("Preencha nome, e-mail e senha.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (data.user) {
      setNewUser({ name: "", email: "", password: "", role: "member", companyId: "" });
      setAddingUser(false);
      load();
    } else alert(data.error || "Não foi possível adicionar.");
  }

  async function resetPassword(u: AdminUser) {
    const pwd = prompt(`Nova senha para "${u.name}" (${u.email}):\n\nDepois é só passar pra pessoa — ela troca em Configurações.`);
    if (!pwd) return;
    if (pwd.length < 6) {
      alert("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) alert("Senha redefinida! Passe a nova senha pra pessoa.");
    else alert("Não foi possível redefinir.");
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Excluir definitivamente "${u.name}" (${u.email})?\n\nEle perde o acesso. As tarefas atribuídas a ele ficam sem responsável.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
    else alert(data.error || "Não foi possível excluir.");
  }

  const pending = users.filter((u) => u.status === "pending");

  return (
    <div className="h-full overflow-y-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Administração</h1>
      <p className="text-neutral-500 mb-6">Gerencie usuários e empresas</p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-1.5 rounded-lg text-sm ${tab === "users" ? "bg-brand-600 text-white" : "bg-white border border-neutral-300"}`}
        >
          Usuários {pending.length > 0 && <span className="ml-1 text-xs bg-amber-400 text-amber-900 rounded-full px-1.5">{pending.length}</span>}
        </button>
        <button
          onClick={() => setTab("companies")}
          className={`px-4 py-1.5 rounded-lg text-sm ${tab === "companies" ? "bg-brand-600 text-white" : "bg-white border border-neutral-300"}`}
        >
          Empresas
        </button>
        <button
          onClick={() => setTab("import")}
          className={`px-4 py-1.5 rounded-lg text-sm ${tab === "import" ? "bg-brand-600 text-white" : "bg-white border border-neutral-300"}`}
        >
          Importar do ClickUp
        </button>
      </div>

      {loading && <p className="text-neutral-500">Carregando...</p>}

      {!loading && tab === "companies" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCompany()}
              placeholder="Nome da nova empresa"
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={createCompany} className="bg-brand-600 text-white rounded-lg px-4 text-sm">
              Criar empresa
            </button>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 divide-y">
            {companies.map((c) => {
              const open = openCompany === c.id;
              return (
                <div key={c.id}>
                  <button
                    onClick={() => {
                      setOpenCompany(open ? null : c.id);
                      setEditName(c.name);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-neutral-400 text-xs">{open ? "▾" : "▸"}</span>
                      <span className="font-medium">{c.name}</span>
                      {!c.active && <span className="text-[10px] uppercase bg-neutral-200 text-neutral-600 rounded px-1.5 py-0.5">Inativa</span>}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {c._count?.workspaces ?? 0} workspaces · {c._count?.users ?? 0} usuários
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 bg-neutral-50 flex flex-wrap items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm flex-1 min-w-[180px]"
                      />
                      <button
                        onClick={() => editName.trim() && editName !== c.name && patchCompany(c.id, { name: editName.trim() })}
                        className="bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm"
                      >
                        Renomear
                      </button>
                      <button
                        onClick={() => patchCompany(c.id, { active: !c.active })}
                        className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm"
                      >
                        {c.active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => deleteCompany(c)}
                        className="ml-auto text-sm text-red-600 hover:underline"
                      >
                        Excluir empresa
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {companies.length === 0 && <p className="px-4 py-3 text-sm text-neutral-500">Nenhuma empresa ainda.</p>}
          </div>
        </div>
      )}

      {!loading && tab === "users" && (
        <>
        <div className="mb-4">
          {!addingUser ? (
            <button onClick={() => setAddingUser(true)} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">+ Adicionar pessoa</button>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-wrap gap-2 items-end">
              <div><div className="text-xs text-neutral-500 mb-1">Nome</div><input className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
              <div><div className="text-xs text-neutral-500 mb-1">E-mail</div><input className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
              <div><div className="text-xs text-neutral-500 mb-1">Senha</div><input className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
              <div><div className="text-xs text-neutral-500 mb-1">Empresa</div>
                <select className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" value={newUser.companyId} onChange={(e) => setNewUser({ ...newUser, companyId: e.target.value })}>
                  <option value="">— sem empresa —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><div className="text-xs text-neutral-500 mb-1">Papel</div>
                <select className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button onClick={createUser} className="bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm">Adicionar</button>
              <button onClick={() => setAddingUser(false)} className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm">Cancelar</button>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Usuário</th>
                <th className="text-left px-4 py-2 font-medium">Empresa</th>
                <th className="text-left px-4 py-2 font-medium">Papel</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className={u.status === "pending" ? "bg-amber-50" : ""}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-neutral-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.companyId || ""}
                      onChange={(e) => patchUser(u.id, { companyId: e.target.value })}
                      className="border border-neutral-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">— sem empresa —</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) => patchUser(u.id, { role: e.target.value })}
                      className="border border-neutral-300 rounded-md px-2 py-1 text-xs"
                    >
                      {Object.entries(ROLE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.status === "pending" ? (
                      <button
                        onClick={() => patchUser(u.id, { status: "active" })}
                        className="bg-green-600 text-white rounded-md px-3 py-1 text-xs"
                      >
                        Aprovar
                      </button>
                    ) : (
                      <select
                        value={u.status}
                        onChange={(e) => patchUser(u.id, { status: e.target.value })}
                        className="border border-neutral-300 rounded-md px-2 py-1 text-xs"
                      >
                        <option value="active">{STATUS_LABEL.active}</option>
                        <option value="disabled">{STATUS_LABEL.disabled}</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => resetPassword(u)}
                      title="Redefinir senha"
                      className="text-xs text-brand-600 hover:underline mr-3"
                    >
                      Redefinir senha
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      title="Excluir usuário"
                      className="text-xs text-red-600 hover:text-red-700 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!loading && tab === "import" && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-600 mb-1">
              Importa <b>tudo do ClickUp</b> (spaces, listas, status, tarefas, responsáveis, prazos, tags). Cada workspace
              do ClickUp vira uma empresa. Pode rodar de novo a qualquer momento para sincronizar.
            </p>
            <p className="text-xs text-neutral-400 mb-4">
              Pegue seu token em ClickUp → Settings → Apps → API Token (começa com <code>pk_</code>). Ele é usado só para
              esta importação e não fica salvo.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pk_xxxxxxxx"
                disabled={importing}
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={startImport}
                disabled={importing}
                className="bg-brand-600 text-white rounded-lg px-4 text-sm disabled:opacity-60"
              >
                {importing ? "Importando..." : "Importar agora"}
              </button>
            </div>

            {importState && (
              <div className="mt-4">
                {importState.running && (
                  <div className="flex items-center gap-2 text-sm text-brand-700 mb-2">
                    <span className="inline-block w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                    Importando... (pode levar alguns minutos)
                  </div>
                )}
                {importState.error && <p className="text-sm text-red-600 mb-2">Erro: {importState.error}</p>}
                {importState.counts && !importState.running && (
                  <p className="text-sm text-green-700 mb-2">
                    ✓ Concluído: {importState.counts.tasks} tarefas, {importState.counts.lists} listas,{" "}
                    {importState.counts.spaces} spaces, {importState.counts.users} usuários.
                  </p>
                )}
                {importState.log?.length > 0 && (
                  <pre className="bg-neutral-900 text-neutral-100 text-xs rounded-lg p-3 max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {importState.log.join("\n")}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
