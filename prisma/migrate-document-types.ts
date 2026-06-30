import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TYPE_MAP: Record<string, string> = {
  SPECIFICATION: "ASSEMBLY_DRAWING",
  PARTS_LIST: "ASSEMBLY_DRAWING",
};

async function main() {
  for (const [from, to] of Object.entries(TYPE_MAP)) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE Document SET type = ? WHERE type = ?`,
      to,
      from,
    );
    if (result > 0) console.log(`Migrated ${result} documents: ${from} → ${to}`);
  }

  const removed = await prisma.$executeRawUnsafe(`DELETE FROM Document WHERE type = 'HARDWARE'`);
  if (removed > 0) console.log(`Removed ${removed} HARDWARE documents (use Excel import instead)`);

  console.log("Document types migration complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
