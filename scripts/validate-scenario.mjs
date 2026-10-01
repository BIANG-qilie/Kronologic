import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundle = JSON.parse(
  readFileSync(
    join(__dirname, "../src/data/scenarios/harbor-missing-score.json"),
    "utf8"
  )
);

const TIMES = [1, 2, 3, 4, 5, 6];
const errors = [];
const placeIds = new Set(bundle.public.places.map((p) => p.id));
const adj = bundle.public.adjacency;

for (const person of bundle.public.people.map((p) => p.id)) {
  const path = bundle.sealed.trajectory[person];
  if (!path) {
    errors.push(`缺少 ${person}`);
    continue;
  }
  for (const t of TIMES) {
    const place = path[String(t)];
    if (!place || !placeIds.has(place)) {
      errors.push(`${person}@${t} 非法`);
      continue;
    }
    if (t === 1) {
      if (bundle.public.opening[person] !== place) {
        errors.push(`${person} 开场不一致`);
      }
    } else {
      const prev = path[String(t - 1)];
      if (prev === place) errors.push(`${person} ${t - 1}→${t} 停留`);
      else if (!adj[prev]?.includes(place)) {
        errors.push(`${person} ${t - 1}→${t} 不相邻 ${prev}→${place}`);
      }
    }
  }
}
for (const q of bundle.public.winQuestions) {
  if (!(q.id in bundle.sealed.answers)) errors.push(`缺答案 ${q.id}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("OK: harbor-missing-score 校验通过");
