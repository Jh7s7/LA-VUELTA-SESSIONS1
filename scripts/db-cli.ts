import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getPgPool,
  closePgPool,
  ensurePostgresSchema,
  enqueuePostgresPersist,
  exportFullPostgresBackup,
  loadLegacyVouchersFromDisk,
} from '../db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LEGACY_DB_PATH = path.join(ROOT_DIR, 'data', 'persistent_db.json');
const PRIVATE_DB_PATH = path.join(ROOT_DIR, '.private_data', 'db.json');
const VOUCHERS_DIR = path.join(ROOT_DIR, '.private_data', 'vouchers');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

async function runMigrate() {
  const pool = getPgPool();
  await pool.query('SELECT 1');
  await ensurePostgresSchema(pool);

  let sourceFile = '';
  if (fs.existsSync(LEGACY_DB_PATH)) {
    sourceFile = LEGACY_DB_PATH;
  } else if (fs.existsSync(PRIVATE_DB_PATH)) {
    sourceFile = PRIVATE_DB_PATH;
  } else {
    throw new Error('No legacy database file found at data/persistent_db.json or .private_data/db.json');
  }

  const rawJson = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const vouchers = loadLegacyVouchersFromDisk(VOUCHERS_DIR);

  await enqueuePostgresPersist(rawJson, vouchers);
  console.log(
    `[db:migrate] Successfully migrated ${rawJson.users?.length || 0} users, ${rawJson.events?.length || 0} events, ${rawJson.orders?.length || 0} orders, ${vouchers.length} vouchers, and ${rawJson.tickets?.length || 0} tickets from ${path.relative(ROOT_DIR, sourceFile)} into PostgreSQL.`
  );
}

async function runBackup(targetArg?: string) {
  const pool = getPgPool();
  await pool.query('SELECT 1');
  await ensurePostgresSchema(pool);

  const snapshot = await exportFullPostgresBackup(undefined, pool);
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const latestPath = targetArg ? path.resolve(ROOT_DIR, targetArg) : path.join(BACKUPS_DIR, 'pg_backup_latest.json');
  const datedPath = path.join(BACKUPS_DIR, `pg_backup_${new Date().toISOString().slice(0, 10)}.json`);

  const serialized = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(latestPath, serialized, { mode: 0o600 });
  if (!targetArg) {
    fs.writeFileSync(datedPath, serialized, { mode: 0o600 });
  }

  console.log(
    `[db:backup] PostgreSQL backup written to ${path.relative(ROOT_DIR, latestPath)} (${snapshot.users.length} users, ${snapshot.events.length} events, ${snapshot.orders.length} orders, ${snapshot.vouchers.length} vouchers, ${snapshot.tickets.length} tickets).`
  );
}

async function runRestore(sourceArg?: string) {
  const pool = getPgPool();
  await pool.query('SELECT 1');
  await ensurePostgresSchema(pool);

  const targetFile = sourceArg
    ? path.resolve(ROOT_DIR, sourceArg)
    : path.join(BACKUPS_DIR, 'pg_backup_latest.json');

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Backup file not found: ${targetFile}`);
  }

  const backupData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  const vouchers = Array.isArray(backupData.vouchers) ? backupData.vouchers : [];
  await enqueuePostgresPersist(backupData, vouchers);

  console.log(
    `[db:restore] Successfully restored PostgreSQL database from ${path.relative(ROOT_DIR, targetFile)} (${backupData.users?.length || 0} users, ${backupData.events?.length || 0} events, ${backupData.orders?.length || 0} orders, ${vouchers.length} vouchers, ${backupData.tickets?.length || 0} tickets).`
  );
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];
  try {
    if (cmd === 'migrate') {
      await runMigrate();
    } else if (cmd === 'backup') {
      await runBackup(arg);
    } else if (cmd === 'restore') {
      await runRestore(arg);
    } else {
      console.error('Usage: tsx scripts/db-cli.ts <migrate|backup|restore> [file]');
      process.exit(1);
    }
  } finally {
    await closePgPool();
  }
}

main().catch((err) => {
  console.error('[db-cli] Fatal error:', err);
  process.exit(1);
});
