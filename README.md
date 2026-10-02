# 灯序 / Kronologic

线上多人时间推理。六时、六地、六人；绿窗共享，白窗独见。

## 本地运行

```bash
npm install
npm test
npm run validate:scenario
npm run generate:bank       # 重生成夜茶题库（可选）
npm run dev                 # http://127.0.0.1:4317
npm run build && npm run start   # 生产模式；默认端口 4317，可用 PORT=xxxx 覆盖
```

## 怎么玩

1. 大厅输入昵称，创建房间或加入六位房间码。调查《夜茶的毒》，按提问数选难度。
2. 房主开始调查。
3. 轮流问地点×时间或地点×人物。
4. 交卷进入 12 秒同时窗；全对揭示，答错淘汰。
5. 本机令牌可重连；笔记仅本人可读。

## Railway 部署

详细步骤见 [docs/railway-deploy.md](docs/railway-deploy.md)。

### 一键部署要点

1. 在 [Railway](https://railway.app) 用 GitHub 连接本仓库（`BIANG-qilie/Kronologic`），New Project → Deploy from GitHub。
2. Root Directory：仓库根（留空即可）。
3. Build：`npm run build`（`railway.toml` / Nixpacks 已配置）。
4. Start：`npm run start`（监听 `0.0.0.0:$PORT`）。
5. **环境变量：无需额外配置**（Railway 会注入 `PORT`）。
6. **Replicas / 实例数设为 1**：房间状态在进程内存（`src/lib/server/rooms.ts`），多实例或重启会丢房间、玩家可能连到不同副本。

生成 Public Domain 后即可从浏览器打开游玩。

## 题库

`src/data/case-bank/night-tea-bank.json`：同案情换轨迹与开场，难度按贪心最少提问数分档。
