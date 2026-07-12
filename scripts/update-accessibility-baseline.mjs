import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportDir = path.resolve("quality-results/accessibility");
const baselinePath = path.resolve("quality/accessibility-baseline.json");
const files = (await readdir(reportDir)).filter(file => file.endsWith(".json"));

if (files.length === 0) {
  throw new Error("No accessibility reports were produced");
}

const scenarios = {};
for (const file of files.sort()) {
  const report = JSON.parse(await readFile(path.join(reportDir, file), "utf8"));
  scenarios[`${report.project}:${report.scenario}`] = report.blocking;
}

async function resolveBaseSha() {
  if (process.env.ACCESSIBILITY_BASELINE_SHA) {
    return process.env.ACCESSIBILITY_BASELINE_SHA;
  }

  if (process.env.GITHUB_EVENT_PATH) {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
    if (event.pull_request?.base?.sha) return event.pull_request.base.sha;
    if (event.before) return event.before;
  }

  try {
    return execFileSync("git", ["rev-parse", "origin/main"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  }
}

await mkdir(path.dirname(baselinePath), { recursive: true });
await writeFile(
  baselinePath,
  JSON.stringify(
    {
      version: 1,
      baseSha: await resolveBaseSha(),
      measuredAt: new Date().toISOString(),
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      blockingImpacts: ["critical", "serious"],
      scenarios,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(`Wrote ${Object.keys(scenarios).length} accessibility baselines`);
