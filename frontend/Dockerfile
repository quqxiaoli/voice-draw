# 三阶段构建:deps 装依赖 / builder 编译 / runner 跑 next start
# 注:后端地址改成运行时按 window.location 拼接(见 lib/stream.ts),
#     这里不接受 NEXT_PUBLIC_API_BASE build arg,保持镜像与部署 IP 解耦
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# 国内加速
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "run", "start"]
