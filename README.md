# 易聊智能

一个纯前端 AI 聚合服务网站原型：首页采用协作白板式 SaaS 风格，登录后进入 AI 对话工作台。

## 功能

- 首页：白板点阵、便利贴、模型卡片、API 路由线、调度控制台、价格与注册 CTA
- 登录后工作台：顶部导航、品牌区、对话列表、聊天工作台
- 多模型搜索与切换：OpenAI、DeepSeek、OpenRouter
- 对话管理：新建、切换、删除、清空，使用 localStorage 保存
- 上下文开关：支持单次对话或携带最近消息上下文
- 高级设置：API Key、API 地址、System Prompt、Temperature、上下文消息数
- 流式输出：兼容 `/v1/chat/completions` 的 SSE 返回
- Markdown 渲染与代码复制

## 使用

直接打开本目录下的 `index.html`，或启动一个静态服务器：

```bash
python3 -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

首页入口为 `index.html`，登录后的 AI 对话页为 `chat.html`。
在对话页点击右上角头像或“高级设置”填写对应供应商的 API Key，即可选择模型开始对话。

## 文件

```text
aichat/
├── index.html
├── login.html
├── chat.html
├── style.css
├── home.js
├── app.js
└── README.md
```
