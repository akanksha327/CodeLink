import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { db } from "./db.ts";

let schemaChecked = false;

const requiredTables = ["User", "AuthSession", "Session", "Message"] as const;

type TableNameRow = {
  tableName: string;
};

function getInitialMigrationPath() {
  const migrationsDirectory = resolve(process.cwd(), "prisma", "migrations");
  const migrationDirectories = readdirSync(migrationsDirectory, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const initialMigrationDirectory = migrationDirectories[0];

  if (!initialMigrationDirectory) {
    throw new Error("No Prisma migrations were found in backend/prisma/migrations.");
  }

  const migrationPath = join(
    migrationsDirectory,
    initialMigrationDirectory,
    "migration.sql",
  );

  if (!existsSync(migrationPath)) {
    throw new Error(`Initial Prisma migration is missing: ${migrationPath}`);
  }

  return migrationPath;
}

async function hasCoreSchema() {
  const result = await db.$queryRaw<TableNameRow[]>`
    SELECT table_name::text AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'AuthSession', 'Session', 'Message')
  `;

  const existingTables = new Set(result.map((row) => row.tableName));

  return requiredTables.every((tableName) => existingTables.has(tableName));
}

async function applyInitialMigration() {
  neonConfig.webSocketConstructor = ws;

  const migrationSql = readFileSync(getInitialMigrationPath(), "utf8");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();

    try {
      await client.query(migrationSql);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

export async function ensureDatabaseSchema() {
  if (schemaChecked) {
    return;
  }

  if (await hasCoreSchema()) {
    schemaChecked = true;
    return;
  }

  console.warn("Core Prisma tables are missing. Applying the initial database schema...");
  await applyInitialMigration();

  if (!(await hasCoreSchema())) {
    throw new Error("Initial database schema did not create the expected Prisma tables.");
  }

  schemaChecked = true;
}
