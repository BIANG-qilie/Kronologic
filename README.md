# 灯序

线上多人时间推理。六时、六地、六人；绿窗共享，白窗独见。

## 本地运行

```bash
npm install
npm test
npm run validate:scenario
npm run generate:bank       # 重生成夜茶题库（可选）
npm run dev                 # http://127.0.0.1:4317
```

## 怎么玩

1. 大厅输入昵称，创建房间或加入六位房间码。调查《夜茶的毒》，按提问数选难度。
2. 房主开始调查。
3. 轮流问地点×时间或地点×人物。
4. 交卷进入 12 秒同时窗；全对揭示，答错淘汰。
5. 本机令牌可重连；笔记仅本人可读。

## 题库

`src/data/case-bank/night-tea-bank.json`：同案情换轨迹与开场，难度按贪心最少提问数分档。调研见 Agent Store `docs/case-generation-research.md`。
