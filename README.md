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

### 账号、战绩与成就（可选）

不设 `DATABASE_URL` 时，账号入口自动隐藏，游客照常玩，不会报错。要在本地试账号功能，起一个 Postgres 再带上连接串：

```bash
docker run -d --name kr-pg -e POSTGRES_PASSWORD=kr -p 5432:5432 postgres:16
DATABASE_URL=postgres://postgres:kr@127.0.0.1:5432/postgres npm run dev
```

- 服务启动时自动执行 `drizzle/` 里的迁移（`src/instrumentation.ts`），无需手动建表。
- 改了 `src/lib/server/db/schema.ts` 后运行 `npm run db:generate` 生成新迁移并提交。
- `npm test` 默认用进程内的 PGlite 跑集成测试；设 `TEST_DATABASE_URL`（需有建库权限）则改用真实 Postgres，每个测试文件各建一个临时库。
- 用户名 2–16 位（中英文、数字、下划线，不区分大小写），密码至少 8 位，scrypt 加盐哈希；会话是 30 天的 `httpOnly` cookie。没有找回密码。
- 成就定义在 `src/lib/game/achievements.ts`。

## 怎么玩

1. 大厅输入昵称，创建房间或加入六位房间码。调查《夜茶的毒》，按提问数选难度。
2. 房主开始调查。
3. 轮流问地点×时间或地点×人物。
4. 交卷进入 12 秒同时窗；全对揭示，答错淘汰。
5. 本机令牌可重连；笔记仅本人可读。
6. 登录后（需配置数据库），每局结束会记下战绩、首次通关和成就，右上角「我的战绩」查看。

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
8. 账号功能（可选）：同一项目里加一个 Postgres 服务，在 kronologic 服务的 Variables 里添加 `DATABASE_URL=${{Postgres.DATABASE_URL}}`，重新部署即可；迁移在启动时自动跑。

生成 Public Domain 后打开 `/` 与 `/api/health` 应返回 200。

## 题库

`src/data/case-bank/night-tea-bank.json`：同案情换轨迹与开场，难度按贪心最少提问数分档。
