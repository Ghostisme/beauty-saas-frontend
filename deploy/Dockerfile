# syntax=docker/dockerfile:1
# ⚠️ 上面那行是 BuildKit 的 frontend 声明，不是普通注释，必须是文件第一行。
#    下面 RUN --mount=type=cache 依赖它 —— 缺了这行在部分 Docker 版本上会
#    报 "Unknown flag: mount" 而直接构建失败。
#
# ═══════════════════════════════════════════════════════════════════════
#  余乐圈美业前端 —— 构建镜像（VPS 临时部署专用）
#
#  这个镜像**不用来运行**，只用来产出静态文件。前端是 Vite 打出的纯静态
#  产物，由宿主机 nginx 直接托管，不跑容器 —— 少一个常驻进程，少一份内存。
#
#  用 BuildKit 的 local 导出把 dist/ 直接落到宿主机目录：
#
#    DOCKER_BUILDKIT=1 docker build \
#      -f deploy/Dockerfile --target export \
#      --output type=local,dest=./dist-out .
#
#  好处是 VPS 上**不需要装 Node / pnpm**，只要有 Docker 就能构建，
#  也不会因为宿主机 Node 版本和 package.json 的 engines 不符而失败。
#
#  ⚠️ 这里没有任何 VITE_* 构建期变量，是刻意的：前端把 API 地址写死成
#     同源的 `/api`（src/lib/request.ts），域名变了也不用重新打包。
# ═══════════════════════════════════════════════════════════════════════

# node:22-alpine 对应 package.json 的 engines: node >= 22.13.0
FROM node:22-alpine AS builder
WORKDIR /app

# corepack 按 package.json 里的 packageManager 字段锁定 pnpm 版本，
# 不用手动指定版本号，也就不会和仓库声明的 pnpm@11.23.0 漂移。
#
# ⚠️ COREPACK_ENABLE_DOWNLOAD_PROMPT=0 不能省：corepack 首次要下载某个
#    pnpm 版本时会要求交互确认，而 docker build 没有 TTY，结果是直接报错
#    退出（不是卡住），报错信息还完全不提「需要确认」这件事。
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# 依赖层单独成层：只改源码时整层命中缓存，跳过整个 install。
# cache mount 让 pnpm store 跨构建复用 —— 改了 lockfile 时这一层必然失效，
# 但已下载过的包不用重新走网络，只装新增的那几个。
#
# store-dir 用命令行参数而不是 `pnpm config set`：后者会往镜像里写一份
# 全局配置，而这个路径只在构建期的 cache mount 里存在，留在镜像里是误导。
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

COPY . .

# build 脚本是 `tsc -b && vite build`，类型检查不过就不会产出 dist，
# 等于构建期就把类型错误挡在部署之外
RUN pnpm build

# ── 导出阶段 ────────────────────────────────────────────────────────
#  scratch 是完全空的镜像，导出时只会得到 dist 里的内容，
#  不会混进 node_modules 或任何基础镜像的文件。
#
#  本次部署用的是下面的 runtime 阶段（前端要占一个独立端口，所以跑容器）。
#  这个阶段保留着，方便将来改回「宿主 nginx 直接托管静态文件」的方案：
#    docker build --target export --output type=local,dest=./dist-out .
FROM scratch AS export
COPY --from=builder /app/dist /

# ── 运行阶段 ────────────────────────────────────────────────────────
#  容器内 nginx 托管静态文件 + 把 /api 转给后端容器，监听 8080。
#  TLS / 域名 / 证书全在宿主机 nginx 那一层，这里是纯 HTTP。
FROM nginx:1.27-alpine AS runtime

# 官方镜像自带的 default.conf 会占住 80 端口的 server 块，必须先删掉，
# 否则两个 server 块的 server_name 都是 _，请求会落到先解析到的那个
RUN rm -f /etc/nginx/conf.d/default.conf

COPY deploy/nginx.conf /etc/nginx/conf.d/beauty.conf
COPY --from=builder /app/dist /usr/share/nginx/html

ENV TZ=Asia/Shanghai
EXPOSE 8080

# wget 是 alpine 自带的（BusyBox 内置），不用额外装包。
# 探 /healthz 而不是 / —— 后者在 SPA fallback 下几乎永远返回 200，
# 区分不出 nginx 是否真的在正常工作。
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
