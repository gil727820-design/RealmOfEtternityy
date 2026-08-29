import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/game.db",
  },
} satisfies Config;
