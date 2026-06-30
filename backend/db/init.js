/**
 * 数据库初始化 & 操作模块
 * 
 * 使用 sql.js（WASM 版 SQLite）
 * 每次写操作后自动保存到磁盘文件，进程重启数据不丢失
 */

import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'yiliao.db');

// 确保 data 目录存在（Docker 中挂载为 VOLUME）
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

// 防抖保存：避免高频写入时频繁 fsync
let saveTimeout = null;
function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (db) {
            const data = db.export();
            fs.writeFileSync(DB_PATH, Buffer.from(data));
        }
    }, 200); // 200ms 内的多次写入合并为一次 fsync
}

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

    // 索引加速查询
    db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at)');

    // 立即写入磁盘
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('[数据库] 表结构初始化完成 (users, refresh_tokens, password_resets, usage_logs)');
    console.log(`[数据库] 文件: ${DB_PATH}`);
}


// ===== 用户操作 =====

export function createUser(username, passwordHash, email = '') {
    db.run('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        [username, passwordHash, email]);
    scheduleSave();
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
    scheduleSave();
}

export function updateUserBalance(userId, newBalance) {
    db.run("UPDATE users SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        [newBalance, userId]);
    scheduleSave();
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
    scheduleSave();
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
    scheduleSave();
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
    scheduleSave();
}

export function deleteUserRefreshTokens(userId) {
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    scheduleSave();
}

// ===== 密码重置操作 =====

export function savePasswordReset(email, code, expiresAt) {
    db.run("UPDATE password_resets SET used = 1 WHERE email = ?", [email]);
    db.run('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)',
        [email, code, expiresAt]);
    scheduleSave();
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
    scheduleSave();
}

// ===== 用量日志 =====

export function logUsage(userId, model, provider, promptTokens, completionTokens, cost) {
    db.run(
        'INSERT INTO usage_logs (user_id, model, provider, prompt_tokens, completion_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)',
        [userId || null, model, provider, promptTokens, completionTokens, cost]
    );
    scheduleSave();
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
         ORDER BY date DESC, requests DESC`
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
         GROUP BY date(created_at), model ORDER BY date DESC`
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
         WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime')`
    );
    stmt.bind([days]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

// 进程退出前强制保存
process.on('SIGINT', () => { if (saveTimeout) clearTimeout(saveTimeout); if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export())); process.exit(0); });
process.on('SIGTERM', () => { if (saveTimeout) clearTimeout(saveTimeout); if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export())); process.exit(0); });

export default db;
