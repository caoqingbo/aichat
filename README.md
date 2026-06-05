# AI Chat Client

一个轻量级的 ChatGPT 风格 Web 聊天客户端，纯前端实现，无需构建工具。

## ✨ 功能特性

- 🎨 **暗色主题** — 仿 ChatGPT 的现代 UI，响应式布局
- ⚡ **流式输出** — SSE 实时逐字显示 AI 回复
- 📝 **Markdown 渲染** — 支持代码高亮、表格、列表等
- 💬 **会话管理** — 多对话新建 / 切换 / 删除，localStorage 持久化
- 🔄 **多模型切换** — 下拉选择即用，API 地址和 Key 自动匹配
- 🔑 **三组 API Key 独立存储** — DeepSeek / OpenAI / OpenRouter 互不干扰
- ⚙️ **可配置** — System Prompt、Temperature、上下文消息数

## 🚀 支持模型

| 分组 | 模型 |
|------|------|
| **DeepSeek** | DeepSeek V3、DeepSeek R1、MiMo V2 Flash |
| **OpenAI** | GPT-4o、GPT-4o Mini、GPT-4.1 / 4.1 Mini / 4.1 Nano、o4-mini、o3 / o3 Mini / o3 Pro |
| **OpenRouter** | Claude Sonnet 4、Claude 3.5 Sonnet、Claude 3 Opus、Gemini 2.5 Pro / Flash、Llama 4 Maverick、Qwen3 235B、DeepSeek V3 / R1 (OR) |

## 📦 快速开始

直接打开 `index.html` 即可使用，无需安装任何依赖。

```bash
# 克隆仓库
git clone https://github.com/caoqingbo/aichat.git
cd aichat

# 用浏览器打开
start index.html    # Windows
open index.html     # macOS
```

### 配置 API Key

1. 点击左下角 **⚙️ 设置** 按钮
2. 填入对应提供商的 API Key：
   - **DeepSeek**: `sk-...` — 从 [platform.deepseek.com](https://platform.deepseek.com/) 获取
   - **OpenAI**: `sk-...` — 从 [platform.openai.com](https://platform.openai.com/) 获取
   - **OpenRouter**: `sk-or-...` — 从 [openrouter.ai](https://openrouter.ai/) 获取
3. 保存设置，在顶部下拉框选择模型即可开始对话

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| HTML / CSS / JavaScript | 纯原生，零依赖 |
| [marked.js](https://github.com/markedjs/marked) | Markdown 解析与渲染 |
| [highlight.js](https://highlightjs.org/) | 代码语法高亮 |
| OpenAI Compatible API | SSE 流式通信 |
| localStorage | 配置与会话持久化 |

## 📂 项目结构

```
aichat/
├── index.html   # 页面结构（侧边栏、聊天区、设置面板）
├── style.css    # 暗色主题样式
├── app.js       # 核心逻辑（API 调用、会话管理、UI 渲染）
└── README.md
```

## 📋 后续规划

- [ ] 导出 / 导入对话
- [ ] 重新生成 & 编辑消息
- [ ] 图片输入 (Vision)
- [ ] Function Calling
- [ ] 快捷键支持
- [ ] Electron 桌面打包

## 📄 License

MIT
