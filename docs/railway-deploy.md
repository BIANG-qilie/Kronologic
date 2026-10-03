# Railway 部署：灯序 / Kronologic

## 前提

- 仓库：https://github.com/BIANG-qilie/Kronologic
- 栈：Next.js **standalone** + **Dockerfile**（`railway.toml` 指定 `DOCKERFILE`，不再依赖 Nixpacks）
- 房间：进程内内存 → **Replicas = 1**
- 账号 / 战绩 / 成就：可选的 Railway Postgres（`DATABASE_URL`）；不配置时账号入口隐藏，游客照常玩

## 添加 Postgres（账号、战绩与成就）

1. 打开 Railway 项目画布，点右上角 **+ Create**（或画布空白处右键）→ **Database** → **Add PostgreSQL**。等它变成 Active（服务名默认 `Postgres`）。
2. 点 **kronologic** 服务 → **Variables** → **+ New Variable**：
   - Name：`DATABASE_URL`
   - Value：`${{Postgres.DATABASE_URL}}`（输入 `${{` 会出现自动补全；若数据库服务改过名，把 `Postgres` 换成实际服务名）
   - 也可以用 **Add Reference** → 选 Postgres → `DATABASE_URL`，效果相同。
3. 点 **Deploy** / **Apply changes** 让 kronologic 重新部署（变量改动不会自动生效）。
4. 看 Deploy 日志，应出现：

   ```text
   accounts: database ready, migrations applied
   ```

   表（`users`、`sessions`、`game_records`、`achievements`）由镜像里的 `drizzle/` 迁移在启动时自动创建，无需手动执行 SQL；之后新增的迁移也会在下次启动时补上。
5. 打开公开域名：右上角出现「登录」即为生效。注册一个账号，打完一局，结算页会显示「首次通关」或「最佳 X 问」，右上角菜单 →「我的战绩」可看档案。

说明：

- `${{Postgres.DATABASE_URL}}` 走 Railway 私网（`postgres.railway.internal`），不需要 SSL，也不占公网流量；不要填 `DATABASE_PUBLIC_URL`。
- 数据库连不上时，健康检查和游戏不受影响；日志会打印 `accounts: database unavailable`，登录会提示「账号服务暂时连不上」。
- 账号会话存在数据库里，重启 / 重新部署不会让玩家掉线；房间仍在内存里，重新部署会清空进行中的房间。
- 限流（登录失败、注册次数）在进程内存里，配合 Replicas=1 使用。

## 本轮硬修复（`[::]` Ready 后仍 502 → 改回 IPv4）

进程日志已出现 `Network: http://[::]:8080` 且 `✓ Ready`，但公网与 `/api/health` 仍 **502 Application failed to respond**。判断：Alpine/Docker 上 bind `::` 常带 `IPV6_V6ONLY=1`，只收 IPv6；Railway 边缘常走容器 IPv4 → connection refused。

| 原因 | 处理 |
|------|------|
| Standalone 读 `HOSTNAME` 当成绑定地址；Docker 默认 `HOSTNAME=容器 ID` → Ready 但 connection refused | 镜像与 `railway.toml` 强制 `HOSTNAME=0.0.0.0`；`scripts/start.sh` 忽略容器 ID |
| Alpine `[::]` 仅 IPv6（`IPV6_V6ONLY=1`），边缘走 IPv4 | **强制 IPv4 `0.0.0.0`**，不要 `::` |
| 未走官方 standalone / 静态资源未拷进 standalone | `output: "standalone"` + `prepare-standalone.sh`；Dockerfile 拷贝 `.next/static` |
| Nixpacks 启动路径不稳定 | `builder = "DOCKERFILE"` |
| 健康检查打到慢页面 / 超时 | `healthcheckPath = "/api/health"` |
| 公开域名 **Target Port** 与进程 `PORT` 不一致（例如写死 3000，实际 8080） | Networking → 域名 → Target Port **必须留空（自动）** 或显式等于日志 `$PORT` |
| Replicas > 1 | 改回 **1** |

