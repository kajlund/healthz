import "./src/config/load-env.js";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle commands");
}

export default defineConfig({
  dialect: "postgresql",
  schema: fileURLToPath(new URL("./src/db/schema.ts", import.meta.url)),
  out: fileURLToPath(new URL("./drizzle", import.meta.url)),
  dbCredentials: { url: databaseUrl },
});
