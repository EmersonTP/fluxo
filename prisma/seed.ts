import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@fluxo.app").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "fluxo123";
  const name = process.env.SEED_ADMIN_NAME || "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário ${email} já existe — nada a fazer.`);
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "owner",
      status: "active",
    },
  });
  console.log(`✅ Usuário owner criado: ${email} / senha: ${password}`);
  console.log("   Troque a senha após o primeiro login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
