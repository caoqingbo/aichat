import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'yiliao.db');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// ===== 初始化数据库 =====
export async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('[数据库] 已加载现有数据库');
    } else {
        db = new SQL.Database();
        console.log('[数据库] 创建新数据库');
    }

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT DEFAULT '',
        balance REAL DEFAULT 3.00,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        model TEXT NOT NULL,
        provider TEXT DEFAULT '',
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    saveDatabase();
    console.log('[数据库] 表结构初始化完成 (users, refresh_tokens, password_resets, usage_logs)');
}

function saveDatabase() {
    if (!db) return;
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ===== 用户操作 =====
export function createUser(username, passwordHash, email = '') {
    db.run('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        [username, passwordHash, email]);
    saveDatabase();
    return findUserByUsername(username);
}

export function findUserByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    stmt.bind([username]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export function findUserById(id) {
    const stmt = db.prepare('SELECT id, username, email, balance, role, created_at, updated_at FROM users WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export function findUserByEmail(email) {
    const stmt = db.prepare('SELECT id, username, email, balance, role FROM users WHERE email = ?');
    stmt.bind([email]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export function updateUserPassword(userId, passwordHash) {
    db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        [passwordHash, userId]);
    saveDatabase();
}

export function updateUserBalance(userId, newBalance) {
    db.run("UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        [newBalance, userId]);
    saveDatabase();
}

export function updateUser(userId, fields) {
    const allowed = ['email', 'balance', 'role'];
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
        if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (sets.length === 0) return;
    vals.push(userId);
    db.run(`UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`, vals);
    saveDatabase();
}

// ===== 用户列表（管理员）=====
export function listUsers(page = 1, pageSize = 20, search = '') {
    const offset = (page - 1) * pageSize;
    let where = '';
    const params = [];
    if (search) { where = 'WHERE username LIKE ? OR email LIKE ?'; params.push(`%${search}%`, `%${search}%`); }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM users ${where}`);
    if (params.length) countStmt.bind(params);
    const total = countStmt.step() ? countStmt.getAsObject().total : 0;
    countStmt.free();

    const stmt = db.prepare(
        `SELECT id, username, email, balance, role, created_at, updated_at FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    );
    const allParams = [...params, pageSize, offset];
    stmt.bind(allParams);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { rows, total, page, pageSize };
}

// ===== Refresh Token 操作 =====
export function saveRefreshToken(userId, token, expiresAt) {
    db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, token, expiresAt]);
    saveDatabase();
}

export function findRefreshToken(token) {
    const stmt = db.prepare("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?");
    const nowISO = new Date().toISOString();
    stmt.bind([token, nowISO]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export function deleteRefreshToken(token) {
    db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    saveDatabase();
}

export function deleteUserRefreshTokens(userId) {
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    saveDatabase();
}

// ===== 密码重置操作 =====
export function savePasswordReset(email, code, expiresAt) {
    // expiresAt 应为 ISO 字符串，转为 SQLite 兼容格式
    db.run("UPDATE password_resets SET used = 1 WHERE email = ?", [email]);
    db.run('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)',
        [email, code, expiresAt]);
    saveDatabase();
}

export function verifyResetCode(email, code) {
    const stmt = db.prepare(
        "SELECT * FROM password_resets WHERE email = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1"
    );
    const nowISO = new Date().toISOString();
    stmt.bind([email, code, nowISO]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export function markResetUsed(id) {
    db.run('UPDATE password_resets SET used = 1 WHERE id = ?', [id]);
    saveDatabase();
}

// ===== 用量日志 =====
export function logUsage(userId, model, provider, promptTokens, completionTokens, cost) {
    db.run(
        'INSERT INTO usage_logs (user_id, model, provider, prompt_tokens, completion_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)',
        [userId || null, model, provider, promptTokens, completionTokens, cost]
    );
    saveDatabase();
}

export function getUsageStats(days = 7) {
    const stmt = db.prepare(
        `SELECT date(created_at) as date, model, provider,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens,
                SUM(cost) as cost,
                COUNT(*) as requests
         FROM usage_logs
         WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime')
         GROUP BY date(created_at), model
         ORDER BY date DESC, requests DESC`,
    );
    stmt.bind([days]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export function getUserUsageStats(userId, days = 30) {
    const stmt = db.prepare(
        `SELECT date(created_at) as date, model,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens,
                SUM(cost) as cost,
                COUNT(*) as requests
         FROM usage_logs WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days', 'localtime')
         GROUP BY date(created_at), model ORDER BY date DESC`,
    );
    stmt.bind([userId, days]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export function getGlobalUsageSummary(days = 7) {
    const stmt = db.prepare(
        `SELECT COUNT(DISTINCT user_id) as active_users,
                SUM(prompt_tokens) as total_prompt_tokens,
                SUM(completion_tokens) as total_completion_tokens,
                SUM(cost) as total_cost,
                COUNT(*) as total_requests
         FROM usage_logs
         WHERE created_at >= datetime('now', '-' || ? || 'days', 'localtime')`,
    );
    stmt.bind([days]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

export default db;
