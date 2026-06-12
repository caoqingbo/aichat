import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { findUserById, getUserUsageStats } from '../db/init.js';

const router = Router();
router.use(authenticateToken);

// ===== GET /api/user/profile =====
router.get('/profile', (req, res) => {
    try {
        const user = findUserById(req.user.userId);
        if (!user) return res.status(404).json({ error: { message: '用户不存在' } });
        res.json({ user: { id: user.id, username: user.username, email: user.email, balance: user.balance, role: user.role, created_at: user.created_at } });
    } catch (err) {
        console.error('[获取用户信息错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== GET /api/user/balance =====
router.get('/balance', (req, res) => {
    try {
        const user = findUserById(req.user.userId);
        if (!user) return res.status(404).json({ error: { message: '用户不存在' } });
        res.json({ balance: user.balance, username: user.username });
    } catch (err) {
        console.error('[获取余额错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== GET /api/user/usage =====
router.get('/usage', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const stats = getUserUsageStats(req.user.userId, Math.min(days, 90));
        res.json({ usage: stats });
    } catch (err) {
        console.error('[获取用量错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

export default router;
