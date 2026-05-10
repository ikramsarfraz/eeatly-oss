export function resolveDatabaseUrlForApp() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Add it to .env.local before running database commands.");
  }

  return databaseUrl;
}
