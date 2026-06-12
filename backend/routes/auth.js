import { Router } from 'express';
import bcrypt from 'bcrypt';
import { sendResetCode } from '../utils/mailer.js';
import {
    createUser, findUserByUsername, findUserById, findUserByEmail,
    updateUserPassword,
    saveRefreshToken, findRefreshToken, deleteRefreshToken, deleteUserRefreshTokens,
    savePasswordReset, verifyResetCode, markResetUsed,
} from '../db/init.js';
import { generateAccessToken, generateRefreshToken, authenticateToken } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 12;

// ===== POST /api/auth/register =====
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: { message: '账号和密码不能为空' } });
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return res.status(400).json({ error: { message: '账号须为 3-30 位字母、数字或下划线' } });
        if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: { message: '密码至少 6 位，且必须包含数字和字母' } });

        if (findUserByUsername(username)) return res.status(409).json({ error: { message: '该账号已被注册' } });

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const email = req.body.email || '';
        const user = createUser(username, passwordHash, email);
        if (!user) return res.status(500).json({ error: { message: '创建用户失败' } });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        saveRefreshToken(user.id, refreshToken, expiresAt);

        console.log(`[注册] 新用户: ${username} (id=${user.id})`);
        res.status(201).json({
            message: '注册成功',
            user: { id: user.id, username: user.username, balance: user.balance || 3.00, role: user.role || 'user' },
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (err) {
        console.error('[注册错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== POST /api/auth/login =====
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: { message: '请输入账号和密码' } });

        const user = findUserByUsername(username);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: { message: '账号或密码错误' } });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        deleteUserRefreshTokens(user.id);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        saveRefreshToken(user.id, refreshToken, expiresAt);

        console.log(`[登录] 用户: ${username} (id=${user.id})`);
        res.json({
            message: '登录成功',
            user: { id: user.id, username: user.username, email: user.email, balance: user.balance, role: user.role },
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (err) {
        console.error('[登录错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== POST /api/auth/refresh =====
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ error: { message: '缺少 refresh_token' } });

        const stored = findRefreshToken(refresh_token);
        if (!stored) return res.status(401).json({ error: { message: 'refresh_token 无效或已过期' } });

        const user = findUserById(stored.user_id);
        if (!user) return res.status(401).json({ error: { message: '用户不存在' } });

        deleteRefreshToken(refresh_token);
        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        saveRefreshToken(user.id, newRefreshToken, expiresAt);

        res.json({ access_token: accessToken, refresh_token: newRefreshToken });
    } catch (err) {
        console.error('[刷新Token错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== POST /api/auth/logout =====
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (refresh_token) deleteRefreshToken(refresh_token);
        deleteUserRefreshTokens(req.user.userId);
        res.json({ message: '已登出' });
    } catch (err) {
        console.error('[登出错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== POST /api/auth/forgot-password =====
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: { message: '请输入安全邮箱' } });

        const user = findUserByEmail(email);
        if (!user) {
            // 不暴露邮箱是否注册，统一返回成功
            return res.json({ message: '如果该邮箱已注册，验证码已发送' });
        }

        // 生成 6 位数字验证码
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 分钟
        savePasswordReset(email, code, expiresAt);

        const result = await sendResetCode(email, code);
        if (!result.success) {
            return res.status(500).json({ error: { message: '邮件发送失败，请稍后重试' } });
        }

        console.log(`[找回密码] ${email} 验证码: ${code}`);
        // 开发环境下返回验证码（方便调试）
        const response = { message: '验证码已发送，请查收邮件' };
        if (result.code) response.debug_code = result.code;
        res.json(response);
    } catch (err) {
        console.error('[找回密码错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== POST /api/auth/reset-password =====
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, new_password } = req.body;
        if (!email || !code || !new_password) {
            return res.status(400).json({ error: { message: '请填写邮箱、验证码和新密码' } });
        }
        if (new_password.length < 6 || !/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
            return res.status(400).json({ error: { message: '新密码至少 6 位，且必须包含数字和字母' } });
        }

        const resetRecord = verifyResetCode(email, code);
        if (!resetRecord) {
            return res.status(400).json({ error: { message: '验证码无效或已过期' } });
        }

        const user = findUserByEmail(email);
        if (!user) return res.status(404).json({ error: { message: '用户不存在' } });

        const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
        updateUserPassword(user.id, passwordHash);
        markResetUsed(resetRecord.id);

        // 清除所有登录会话
        deleteUserRefreshTokens(user.id);

        console.log(`[重置密码] 用户: ${user.username}`);
        res.json({ message: '密码重置成功，请重新登录' });
    } catch (err) {
        console.error('[重置密码错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

export default router;
