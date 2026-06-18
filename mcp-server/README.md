# Fluxo MCP — controlar o Fluxo pelo Claude

Servidor MCP que expõe o seu Fluxo como ferramentas para o Claude (igual ao MCP do ClickUp).

## Ferramentas disponíveis
- `fluxo_list_hierarchy` — workspaces, spaces, folders e listas
- `fluxo_list_tasks` — tarefas de uma lista
- `fluxo_search_tasks` — busca por nome
- `fluxo_get_task` — detalhe completo de uma tarefa
- `fluxo_create_task` — criar tarefa (ou subtarefa, com `parentId`)
- `fluxo_update_task` — atualizar nome/status/prioridade/prazo/responsáveis/tags
- `fluxo_move_task` — mover entre status (Kanban)
- `fluxo_add_comment` — comentar
- `fluxo_list_members` — listar usuários (para usar como responsáveis)

## Pré-requisitos
1. O Fluxo precisa estar no ar (Railway) com a variável `FLUXO_API_KEY` definida
   (um valor secreto à sua escolha — ex: `openssl rand -hex 24`).
2. Node 18+ na máquina onde o Claude Desktop roda.

## Instalar
```bash
cd mcp-server
npm install
```

## Configurar no Claude Desktop
Edite o arquivo de config do Claude Desktop:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fluxo": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/para/fluxo/mcp-server/index.mjs"],
      "env": {
        "FLUXO_BASE_URL": "https://SEU-APP.up.railway.app",
        "FLUXO_API_KEY": "a-mesma-chave-do-app"
      }
    }
  }
}
```

Reinicie o Claude Desktop. Agora você pode pedir coisas como:
> "Quais tarefas estão em 'fup 1' no CRM online?"
> "Cria uma tarefa 'Ligar pro lead X' na lista Operação Comercial pro Gianlucca, prioridade urgente."
> "Move a tarefa Y para 'concluído' e comenta que foi fechado."

## Segurança
A `FLUXO_API_KEY` dá acesso total de leitura/escrita ao Fluxo. Trate como senha:
não comite no Git, gere uma forte e troque se vazar.
