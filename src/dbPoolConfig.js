/**
 * Normalizes Neon/libpq SSL params for node-pg.
 * pg v8 treats sslmode=require as verify-full and warns; v9 will differ unless explicit.
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeDatabaseUrl(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");

    if (
      sslmode === "require" ||
      sslmode === "prefer" ||
      sslmode === "verify-ca"
    ) {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

export function createPoolConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  return {
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  };
}
