import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";

const { DATABASE_URL } = getServerEnv();

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
