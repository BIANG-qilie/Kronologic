# Railway 部署：灯序 / Kronologic

## 前提

- 仓库：https://github.com/BIANG-qilie/Kronologic
- 栈：Next.js **standalone** + **Dockerfile**（`railway.toml` 指定 `DOCKERFILE`，不再依赖 Nixpacks）
- 房间：进程内内存（无数据库）→ **Replicas = 1**

## 本轮硬修复（Ready 后仍 502）

IPv6 绑定已确认生效（日志出现 `Network: http://[::]:$PORT`）时，边缘仍可能 502。常见剩余原因：

| 原因 | 处理 |
|------|------|
| Standalone 读 `HOSTNAME` 当成绑定地址；Docker 默认 `HOSTNAME=容器 ID` → Ready 但 connection refused | 镜像与 `railway.toml` 强制 `HOSTNAME=::`；`scripts/start.sh` 忽略容器 ID |
| 未走官方 standalone / 静态资源未拷进 standalone | `output: "standalone"` + `prepare-standalone.sh`；Dockerfile 拷贝 `.next/static` |
| Nixpacks 启动路径不稳定 | `builder = "DOCKERFILE"` |
| 健康检查打到慢页面 / 超时 | `healthcheckPath = "/api/health"` |
| 公开域名 **Target Port** 与进程 `PORT` 不一致（例如写死 3000，实际 8080） | Networking → 域名 → Target Port **留空（自动）** 或与日志端口一致 |
| Replicas > 1 | 改回 **1** |

### 日志顺序说明

若 Deploy 日志里 `✓ Ready` 出现在 `Starting Container` **之前**，多为 UI 混入了上一轮运行日志，或视图按时间倒序。以**同一次 Deploy** 中、容器启动之后的 `start.sh: HOSTNAME=:: PORT=…` 与 `Network: http://[::]:$PORT` 为准。

## 控制台操作

1. 将含本修复的分支同步到 GitHub `main`（见文末），Railway 已连该仓库则会自动部署；否则 **Redeploy**。
2. 服务设置：
   - **Root Directory**：留空
   - Builder：仓库 `railway.toml` 已设 Dockerfile；若控制台仍显示 Nixpacks，在 Settings → Build 选 Dockerfile / 清缓存后 Redeploy
   - **Start**：`node server.js`（standalone；由 `railway.toml` / Dockerfile `CMD`）
3. **Variables**：
   - `HOSTNAME=::`（`railway.toml` 已写；控制台可再确认）
   - **不要**手动写死 `PORT`（让 Railway 注入）
   - 无需 `NIXPACKS_NODE_VERSION`（Dockerfile 已用 `node:20-alpine`）
4. **Settings → Scaling / Replicas = 1**
5. **Networking → Generate Domain**；编辑域名时 **Target Port 留空**（或与日志中的 `$PORT` 一致，常见为 8080）

## 如何确认部署正确

Deploy / HTTP 日志应类似：

```text
start.sh: HOSTNAME=:: PORT=8080
# 或 Dockerfile 直接 node server.js 时：
▲ Next.js …
- Network: http://[::]:8080
✓ Ready
```

- 必须看到 **`[::]`**（或至少不是容器 ID 主机名、不是仅 `127.0.0.1`）
- `curl` 公开域名 `/` 与 `/api/health` 应 **HTTP 200**，不再是 Application failed to respond / 502
- 若日志仍是 `0.0.0.0` 且无 `[::]`：说明跑的还是旧镜像/旧提交，先同步 GitHub `main` 再 Redeploy，不要继续改游戏代码

## Redeploy 步骤

1. 本机把修复分支推到 GitHub `main`（见下）
2. Railway → 服务 → **Redeploy**（必要时 **Clear build cache**）
3. 确认 Replicas=1、Target Port 自动、`HOSTNAME=::`
4. 打开公开域名验证 `/` 与 `/api/health`

## 为何必须单实例

`src/lib/server/rooms.ts` 把房间、令牌、笔记放在 Node 进程内存。多副本时创建/加入/SSE 会打到不同实例。

## SSE

`/api/rooms/[code]/events` 使用 Node runtime + `text/event-stream`，并设置 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no`。

## 本地核对生产启动

```bash
npm install
npm run build
PORT=43218 npm run start
# 应打印 start.sh: HOSTNAME=:: PORT=43218
# 日志 Network: http://[::]:43218
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43218/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43218/api/health
# 可选：docker build -t kronologic . && docker run --rm -p 43218:8080 -e PORT=8080 kronologic
```

## 本机同步到 GitHub（无 token 时）

Origin 分支：`cursor/railway-standalone-hardfix-02f4`

```bash
git fetch origin
git checkout cursor/railway-standalone-hardfix-02f4
git push git@github.com:BIANG-qilie/Kronologic.git HEAD:main
# 若已配置 github remote：
# git push github HEAD:main
```

然后在 Railway **Redeploy**。
