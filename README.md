# Fluxo — gestor de tarefas (substituto do ClickUp)

App full-stack (Next.js + PostgreSQL) para gerenciar projetos e tarefas do Grupo Gariglia,
com importação automática de todos os dados do ClickUp.

## O que tem

- **Hierarquia igual ao ClickUp**: Workspaces → Spaces → Folders → Listas → Tarefas
- **Status customizados por lista** (inclusive os funis de CRM)
- **Visão Kanban** (arrastar e soltar entre status) e **visão Lista**
- **Tarefas**: responsáveis, prioridade, prazo, descrição e comentários
- **Tags**: criar, colorir e aplicar nas tarefas pela interface
- **Subtarefas**: criar e marcar como concluídas dentro da tarefa
- **Anexos**: subir/baixar arquivos nas tarefas (até 25 MB)
- **Empresas (multi-tenant)**: cada empresa só enxerga os próprios workspaces/listas/tarefas
- **Papéis**: admin master (owner), admin e membro
- **Aprovação de usuários**: novos cadastros ficam pendentes até um admin aprovar
- **Painel /admin**: aprovar usuários, definir papel e empresa, criar empresas
- **Importador** que migra 100% dos dados via API do ClickUp (cada workspace vira uma empresa)

## Stack

Next.js 14 (App Router) · PostgreSQL · Prisma · autenticação JWT própria · Tailwind CSS.

---

## Deploy no Railway (passo a passo)

### 1. Suba o código pro GitHub
```bash
cd fluxo
git init && git add . && git commit -m "Fluxo inicial"
# crie um repositório no GitHub e:
git remote add origin git@github.com:SEU_USUARIO/fluxo.git
git push -u origin main
```

### 2. Crie o projeto no Railway
1. Acesse railway.app → **New Project** → **Deploy from GitHub repo** → escolha `fluxo`.
2. No projeto, clique **+ New** → **Database** → **Add PostgreSQL**.
3. Vá no serviço da app → aba **Variables** e adicione:
   - `DATABASE_URL` → clique em **Add Reference** e selecione `Postgres.DATABASE_URL`
   - `JWT_SECRET` → um valor aleatório longo (ex: rode `openssl rand -hex 32`)
   - `UPLOAD_DIR` → `/data` (pasta dos anexos)
   - `FLUXO_API_KEY` → chave secreta para a integração com o Claude (`openssl rand -hex 24`)
4. Para os **anexos persistirem**, adicione um Volume: serviço da app → **Settings** → **Volumes** → **New Volume**, com mount path `/data`.
5. O Railway vai buildar e subir. Na primeira vez ele já roda `prisma db push` (cria as tabelas).

### 3. Gere o domínio
No serviço da app → **Settings** → **Networking** → **Generate Domain**. Pronto, o app está no ar.

### 4. Importe os dados do ClickUp
Pegue seu token em **ClickUp → Settings → Apps → API Token** (começa com `pk_`).

No painel do Railway, abra o serviço da app → aba de comandos/terminal (ou use a CLI do Railway):
```bash
CLICKUP_API_TOKEN=pk_SEU_TOKEN npm run import:clickup
```

Usando a [CLI do Railway](https://docs.railway.app/develop/cli) localmente:
```bash
railway run --service fluxo bash -lc 'CLICKUP_API_TOKEN=pk_SEU_TOKEN npm run import:clickup'
```

Opções:
- `IMPORT_COMMENTS=true` também traz comentários (mais lento)
- `CLICKUP_TEAM_IDS=9011900827,90132851675` limita a workspaces específicos

A importação é **idempotente**: pode rodar de novo quando quiser para sincronizar.

### 5. Crie seu usuário
Acesse o domínio → **Cadastre-se**. O primeiro usuário criado vira **owner**.
Se o e-mail já existir (importado do ClickUp), o cadastro apenas ativa a senha.

---

## Integração com o Claude (MCP)

Você pode operar o Fluxo pelo Claude, igual faz hoje com o ClickUp. Veja `mcp-server/README.md`.
Resumo: defina `FLUXO_API_KEY` no app, rode `npm install` em `mcp-server/` e aponte o Claude Desktop
para `mcp-server/index.mjs` com `FLUXO_BASE_URL` e `FLUXO_API_KEY`.

## Rodar localmente

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npx prisma db push          # cria as tabelas
npm run db:seed             # (opcional) cria um usuário admin
CLICKUP_API_TOKEN=pk_xxx npm run import:clickup   # importa o ClickUp
npm run dev                 # http://localhost:3000
```

## Estrutura

```
app/                 telas e rotas de API (Next.js App Router)
  (app)/             área autenticada (sidebar + listas)
  login/             tela de login/cadastro
  api/               endpoints REST (auth, tarefas, listas, etc.)
components/          AppShell (sidebar) e TaskModal
lib/                 prisma, auth, helpers
prisma/schema.prisma modelo do banco
scripts/import-clickup.ts  importador do ClickUp
```

## Próximos passos sugeridos

- Notificações e menções em comentários
- Subtarefas e checklists na interface (o banco já suporta subtarefas)
- Campos personalizados (já preservados em `customFields` no banco)
- Permissões por space/usuário
- Filtros salvos e visão de calendário
```
