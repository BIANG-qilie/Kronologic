import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const scenariosUrl = pathToFileURL(
    join(root, "src/lib/game/scenarios.ts")
  ).href;
  const { listScenariosPublic, getScenarioBundle, listCaseBankMeta } =
    await import(scenariosUrl);
  const { validateWithSolver } = await import(
    pathToFileURL(join(root, "src/lib/game/solver.ts")).href
  );
  const { validateTrajectory } = await import(
    pathToFileURL(join(root, "src/lib/game/validate.ts")).href
  );

  const meta = listCaseBankMeta();
  console.log(
    `题库 ${meta.family} · ${meta.selection} · ${meta.total} 题 · 档位 ${meta.tiers.join(",")}`
  );

  let failed = false;
  const publics = listScenariosPublic();
  for (const pub of publics) {
    const bundle = getScenarioBundle(pub.id);
    if (!bundle) {
      console.error(`FAIL 缺 bundle ${pub.id}`);
      failed = true;
      continue;
    }
    const trajErrors = validateTrajectory(bundle.public, bundle.sealed);
    if (trajErrors.length) {
      failed = true;
      console.error(`FAIL ${pub.id} 轨迹:\n${trajErrors.join("\n")}`);
      continue;
    }
    const report = validateWithSolver(bundle);
    console.log(
      `== ${pub.id} ==\n` +
        `种子: ${pub.seed ?? "-"}\n` +
        `开场候选数: ${report.openingAnswerCount}\n` +
        `全信息候选数: ${report.fullInfoAnswerCount}\n` +
        `贪心步数: ${report.greedySteps}\n` +
        `阈值: gold≤${report.goldMax} silver≤${report.silverMax}\n` +
        (report.ok ? "OK\n" : `FAIL\n${report.errors.join("\n")}\n`)
    );
    if (!report.ok) failed = true;
    if (pub.greedyMin != null && report.greedySteps !== pub.greedyMin) {
      console.error(
        `FAIL ${pub.id} greedyMin 元数据 ${pub.greedyMin} ≠ 实测 ${report.greedySteps}`
      );
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log(`全部 ${publics.length} 个剧本校验通过`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
