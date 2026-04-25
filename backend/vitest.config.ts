import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl = `file:${path.resolve(process.cwd(), "prisma/test.db")}`;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? testDatabaseUrl,
      JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-key-min-32-characters-long",
      CHECKIN_API_KEY: process.env.CHECKIN_API_KEY ?? "test-checkin-api-key",
      FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",
      PORT: process.env.PORT ?? "4001",
    },
  },
});
