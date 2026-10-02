import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scenarioDir = join(root, "src/data/scenarios");

const require = createRequire(import.meta.url);

async function loadSolver() {
  // Compile-free: run via tsx when invoked as `tsx scripts/validate-scenario.mjs`
  // or dynamically import the TS module through tsx register.
  const solverUrl = pathToFileURL(join(root, "src/lib/game/solver.ts")).href;
  return import(solverUrl);
}

function validateTrajectory(bundle) {
  const errors = [];
  const TIMES = [1, 2, 3, 4, 5, 6];
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
        const open = bundle.public.opening[person];
        if (open && open !== place) {
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
  if (!bundle.sealed.rule) errors.push("缺 sealed.rule");
  return errors;
}

async function main() {
  const files = readdirSync(scenarioDir).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    console.error("未找到剧本");
    process.exit(1);
  }

  const { validateWithSolver } = await loadSolver();
  let failed = false;

  for (const file of files) {
    const bundle = JSON.parse(readFileSync(join(scenarioDir, file), "utf8"));
    const id = bundle.public?.id ?? file;
    const trajErrors = validateTrajectory(bundle);
    if (trajErrors.length) {
      failed = true;
      console.error(`FAIL ${id} 轨迹:\n${trajErrors.join("\n")}`);
      continue;
    }
    const report = validateWithSolver(bundle);
    console.log(
      `== ${id} ==\n` +
        `开场候选数: ${report.openingAnswerCount}\n` +
        `全信息候选数: ${report.fullInfoAnswerCount}\n` +
        `贪心步数: ${report.greedySteps}\n` +
        `阈值: gold≤${report.goldMax} silver≤${report.silverMax}\n` +
        `单题最少剩余候选: ${report.singleQueryMaxLock}\n` +
        (report.ok ? "OK\n" : `FAIL\n${report.errors.join("\n")}\n`)
    );
    if (!report.ok) failed = true;
  }

  if (failed) process.exit(1);
  console.log(`全部 ${files.length} 个剧本校验通过`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
