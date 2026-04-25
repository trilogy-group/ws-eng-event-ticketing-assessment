import { access, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const prismaDir = path.resolve(process.cwd(), "prisma");
const sourceDbPath = path.join(prismaDir, "dev.db");
const targetDbPath = path.join(prismaDir, "test.db");
const targetJournalPath = `${targetDbPath}-journal`;

async function main() {
  await mkdir(prismaDir, { recursive: true });

  await access(sourceDbPath);

  await rm(targetDbPath, { force: true });
  await rm(targetJournalPath, { force: true });

  await copyFile(sourceDbPath, targetDbPath);

  console.log(`Copied test database from ${sourceDbPath} to ${targetDbPath}`);
}

main().catch((error) => {
  console.error("Failed to copy test database:", error);
  process.exit(1);
});
