import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

const rootDir = process.cwd();

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

async function readSql(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

async function main() {
  const host = getEnv("DB_HOST", "127.0.0.1");
  const port = Number(getEnv("DB_PORT", "3306"));
  const user = getEnv("DB_USER", "root");
  const password = getEnv("DB_PASSWORD", "");
  const database = getEnv("DB_NAME", "railway_ticket_system");

  const adminConnection = await connectWithRetry({
    host,
    port,
    user,
    password,
    charset: "utf8mb4",
    multipleStatements: true
  });

  const expectedTableCount = 14;

  try {
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    const [tableRows] = await adminConnection.query(
      `
        SELECT COUNT(*) AS tableCount
        FROM information_schema.tables
        WHERE table_schema = ?
      `,
      [database]
    );

    const tableCount = Number(tableRows[0]?.tableCount ?? 0);
    if (tableCount > 0 && tableCount < expectedTableCount) {
      await adminConnection.query(`DROP DATABASE \`${database}\``);
      await adminConnection.query(`CREATE DATABASE \`${database}\``);
      console.log("Dropped partially initialized database and recreated it");
    }

    await adminConnection.changeUser({ database });

    if (tableCount === 0 || tableCount < expectedTableCount) {
      const schemaSql = await readSql("db/schema.sql");
      await adminConnection.query(schemaSql);
      console.log("Applied schema.sql");
    } else {
      console.log("Schema already present, skipping schema.sql");
    }

    const seedsSql = await readSql("db/seeds.sql");
    await adminConnection.query(seedsSql);
    console.log("Applied seeds.sql");
  } finally {
    await adminConnection.end();
  }
}

async function connectWithRetry(config) {
  let lastError = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const connection = await mysql.createConnection(config);
      return connection;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
