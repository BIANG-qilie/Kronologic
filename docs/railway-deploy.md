# Railway 部署：灯序 / Kronologic

## 前提

- 仓库：https://github.com/BIANG-qilie/Kronologic
- 栈：Next.js（Nixpacks 可直接构建，无需 Dockerfile）
- 房间：进程内内存（无数据库）

## 控制台操作

1. 打开 [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo** → 选 `BIANG-qilie/Kronologic`（或你 fork 的副本）。
2. 服务设置：
   - **Root Directory**：留空（仓库根）
   - **Build Command**：`npm run build`（`railway.toml` 已写；一般不用改）
   - **Start Command**：`npm run start`（经 `scripts/start.sh` 绑定 `::` 与 `$PORT`；勿绑 `127.0.0.1` 或仅 `0.0.0.0`）
3. **Variables**：无需在控制台手动加 `NIXPACKS_NODE_VERSION`。仓库已通过 `railway.toml` / `package.json` engines / `.nvmrc` 钉死 Node 20（Next.js 要求 ≥20.9）。Railway 注入 `PORT` 即可。
4. **Settings → Scaling / Replicas**：设为 **1**。
5. **Networking → Generate Domain**：生成公开 HTTPS 域名。

Redeploy 前确认 GitHub `main` 已含 IPv6 双栈修复（`scripts/start.sh`：`--hostname ::` + `$PORT`）；Replicas 保持为 1。日志应出现 `Network: http://[::]:$PORT`（或等价）。若仍 502，可在 Variables 加 `HOSTNAME=::` 再 Redeploy。

若构建日志仍出现 Node 18，在服务 Variables 里临时加 `NIXPACKS_NODE_VERSION=20` 后 Redeploy。

## 为何必须单实例

`src/lib/server/rooms.ts` 把房间、令牌、笔记放在 Node 进程内存。多副本时：

- 创建房间与加入可能打到不同实例 →「房间不存在」
- SSE 订阅与写操作可能不同步
- 部署/重启会清空所有进行中的房间

需要水平扩展时再引入外部存储；当前部署刻意不加数据库。

## SSE

`/api/rooms/[code]/events` 使用 Node runtime + `text/event-stream`，并设置 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no`，减少反代缓冲。

## 本地核对生产启动

```bash
npm install
npm run build
PORT=43218 npm run start
# 应监听 [::]:43218（双栈）；浏览器打开 http://127.0.0.1:43218
```
