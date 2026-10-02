# 灯序 / Kronologic

线上多人时间推理。六时、六地、六人；绿窗共享，白窗独见。

## 本地运行

```bash
npm install
npm test
npm run validate:scenario
npm run generate:bank       # 重生成夜茶题库（可选）
npm run dev                 # http://127.0.0.1:4317
npm run build && PORT=43218 HOSTNAME=0.0.0.0 npm run start   # standalone；强制 IPv4；PORT 默认 3000
```

## 怎么玩

1. 大厅输入昵称，创建房间或加入六位房间码。调查《夜茶的毒》，按提问数选难度。
2. 房主开始调查。
3. 轮流问地点×时间或地点×人物。
4. 交卷进入 12 秒同时窗；全对揭示，答错淘汰。
5. 本机令牌可重连；笔记仅本人可读。

## Railway 部署

详细步骤见 [docs/railway-deploy.md](docs/railway-deploy.md)。

生产镜像走 **Dockerfile + standalone**，强制 `HOSTNAME=0.0.0.0`（Alpine `[::]` 常仅 IPv6，边缘走 IPv4 会 502）。Replicas=1。公开域名 Target Port **必须留空**或与日志 `$PORT` 一致。

### 一键部署要点

1. 在 [Railway](https://railway.app) 用 GitHub 连接本仓库（`BIANG-qilie/Kronologic`），New Project → Deploy from GitHub。
2. Root Directory：仓库根（留空即可）。
3. Build：Dockerfile（`railway.toml` → `DOCKERFILE`）；镜像内 `npm run build`（含 standalone 资源拷贝）。
4. Start：`node server.js`（standalone；`HOSTNAME=0.0.0.0` + Railway 注入的 `PORT`）。
5. **环境变量**：`HOSTNAME=0.0.0.0`（`railway.toml` 已写；**不要**再设 `::`）。**不要**手动写死 `PORT`。
6. **Replicas = 1**：房间在进程内存（`src/lib/server/rooms.ts`）。
7. Networking：Generate Domain；Target Port **必须留空（自动）** 或显式等于 `$PORT`。

生成 Public Domain 后打开 `/` 与 `/api/health` 应返回 200。

## 题库

`src/data/case-bank/night-tea-bank.json`：同案情换轨迹与开场，难度按贪心最少提问数分档。
