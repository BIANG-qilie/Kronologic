/** Player-facing playbill. Dates are Asia/Shanghai author dates from git history. Newest first. */

const NOTES: { date: string; title: string; body: string }[] = [
  {
    date: "10月22日",
    title: "灯还是那两盏",
    body: "绿的改称公开信息，亮给全场；米白的改称私有信息，只亮给提问的人。私有信息若是空的，这一问不计次。",
  },
  {
    date: "10月22日",
    title: "两张榜，一张票",
    body: "关卡榜与探案榜收进同一张戏票。页眉换场，分关、总榜、入座人数都还在。",
  },
  {
    date: "10月20日",
    title: "可以抽一出戏",
    body: "首页添了探案：随机案件、随机地图，老虎机开场。榜上先看胜率，再看平均公开信息、问数、平均私有信息，局数多的排在后面。",
  },
  {
    date: "10月20日",
    title: "战绩多留两笔",
    body: "探案和自定义关卡打完，都会出现在「我的战绩」里。自定义仍不进榜，也不算首通。",
  },
  {
    date: "10月20日",
    title: "桌面改成地图",
    body: "房间之间的门画成连线。悬停只亮走得出去的那几扇，可停留的房间单独标出。散场后可以回首页，也可以再探一案。",
  },
  {
    date: "10月19日",
    title: "自己排一晚",
    body: "自定义关卡可以改地点多少、单向通道、能不能停留、难度和种子。同一套设置，能再开一局《夜茶的毒》。",
  },
  {
    date: "10月13日",
    title: "通道与案情",
    body: "随机地图铺在多边形上，通道是弧线，单向的门有箭头。对局里随时能翻开今晚的案情。",
  },
  {
    date: "10月11日",
    title: "挂出排行榜",
    body: "第 1 到 15 关各一张榜，另有总榜，按人数分开，只记第一次通关。人多的局，还要比公开信息和你自己的私有信息，越少越前。",
  },
  {
    date: "10月4日",
    title: "序幕",
    body: "三时、三地、三人。问一次、记一笔、交一次卷。走完，成就里会多一枚「开场白」。",
  },
  {
    date: "10月4日",
    title: "可以留名",
    body: "登录之后，散场会记下战绩、首通和成就，右上角能翻。不登录，凭房间码照常入座。",
  },
  {
    date: "10月2日",
    title: "幕落见答案",
    body: "交卷后的那一页写出谁、何时、何地，并回放整晚的走位。现在上演的仍是《夜茶的毒》：散场后，指挥缪舟喝下了一杯毒茶。",
  },
];

export function ReleaseNotes() {
  return (
    <section
      id="updates"
      aria-labelledby="updates-title"
      className="scroll-mt-6 border-t border-ink-faint/60 py-14 md:py-20"
    >
      <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">戏单注记</p>
      <h2 id="updates-title" className="mt-2 font-display text-3xl text-[var(--ink)]">
        版本更新
      </h2>
      <ol className="ticket-edge parchment-wash relative mt-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
        {NOTES.map((note) => (
          <li
            key={`${note.date}-${note.title}`}
            className="grid gap-1 border-b border-dashed border-ink-faint/70 px-5 py-5 last:border-b-0 sm:grid-cols-[6.5rem_1fr] sm:items-baseline sm:gap-6 sm:px-8 sm:py-6"
          >
            <p className="font-mono text-xs tracking-[0.12em] text-[var(--amber)]">{note.date}</p>
            <div>
              <h3 className="font-display text-xl text-[var(--ink)]">{note.title}</h3>
              <p className="mt-1.5 max-w-2xl text-sm leading-[1.9] text-[var(--ink-muted)]">{note.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
