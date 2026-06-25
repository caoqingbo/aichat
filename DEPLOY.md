# 易聊智能 - 阿里云部署指南

> 适用场景：单台 ECS 云服务器部署，包含 Nginx + Node.js 后端 + SQLite 数据库

---

## 一、你需要购买的阿里云服务

| 服务 | 规格 | 月费（参考） | 说明 |
|------|------|:---:|------|
| **ECS 云服务器** | 2 vCPU / 2 GiB / 40 GB ESSD | ¥50~70 | 安装 Docker，跑全部服务 |
| **弹性公网 IP** | 按流量计费 | ¥10~20 | 绑定 ECS，对外提供访问 |
| **域名**（可选） | .com / .cn | ¥30~60/年 | 配置 HTTPS 需要域名 |

> **总计约 ¥70~100/月**，一台 ECS 搞定全部。

### 操作系统选择

购买 ECS 时，镜像选 **Alibaba Cloud Linux 3** 或 **Ubuntu 22.04**，本文档以 Ubuntu 为例。

---

## 二、ECS 初始化配置

### 2.1 登录服务器

```bash
ssh root@<你的公网IP>
```

### 2.2 安装 Docker

```bash
# 安装 Docker（官方脚本）
curl -fsSL https://get.docker.com | bash

# 启动 Docker
systemctl enable docker
systemctl start docker

# 验证
docker --version

# 安装 docker-compose 插件
apt install -y docker-compose-plugin
```

### 2.3 创建项目目录

```bash
mkdir -p /opt/yiliao
cd /opt/yiliao
```

---

## 三、上传项目文件

在**本地开发机**上执行（Windows PowerShell）：

```powershell
# 打包项目（排除 node_modules、.git 等）
cd d:\invest\aichat
tar --exclude='node_modules' --exclude='.git' --exclude='.env' -czf yiliao-deploy.tar.gz .

# 上传到服务器
scp yiliao-deploy.tar.gz root@<你的公网IP>:/opt/yiliao/
```

在**服务器**上解压：

```bash
cd /opt/yiliao
tar -xzf yiliao-deploy.tar.gz
rm yiliao-deploy.tar.gz
```

---

## 四、配置环境变量

### 4.1 创建 .env 文件

```bash
cd /opt/yiliao
nano .env
```

填入以下内容（**替换所有 `sk-xxx` 为真实 API Key**）：

```env
# ===== AI 提供商 API Keys =====
# 支持多 Key 轮询（故障自动切换）
OPENAI_API_KEY=sk-your-real-openai-key
DEEPSEEK_KEY_1=sk-your-real-deepseek-key
# DEEPSEEK_KEY_2=sk-backup-key    # 可选备用 Key
OPENROUTER_API_KEY=sk-or-your-real-key

# ===== JWT 密钥（务必修改！）=====
# 生成随机密钥：openssl rand -base64 48
JWT_SECRET=yiliao-prod-随机字符串-请替换

# ===== 邮件配置（找回密码用，可选）=====
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-email@qq.com
SMTP_PASS=your-smtp-auth-code
SMTP_FROM=易聊智能 <your-email@qq.com>

# ===== 其他 =====
NODE_ENV=production
PORT=3000
SERVICE_FEE_PER_10K_TOKENS=0.5
```

### 4.2 生成强随机 JWT_SECRET

```bash
openssl rand -base64 48
```

把输出的字符串替换到 `.env` 的 `JWT_SECRET`。

---

## 五、启动服务

```bash
cd /opt/yiliao

# 构建并启动（-d 表示后台运行）
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

首次启动会自动：
- 构建 Node.js 后端镜像
- 拉取 Nginx 镜像
- 初始化 SQLite 数据库
- 创建数据持久化卷

---

## 六、验证部署

```bash
# 健康检查
curl http://localhost/health
# 预期输出: {"status":"ok","timestamp":"2026-06-14T..."}

# 注册测试用户
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123456"}'

# 登录
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123456"}'
```

浏览器访问 `http://<你的公网IP>` 应能看到易聊智能首页。

---

## 七、配置 HTTPS（推荐）

### 7.1 安装 Certbot

```bash
apt install -y certbot
```

### 7.2 获取免费 SSL 证书

> **前提**：域名已解析到服务器 IP

