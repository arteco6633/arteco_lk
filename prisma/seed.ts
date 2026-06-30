import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const users: Array<{ email: string; name: string; role: Role }> = [
    { email: "admin@mebel.local", name: "Администратор", role: "ADMIN" },
    { email: "manager@mebel.local", name: "Менеджер", role: "MANAGER" },
    { email: "contractor@mebel.local", name: "Приёмка", role: "CONTRACTOR" },
    { email: "sorter@mebel.local", name: "Сортировщик", role: "SORTER" },
    { email: "driller@mebel.local", name: "Присадочник", role: "DRILLER" },
    { email: "qc@mebel.local", name: "ОКК", role: "QC" },
    { email: "packer@mebel.local", name: "Упаковщик", role: "PACKER" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }

  console.log("Seed complete. Demo password for all users: 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
