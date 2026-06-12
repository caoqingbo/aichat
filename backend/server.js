import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// ES 模块 import 会被提升，dotenv 之后用动态 import
const { keyPool } = await import('./keyPool.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 中间件 =====
app.use(cors());
app.use(express.json());

// ===== 日志中间件 =====
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ===== 工具函数：获取 API Key（使用 Key 池）=====
function getApiKey(provider, userApiKeys) {
    // 如果用户提供了自己的 Key，优先使用
    if (userApiKeys) {
        if (provider === 'OpenAI' && userApiKeys.openai) return { key: userApiKeys.openai, fromPool: false };
        if (provider === 'DeepSeek' && userApiKeys.deepseek) return { key: userApiKeys.deepseek, fromPool: false };
        if (provider === 'OpenRouter' && userApiKeys.openrouter) return { key: userApiKeys.openrouter, fromPool: false };
    }
    
    // 使用平台 Key 池
    const keyObj = keyPool.getKey(provider);
    if (keyObj) return { key: keyObj.key, fromPool: true, index: keyObj.index };
    
    return null;
}

// ===== 工具函数：获取 API Base URL =====
function getApiBaseUrl(model) {
    // 根据模型 ID 确定提供商
    if (model.startsWith('gpt-') || model.startsWith('o')) {
        return 'https://api.openai.com';
    }
    if (model.startsWith('deepseek')) {
        return 'https://api.deepseek.com';
    }
    // OpenRouter 模型通常带有 / 分隔符，如 anthropic/claude-xxx
    if (model.includes('/')) {
        return 'https://openrouter.ai/api';
    }
    
    // 默认 OpenAI
    return 'https://api.openai.com';
}

// ===== 工具函数：获取提供商名称 =====
function getProviderName(model) {
    if (model.startsWith('gpt-') || model.startsWith('o')) return 'OpenAI';
    if (model.startsWith('deepseek')) return 'DeepSeek';
    if (model.includes('/')) return 'OpenRouter';
    return 'OpenAI';
}

// ===== 核心路由：AI 聊天代理（SSE 流式转发）=====
app.post('/api/chat/completions', async (req, res) => {
    try {
        const { model, messages, temperature = 0.7, stream = true, userApiKeys } = req.body;
        
        if (!model || !messages) {
            return res.status(400).json({ error: { message: '缺少必要参数：model 或 messages' } });
        }
        
        // 确定提供商和 API 配置
        const provider = getProviderName(model);
        const apiBaseUrl = getApiBaseUrl(model);
        const keyInfo = getApiKey(provider, userApiKeys);
        
        if (!keyInfo) {
            return res.status(401).json({ 
                error: { message: `未配置 ${provider} API Key，请联系管理员或提供自己的 Key` } 
            });
        }
        
        console.log(`[代理] ${provider} ${model} | Key池#${keyInfo.index ?? '用户'} | 消息数: ${messages.length}`);
        
        // 转发请求到 AI 提供商
        const response = await axios({
            method: 'POST',
            url: `${apiBaseUrl}/v1/chat/completions`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${keyInfo.key}`,
            },
            data: {
                model,
                messages,
                temperature,
                stream,
            },
            responseType: 'stream',
            validateStatus: null, // 手动处理状态码
        });
        
        // 非 200 → 标记 Key 错误 + 返回错误
        if (response.status !== 200) {
            let errorBody = '';
            for await (const chunk of response.data) {
                errorBody += chunk.toString();
            }
            
            // 标记 Key 池错误
            if (keyInfo.fromPool) {
                keyPool.markError(provider, keyInfo.index, response.status);
            }
            
            let errorMsg = `${response.status} ${response.statusText}`;
            try {
                const parsed = JSON.parse(errorBody);
                errorMsg = parsed.error?.message || errorMsg;
            } catch {}
            
            return res.status(response.status).json({ error: { message: errorMsg } });
        }
        
        // 成功 → 标记 Key 池成功
        if (keyInfo.fromPool) {
            keyPool.markSuccess(provider, keyInfo.index);
        }
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 逐块转发流式响应
        response.data.on('data', (chunk) => {
            res.write(chunk);
        });
        
        response.data.on('end', () => {
            res.end();
            console.log(`[代理完成] ${provider} ${model}`);
        });
        
        response.data.on('error', (error) => {
            console.error(`[流式错误]`, error);
            res.end();
        });
        
        // 客户端断开连接时中止请求
        req.on('close', () => {
            response.data.destroy();
        });
        
    } catch (error) {
        console.error('[代理错误]', error.message);
        
        if (res.headersSent) {
            res.end();
        } else {
            res.status(error.response?.status || 500).json({
                error: {
                    message: error.response?.data?.error?.message || error.message,
                },
            });
        }
    }
});

// ===== Key 池管理接口（管理员）=====
app.get('/api/admin/keys', (req, res) => {
    res.json(keyPool.getStatus());
});

// ===== 健康检查 =====
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== 启动服务器 =====
app.listen(PORT, () => {
    console.log(`\n🚀 易聊智能后端服务启动成功！`);
    console.log(`📡 监听端口: ${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ 健康检查: http://localhost:${PORT}/health`);
    console.log(`🤖 代理端点: http://localhost:${PORT}/api/chat/completions`);
    console.log(`🔑 Key 池状态: http://localhost:${PORT}/api/admin/keys\n`);
});
