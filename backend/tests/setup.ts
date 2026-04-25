import { afterAll, beforeAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";

beforeAll(() => {
  if (!process.env.DATABASE_URL?.includes("test.db")) {
    throw new Error(`Backend tests must run against prisma/test.db. Received DATABASE_URL="${process.env.DATABASE_URL}"`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