### 日志顺序说明

若 Deploy 日志里 `✓ Ready` 出现在 `Starting Container` **之前**，多为 UI 混入了上一轮运行日志，或视图按时间倒序。以**同一次 Deploy** 中、容器启动之后的 `Network: http://0.0.0.0:$PORT` 为准。

## 控制台操作

1. 将含本修复的分支同步到 GitHub `main`（见文末），Railway 已连该仓库则会自动部署；否则 **Redeploy**（必要时 **Clear build cache**）。
2. 服务设置：
   - **Root Directory**：留空
   - Builder：仓库 `railway.toml` 已设 Dockerfile；若控制台仍显示 Nixpacks，在 Settings → Build 选 Dockerfile / 清缓存后 Redeploy
   - **Start**：`node server.js`（standalone；由 `railway.toml` / Dockerfile `CMD`）
3. **Variables**：
   - `HOSTNAME=0.0.0.0`（`railway.toml` 已写；控制台可再确认；**不要**再设 `HOSTNAME=::`）
   - **不要**手动写死 `PORT`（让 Railway 注入）
   - 无需 `NIXPACKS_NODE_VERSION`（Dockerfile 已用 `node:20-alpine`）
4. **Settings → Scaling / Replicas = 1**
5. **Networking → Generate Domain**；编辑域名时 **Target Port 必须留空**（或显式等于日志中的 `$PORT`，常见为 8080）

## 如何确认部署正确

Deploy / HTTP 日志应类似：

```text
▲ Next.js …
- Local:         http://localhost:8080
- Network:       http://0.0.0.0:8080
✓ Ready
```

- 必须看到 **`0.0.0.0`**（不是容器 ID 主机名、不是仅 `127.0.0.1`、也不是仅 `[::]`）
- `curl` 公开域名 `/` 与 `/api/health` 应 **HTTP 200**，不再是 Application failed to respond / 502

## 若仍 502

1. 确认日志已是 `0.0.0.0:$PORT`（若仍是 `[::]`，说明未部署到本提交 / 控制台 Variables 仍写着 `HOSTNAME=::`）
2. **Settings → Networking**：截图或确认公开域名的 **Target Port**（须留空或等于 `$PORT`）
3. 边缘 HTTP 日志里贴该请求的 `upstreamErrors` / `connection refused` 细节
4. Redeploy 并 **Clear build cache**；Replicas=1

## Redeploy 步骤

1. 本机把修复分支推到 GitHub `main`（见下）
2. Railway → 服务 → **Redeploy**（必要时 **Clear build cache**）
3. 确认 Replicas=1、Target Port 留空、`HOSTNAME=0.0.0.0`
4. 打开公开域名验证 `/` 与 `/api/health`

## 为何必须单实例

`src/lib/server/rooms.ts` 把房间、令牌、笔记放在 Node 进程内存。多副本时创建/加入/SSE 会打到不同实例。只有对局结果（战绩、成就）和账号会话写进 Postgres。

## SSE

`/api/rooms/[code]/events` 使用 Node runtime + `text/event-stream`，并设置 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no`。

## 本地核对生产启动

```bash
npm install
npm run build
PORT=43218 HOSTNAME=0.0.0.0 npm run start
# 应打印 start.sh: HOSTNAME=0.0.0.0 PORT=43218
# 日志 Network: http://0.0.0.0:43218
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43218/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43218/api/health
# 可选：docker build -t kronologic . && docker run --rm -p 43218:8080 -e PORT=8080 -e HOSTNAME=0.0.0.0 kronologic
```

## 本机同步到 GitHub（无 token 时）

Origin 分支：`cursor/accounts-records-97f6`

```bash
git fetch origin
git checkout cursor/accounts-records-97f6
git push git@github.com:BIANG-qilie/Kronologic.git HEAD:main
# 若已配置 github remote：
# git push github HEAD:main
```

然后在 Railway **Redeploy**（必要时清 build cache）。
