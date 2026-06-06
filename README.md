# 易聊智能

一个静态前端演示项目，展示 AI 聚合服务网站的首页、模型页、聊天页和登录注册页。

## 项目结构

```text
aichat/
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       └── home.js
├── pages/
│   ├── chat.html
│   ├── login.html
│   ├── models.html
│   └── register.html
├── index.html
└── .gitignore
```

## 页面说明

- `index.html`：营销首页与站点入口
- `pages/chat.html`：聊天工作台示例
- `pages/models.html`：模型列表与筛选展示
- `pages/login.html`：登录页
- `pages/register.html`：注册页

## 本地预览

可以直接在项目根目录启动任意静态文件服务，例如：

```bash
python -m http.server 8000
```
