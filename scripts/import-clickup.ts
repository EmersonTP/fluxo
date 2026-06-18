/**
 * Importador do ClickUp -> banco do Fluxo (linha de comando).
 *
 * Na maioria dos casos use o botão "Importar do ClickUp" no painel /admin.
 * Este script faz a mesma coisa pelo terminal:
 *
 *   CLICKUP_API_TOKEN=pk_xxx npm run import:clickup
 *
 * Variáveis opcionais:
 *   CLICKUP_TEAM_IDS=9011900827,90132851675   (limita a workspaces específicos)
 *   IMPORT_COMMENTS=true                        (também importa comentários)
 *   IMPORT_CLOSED=false                         (ignora tarefas concluídas)
 *
 * É idempotente — pode rodar várias vezes para sincronizar.
 */
import { PrismaClient } from "@prisma/client";
import { runImport, importState } from "../lib/clickup-import";

const TOKEN = process.env.CLICKUP_API_TOKEN;
if (!TOKEN) {
  console.error("❌ Defina CLICKUP_API_TOKEN. Pegue em ClickUp > Settings > Apps > API Token (pk_...).");
  process.exit(1);
}

const teamIds = (process.env.CLICKUP_TEAM_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  let lastLen = 0;
  const timer = setInterval(() => {
    while (lastLen < importState.log.length) console.log(importState.log[lastLen++]);
  }, 500);

  await runImport(TOKEN as string, {
    importComments: process.env.IMPORT_COMMENTS === "true",
    includeClosed: process.env.IMPORT_CLOSED !== "false",
    teamIds,
  });

  clearInterval(timer);
  while (lastLen < importState.log.length) console.log(importState.log[lastLen++]);
  if (importState.error) process.exit(1);

  await new PrismaClient().$disconnect();
}

main();
