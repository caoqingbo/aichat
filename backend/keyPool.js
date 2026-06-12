/**
 * API Key 池管理模块
 * 
 * 功能：
 * - 多 Key 轮询（Round-Robin）
 * - 401/403 自动禁用
 * - 429 限流冷却（60s 后恢复）
 * - 用量统计
 * - 健康检查接口
 */

class KeyPool {
    constructor() {
        this.pools = {};       // { provider: [ {key, index, healthy, cooldownUntil, stats} ] }
        this.roundRobin = {};  // { provider: nextIndex }
        
        this._loadKeys();
    }

    // ===== 从环境变量加载 Key =====
    _loadKeys() {
        const providers = ['OPENAI', 'DEEPSEEK', 'OPENROUTER'];
        
        for (const provider of providers) {
            const keys = [];
            
            // 先检查多 Key 格式：PROVIDER_KEY_1, PROVIDER_KEY_2, ...
            for (let i = 1; i <= 99; i++) {
                const key = process.env[`${provider}_KEY_${i}`];
                if (key && key.trim() && !key.startsWith('sk-xxx')) {
                    keys.push(key.trim());
                } else {
                    break; // 序号不连续就停止
                }
            }
            
            // 如果没找到多 Key，回退到单 Key 格式
            if (keys.length === 0) {
                const singleKey = process.env[`${provider}_API_KEY`];
                if (singleKey && singleKey.trim() && !singleKey.startsWith('sk-xxx')) {
                    keys.push(singleKey.trim());
                }
            }
            
            // 转为标准化的 provider 名称
            const name = provider === 'OPENAI' ? 'OpenAI' : 
                         provider === 'DEEPSEEK' ? 'DeepSeek' : 'OpenRouter';
            
            this.pools[name] = keys.map((key, idx) => ({
                key,
                index: idx,
                healthy: true,
                cooldownUntil: 0,
                stats: {
                    requests: 0,
                    success: 0,
                    errors: 0,
                    lastUsed: null,
                    lastError: null,
                }
            }));
            
            this.roundRobin[name] = 0;
            
            console.log(`[KeyPool] ${name}: 加载 ${keys.length} 个 Key`);
        }
    }

    // ===== 获取一个可用的 Key =====
    getKey(provider) {
        const pool = this.pools[provider];
        if (!pool || pool.length === 0) return null;
        
        const now = Date.now();
        const healthyKeys = pool.filter(k => k.healthy || k.cooldownUntil <= now);
        
        if (healthyKeys.length === 0) {
            console.error(`[KeyPool] ${provider}: 所有 Key 均不可用！`);
            return null;
        }
        
        // 轮询选择
        const startIdx = this.roundRobin[provider] % healthyKeys.length;
        const selected = healthyKeys[startIdx];
        
        // 推进轮询指针
        this.roundRobin[provider] = (this.roundRobin[provider] + 1) % Math.max(healthyKeys.length, 1);
        
        selected.stats.requests++;
        selected.stats.lastUsed = new Date().toISOString();
        
        return selected;
    }

    // ===== 标记成功 =====
    markSuccess(provider, keyIndex) {
        const pool = this.pools[provider];
        if (!pool) return;
        
        const keyObj = pool.find(k => k.index === keyIndex);
        if (keyObj) {
            keyObj.stats.success++;
            keyObj.healthy = true;
            keyObj.cooldownUntil = 0;
        }
    }

    // ===== 标记错误（根据状态码决定处理方式）=====
    markError(provider, keyIndex, statusCode) {
        const pool = this.pools[provider];
        if (!pool) return;
        
        const keyObj = pool.find(k => k.index === keyIndex);
        if (!keyObj) return;
        
        keyObj.stats.errors++;
        keyObj.stats.lastError = new Date().toISOString();
        
        if (statusCode === 401 || statusCode === 403) {
            // 认证失败 → 永久禁用
            keyObj.healthy = false;
            keyObj.cooldownUntil = Infinity;
            console.warn(`[KeyPool] ${provider} Key #${keyIndex}: ${statusCode} → 永久禁用`);
        } else if (statusCode === 429) {
            // 限流 → 60 秒冷却
            keyObj.healthy = false;
            keyObj.cooldownUntil = Date.now() + 60000;
            console.warn(`[KeyPool] ${provider} Key #${keyIndex}: 429 → 冷却 60 秒`);
        } else if (statusCode >= 500) {
            // 服务器错误 → 标记不健康，但允许后续重试
            keyObj.healthy = false;
            console.warn(`[KeyPool] ${provider} Key #${keyIndex}: ${statusCode} → 暂时标记不健康`);
        }
    }

    // ===== 获取池状态（供管理接口使用）=====
    getStatus() {
        const result = {};
        for (const [provider, pool] of Object.entries(this.pools)) {
            result[provider] = pool.map(k => ({
                index: k.index,
                healthy: k.healthy,
                cooldownUntil: k.cooldownUntil > Date.now() ? new Date(k.cooldownUntil).toISOString() : null,
                stats: { ...k.stats },
                keyPreview: k.key.slice(0, 10) + '...',
            }));
        }
        return result;
    }
}

// 单例导出
export const keyPool = new KeyPool();
