import assert from "node:assert/strict";
import test from "node:test";
import { configurePooledDatabaseUrl } from "../lib/prisma";

test("configures a pooled Prisma URL for Supavisor compatibility", () => {
  assert.equal(
    configurePooledDatabaseUrl("postgresql://user:pass@region.pooler.supabase.com:6543/postgres"),
    "postgresql://user:pass@region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
  );
});

test("preserves existing query parameters", () => {
  assert.equal(
    configurePooledDatabaseUrl("postgresql://region.pooler.supabase.com/db?sslmode=require"),
    "postgresql://region.pooler.supabase.com/db?sslmode=require&pgbouncer=true&connection_limit=1",
  );
});

test("does not duplicate pooler parameters", () => {
  const value = "postgresql://region.pooler.supabase.com/db?pgbouncer=true&connection_limit=2";
  assert.equal(configurePooledDatabaseUrl(value), value);
});

test("leaves direct database URLs unchanged", () => {
  const value = "postgresql://db.example.com:5432/studyplan";
  assert.equal(configurePooledDatabaseUrl(value), value);
});
