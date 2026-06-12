import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
    listUsers, findUserById, updateUser,
    getUsageStats, getGlobalUsageSummary, getUserUsageStats,
} from '../db/init.js';

const router = Router();
router.use(requireAdmin);

// ===== GET /api/admin/users =====
router.get('/users', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
        const search = req.query.search || '';
        const result = listUsers(page, pageSize, search);
        res.json(result);
    } catch (err) {
        console.error('[管理员-用户列表错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== GET /api/admin/users/:id =====
router.get('/users/:id', (req, res) => {
    try {
        const user = findUserById(parseInt(req.params.id));
        if (!user) return res.status(404).json({ error: { message: '用户不存在' } });
        const usage = getUserUsageStats(user.id, 30);
        res.json({ user, usage });
    } catch (err) {
        console.error('[管理员-用户详情错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== PATCH /api/admin/users/:id =====
router.patch('/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = findUserById(userId);
        if (!user) return res.status(404).json({ error: { message: '用户不存在' } });

        const { balance, role, email } = req.body;
        const updates = {};
        if (balance !== undefined) updates.balance = parseFloat(balance);
        if (role && ['user', 'admin'].includes(role)) updates.role = role;
        if (email !== undefined) updates.email = email;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: { message: '没有可更新的字段' } });
        }

        updateUser(userId, updates);
        const updated = findUserById(userId);
        console.log(`[管理员] 更新用户 #${userId}:`, updates);
        res.json({ user: updated });
    } catch (err) {
        console.error('[管理员-更新用户错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

// ===== GET /api/admin/usage =====
router.get('/usage', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = getUsageStats(Math.min(days, 90));
        const summary = getGlobalUsageSummary(Math.min(days, 90));
        res.json({ stats, summary });
    } catch (err) {
        console.error('[管理员-用量统计错误]', err);
        res.status(500).json({ error: { message: '服务器内部错误' } });
    }
});

export default router;