```bash
# 先停掉 Nginx
docker compose stop nginx

# 申请证书（standalone 模式，需要 80 端口空闲）
certbot certonly --standalone -d your-domain.com

# 证书位置：
#   /etc/letsencrypt/live/your-domain.com/fullchain.pem
#   /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 7.3 复制证书到项目

```bash
mkdir -p /opt/yiliao/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/yiliao/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/yiliao/ssl/
```

### 7.4 启用 HTTPS

编辑 `nginx.conf`，在 server 块中添加：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # ... 其余配置保持不变 ...
}

# HTTP 自动跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

然后重启：

```bash
docker compose restart nginx
```

### 7.5 证书自动续期

```bash
# 添加 crontab 定时任务（每月 1 号凌晨 2 点）
crontab -e
```

添加：
```
0 2 1 * * certbot renew --pre-hook "docker compose -f /opt/yiliao/docker-compose.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/yiliao/ssl/ && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/yiliao/ssl/ && docker compose -f /opt/yiliao/docker-compose.yml start nginx"
```

---

## 八、日常运维

### 常用命令

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f backend

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码后重新构建
docker compose up -d --build

# 查看数据库内容（进入容器）
docker exec -it yiliao-backend sh
```

### 数据库备份

SQLite 数据库文件位于 Docker 卷中：

```bash
# 备份到宿主机
docker cp yiliao-backend:/app/data/yiliao.db ./backup-$(date +%Y%m%d).db

# 恢复
docker cp ./backup-20260614.db yiliao-backend:/app/data/yiliao.db
docker compose restart backend
```

建议添加 crontab 每日自动备份：

```bash
0 3 * * * docker cp yiliao-backend:/app/data/yiliao.db /opt/backups/yiliao-$(date +\%Y\%m\%d).db
```

### 升级依赖

```bash
cd /opt/yiliao
git pull  # 或重新上传新代码
docker compose up -d --build
```

---

## 九、安全加固建议

| 项目 | 操作 |
|------|------|
| **SSH 端口** | 修改为高位端口（如 2222），禁用 root 密码登录 |
| **防火墙** | 仅开放 80/443/SSH 端口：`ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 22/tcp && ufw enable` |
| **阿里云安全组** | 在 ECS 控制台 -> 安全组，同样仅放行 80/443/SSH |
| **JWT_SECRET** | 确保已修改为强随机字符串 |
| **API Key** | 定期在提供商后台轮换 |
| **CORS** | 生产环境限制为具体域名 |

### 生产环境 CORS 配置

修改 `server.js` 中的 `app.use(cors())`：

```js
app.use(cors({
    origin: 'https://your-domain.com',
    credentials: true,
}));
```

---

## 十、环境变量完整清单

| 变量 | 必填 | 说明 |
|------|:---:|------|
| `OPENAI_API_KEY` | 是 | OpenAI API Key |
| `DEEPSEEK_KEY_1` | 是 | DeepSeek API Key（支持 `_2`, `_3` 多 Key 轮询） |
| `OPENROUTER_API_KEY` | 是 | OpenRouter API Key |
| `JWT_SECRET` | 是 | JWT 签名密钥（生产环境必须修改） |
| `PORT` | 否 | 后端端口，默认 3000 |
| `NODE_ENV` | 否 | 环境标识，production/development |
| `SMTP_HOST` | 否 | SMTP 服务器（找回密码用） |
| `SMTP_PORT` | 否 | SMTP 端口 |
| `SMTP_USER` | 否 | SMTP 账号 |
| `SMTP_PASS` | 否 | SMTP 密码/授权码 |
| `SMTP_FROM` | 否 | 发件人名称 |
| `SERVICE_FEE_PER_10K_TOKENS` | 否 | 通道服务费（元/万token），默认 0.5 |

---

## 十一、常见问题

### Q: 启动后访问 502 Bad Gateway？

```bash
docker compose logs backend  # 查看后端日志
```

常见原因：`.env` 文件未配置或 API Key 格式不对（仍有 `sk-xxx` 占位符）。

### Q: SQLite 数据会丢吗？

不会。数据文件通过 Docker Volume (`yiliao_data`) 持久化在宿主机，并且每次写操作后 200ms 内自动保存到磁盘。进程收到 SIGTERM 时也会强制保存。

### Q: 如何处理高并发？

SQLite 适合单机低并发场景（< 100 QPS 写）。如果用户量上来，可以：
1. 迁移到 PostgreSQL（阿里云 RDS）
2. 加 Redis 做会话和限流缓存
3. 后端水平扩展（多实例 + 负载均衡）

### Q: 如何监控？

```bash
# 查看容器资源占用
docker stats

# 查看 API Key 池状态
curl http://localhost/api/admin/keys
```

---

> 📧 有问题？检查 `docker compose logs` 输出，或查看 `backend/README.md` 获取 API 文档。
