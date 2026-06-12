import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'yiliao-dev-secret-change-in-production';

// ===== JWT 鉴权中间件 =====
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: { message: '未提供认证令牌，请先登录' } });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: { message: '令牌已过期，请重新登录', code: 'TOKEN_EXPIRED' } });
        }
        return res.status(403).json({ error: { message: '无效的认证令牌' } });
    }
}

// ===== 可选鉴权 =====
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
        try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* ignore */ }
    }
    next();
}

// ===== 管理员鉴权 =====
export function requireAdmin(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: { message: '需要管理员权限' } });
        }
        next();
    });
}

// ===== 生成 Token =====
export function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '2h' }
    );
}

export function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export { JWT_SECRET };
