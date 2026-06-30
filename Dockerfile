# ============================================================
# 易聊智能 - Dockerfile
# 单阶段构建（sql.js 是纯 JS/WASM，无需编译工具）
# ============================================================

FROM node:20-alpine

WORKDIR /app

# 安装 dumb-init（正确处理信号，优雅退出）
RUN apk add --no-cache dumb-init

# 复制 package.json，利用 Docker 缓存层
COPY backend/package.json backend/package-lock.json* ./

# 安装依赖（生产模式）
RUN npm ci --omit=dev

# 复制后端源码
COPY backend/ ./

# 复制前端静态文件到 public 目录
COPY *.html *.css *.js ./public/

# 创建非 root 用户 + 数据目录
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

USER nodejs

# 数据持久化卷（挂载到宿主机目录）
VOLUME ["/app/data"]

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

