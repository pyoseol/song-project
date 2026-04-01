import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SQLITE_DB_PATH = join(__dirname, 'songmaker.sqlite');

const MYSQL_URL = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
const MYSQL_HOST = process.env.MYSQL_HOST || process.env.DB_HOST || '';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || process.env.DB_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
const MYSQL_DATABASE = sanitizeDatabaseName(
  process.env.MYSQL_DATABASE || process.env.DB_NAME || 'songmaker'
);

const REQUESTED_DRIVER = String(process.env.DB_DRIVER || process.env.DB_CLIENT || '')
  .trim()
  .toLowerCase();

const ACTIVE_DRIVER =
  REQUESTED_DRIVER === 'mysql' || MYSQL_URL || MYSQL_HOST ? 'mysql' : 'sqlite';

let sqliteDb = null;
let mysqlPool = null;
let mysqlWriteChain = Promise.resolve();

function sanitizeDatabaseName(name) {
  const normalized = String(name || '').trim();
  return normalized && /^[a-zA-Z0-9_]+$/.test(normalized) ? normalized : 'songmaker';
}

function ensureDbDir() {
  const folder = dirname(SQLITE_DB_PATH);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeMysqlConfig() {
  if (MYSQL_URL) {
    const url = new URL(MYSQL_URL);
    const databaseFromUrl = sanitizeDatabaseName(url.pathname.replace(/^\//, ''));

    return {
      host: url.hostname || '127.0.0.1',
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || MYSQL_USER),
      password: decodeURIComponent(url.password || MYSQL_PASSWORD),
      database: databaseFromUrl || MYSQL_DATABASE,
    };
  }

  return {
    host: MYSQL_HOST || '127.0.0.1',
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  };
}

async function initializeMysql() {
  const config = normalizeMysqlConfig();
  const bootstrapConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrapConnection.end();

  mysqlPool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 6,
    queueLimit: 0,
  });

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      scope VARCHAR(120) PRIMARY KEY,
      data LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

async function initializeStorage() {
  if (ACTIVE_DRIVER === 'mysql') {
    await initializeMysql();
    return;
  }

  ensureDbDir();
  sqliteDb = new DatabaseSync(SQLITE_DB_PATH);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      scope TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

async function readStoredState(scope) {
  if (ACTIVE_DRIVER === 'mysql') {
    const [rows] = await mysqlPool.execute(
      `
        SELECT data
        FROM app_state
        WHERE scope = ?
      `,
      [scope]
    );
    return rows[0]?.data ?? null;
  }

  const row = sqliteDb
    .prepare(
      `
        SELECT data
        FROM app_state
        WHERE scope = ?
      `
    )
    .get(scope);

  return row?.data ?? null;
}

async function writeStoredState(scope, serialized, updatedAt) {
  if (ACTIVE_DRIVER === 'mysql') {
    await mysqlPool.execute(
      `
        INSERT INTO app_state (scope, data, updated_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          data = VALUES(data),
          updated_at = VALUES(updated_at)
      `,
      [scope, serialized, updatedAt]
    );
    return;
  }

  sqliteDb
    .prepare(
      `
        INSERT INTO app_state (scope, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `
    )
    .run(scope, serialized, updatedAt);
}

await initializeStorage();

export function resolveServerPath(fileName) {
  return join(__dirname, fileName);
}

export function saveSqlState(scope, state) {
  const serialized = JSON.stringify(state);
  const updatedAt = Date.now();

  if (ACTIVE_DRIVER === 'mysql') {
    mysqlWriteChain = mysqlWriteChain
      .then(() => writeStoredState(scope, serialized, updatedAt))
      .catch((error) => {
        console.error('[sql-state] mysql write failed', error);
      });
    return state;
  }

  sqliteDb
    .prepare(
      `
        INSERT INTO app_state (scope, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `
    )
    .run(scope, serialized, updatedAt);

  return state;
}

export function getMysqlPool() {
  return mysqlPool;
}

export function queueMysqlWrite(work, label = 'mysql write') {
  if (ACTIVE_DRIVER !== 'mysql') {
    return Promise.resolve();
  }

  mysqlWriteChain = mysqlWriteChain
    .then(() => work(mysqlPool))
    .catch((error) => {
      console.error(`[sql-state] ${label} failed`, error);
    });

  return mysqlWriteChain;
}

export async function runMysqlTransaction(work) {
  if (ACTIVE_DRIVER !== 'mysql') {
    throw new Error('MySQL transaction requested while mysql driver is disabled.');
  }

  const connection = await mysqlPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function loadSqlState(scope, createSeedState, options = {}) {
  const raw = await readStoredState(scope);
  const seed = createSeedState();
  let nextState = raw ? safeParseJson(raw) : null;

  if (!nextState && options.legacyFilePath && existsSync(options.legacyFilePath)) {
    const legacyRaw = readFileSync(options.legacyFilePath, 'utf8');
    nextState = safeParseJson(legacyRaw);
  }

  if (!nextState) {
    nextState = seed;
  }

  const normalized = options.normalize ? options.normalize(nextState, seed) : nextState;
  saveSqlState(scope, normalized);
  if (ACTIVE_DRIVER === 'mysql') {
    await mysqlWriteChain;
  }
  return normalized;
}

export function getSqliteDatabasePath() {
  return SQLITE_DB_PATH;
}

export function getSqlDriver() {
  return ACTIVE_DRIVER;
}
