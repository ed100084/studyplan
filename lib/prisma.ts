import { PrismaClient } from "@prisma/client";

export function configurePooledDatabaseUrl(value: string | undefined) {
  if (!value || !value.includes(".pooler.supabase.com")) {
    return value;
  }

  const parameters: string[] = [];
  if (!/[?&]pgbouncer=/.test(value)) {
    parameters.push("pgbouncer=true");
  }
  if (!/[?&]connection_limit=/.test(value)) {
    parameters.push("connection_limit=1");
  }

  if (parameters.length === 0) {
    return value;
  }

  return `${value}${value.includes("?") ? "&" : "?"}${parameters.join("&")}`;
}

const pooledDatabaseUrl = configurePooledDatabaseUrl(process.env.DATABASE_URL);
if (pooledDatabaseUrl) {
  process.env.DATABASE_URL = pooledDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

