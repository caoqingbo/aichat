# 易聊智能后端服务

后端中转服务，提供 AI 聊天代理、用户认证、计费管理等功能。

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写真实的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
OPENAI_API_KEY=sk-your-real-key
DEEPSEEK_API_KEY=sk-your-real-key
OPENROUTER_API_KEY=sk-or-your-real-key
```

### 3. 启动服务

```bash
npm start        # 生产模式
npm run dev      # 开发模式（自动重启）
```

服务启动后访问：
- 健康检查：http://localhost:3000/health
- API 代理：http://localhost:3000/api/chat/completions

## API 文档

### POST /api/chat/completions

聊天代理端点，支持 SSE 流式响应。

**请求体：**

```json
{
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "temperature": 0.7,
  "stream": true,
  "userApiKeys": {  // 可选，用户自带 Key
    "openai": "sk-xxx",
    "deepseek": "sk-xxx",
    "openrouter": "sk-or-xxx"
  }
}
```

**响应：**

SSE 流式数据，兼容 OpenAI 格式。

## 项目结构

```
backend/
├── server.js           # 主入口
├── package.json        # 依赖配置
├── .env.example        # 环境变量模板
├── .env                # 环境变量（不提交）
├── .gitignore          # Git 忽略规则
└── README.md           # 本文档
```

## 功能清单

- ✅ Express 服务器
- ✅ CORS 跨域支持
- ✅ SSE 流式代理转发
- ✅ 双轨制 Key 管理（平台 Key 池 + 用户自带 Key）
- ⏳ 用户认证（JWT）
- ⏳ 数据库集成（PostgreSQL）
- ⏳ Token 用量计费
- ⏳ Rate Limiting

## 部署

### Docker 部署

（待 Module 9 实现）

### 阿里云 ECS 部署

（待 Module 9 实现）

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 服务端口 | 3000 |
| `NODE_ENV` | 运行环境 | development / production |
| `OPENAI_API_KEY` | OpenAI 官方 Key | sk-xxx |
| `DEEPSEEK_API_KEY` | DeepSeek 官方 Key | sk-xxx |
| `OPENROUTER_API_KEY` | OpenRouter Key | sk-or-xxx |
| `SERVICE_FEE_PER_10K_TOKENS` | 通道服务费（元/万token）| 0.5 |

## License

MIT
