import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  console.warn("Warning: SQL_HOST is not defined for drizzle-kit.");
}
if (!sqlDbName) {
  console.warn("Warning: SQL_DB_NAME is not defined for drizzle-kit.");
}
if (!user) {
  console.warn("Warning: SQL_ADMIN_USER is not defined for drizzle-kit.");
}
if (!password) {
  console.warn("Warning: SQL_ADMIN_PASSWORD is not defined for drizzle-kit.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost || "",
    user: user || "",
    password: password || "",
    database: sqlDbName || "",
    ssl: false,
  },
  verbose: true,
});
