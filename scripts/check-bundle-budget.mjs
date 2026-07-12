import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGzip } from "node:zlib";

const root = process.cwd();
const publicDir = path.join(root, "dist/public");
const manifestPath = path.join(publicDir, ".vite/manifest.json");
const resultDir = path.join(root, "quality-results/bundle");
const resultPath = path.join(resultDir, "summary.json");
const baselinePath = path.join(root, "quality/bundle-budget.json");
const mode = process.argv[2] ?? "--report";

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry => {
      const target = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(target) : [target];
    })
  );
  return nested.flat();
}

async function gzipSize(file) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    createReadStream(file)
      .pipe(createGzip({ level: 9 }))
      .on("data", chunk => {
        bytes += chunk.length;
      })
      .on("end", () => resolve(bytes))
      .on("error", reject);
  });
}

async function fileMetric(file) {
  const relative = path.relative(publicDir, file).replaceAll("\\", "/");
  return {
    file: relative,
    raw: (await stat(file)).size,
    gzip: await gzipSize(file),
  };
}

function sum(metrics) {
  return metrics.reduce(
    (total, metric) => ({
      raw: total.raw + metric.raw,
      gzip: total.gzip + metric.gzip,
    }),
    { raw: 0, gzip: 0 }
  );
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} KiB`;
}

await readFile(manifestPath, "utf8").catch(() => {
  throw new Error("Vite manifest not found. Run pnpm build before bundle checks.");
});
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = await listFiles(publicDir);
const js = await Promise.all(
  files.filter(file => file.endsWith(".js")).map(fileMetric)
);
const css = await Promise.all(
  files.filter(file => file.endsWith(".css")).map(fileMetric)
);
const entryNames = new Set(
  Object.values(manifest)
    .filter(item => item.isEntry)
    .map(item => item.file)
);
const entryJsFiles = js.filter(item => entryNames.has(item.file));
const largestJsChunk = [...js].sort((a, b) => b.gzip - a.gzip)[0];
const summary = {
  version: 1,
  measuredAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  entryJs: sum(entryJsFiles),
  largestJsChunk,
  totalJs: sum(js),
  totalCss: sum(css),
  jsFileCount: js.length,
  cssFileCount: css.length,
  largestChunks: [...js].sort((a, b) => b.gzip - a.gzip).slice(0, 10),
};

await mkdir(resultDir, { recursive: true });
await writeFile(resultPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

if (mode === "--write-baseline") {
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(
    baselinePath,
    JSON.stringify(
      {
        version: 1,
        baseSha: execFileSync("git", ["rev-parse", "origin/main"], {
          encoding: "utf8",
        }).trim(),
        measuredAt: summary.measuredAt,
        budgets: {
          relativeIncrease: 0.05,
          entryJsGzipAbsoluteIncrease: 51200,
          largestJsChunkGzipAbsoluteIncrease: 51200,
          totalJsGzipAbsoluteIncrease: 102400,
          totalCssGzipAbsoluteIncrease: 20480,
        },
        metrics: {
          entryJs: summary.entryJs,
          largestJsChunk: summary.largestJsChunk,
          totalJs: summary.totalJs,
          totalCss: summary.totalCss,
        },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`Wrote bundle baseline from ${summary.jsFileCount} JS files`);
}

if (mode === "--check") {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const checks = [
    ["entry JS gzip", summary.entryJs.gzip, baseline.metrics.entryJs.gzip, baseline.budgets.entryJsGzipAbsoluteIncrease],
    ["largest JS chunk gzip", summary.largestJsChunk.gzip, baseline.metrics.largestJsChunk.gzip, baseline.budgets.largestJsChunkGzipAbsoluteIncrease],
    ["total JS gzip", summary.totalJs.gzip, baseline.metrics.totalJs.gzip, baseline.budgets.totalJsGzipAbsoluteIncrease],
    ["total CSS gzip", summary.totalCss.gzip, baseline.metrics.totalCss.gzip, baseline.budgets.totalCssGzipAbsoluteIncrease],
  ];
  const failures = [];
  for (const [label, current, reference, absoluteAllowance] of checks) {
    const relativeLimit = Math.ceil(reference * (1 + baseline.budgets.relativeIncrease));
    const absoluteLimit = reference + absoluteAllowance;
    const limit = Math.min(relativeLimit, absoluteLimit);
    const status = current <= limit ? "PASS" : "FAIL";
    console.log(`${status} ${label}: ${formatBytes(current)} / ${formatBytes(limit)} (baseline ${formatBytes(reference)})`);
    if (status === "FAIL") failures.push(label);
  }
  if (failures.length > 0) {
    throw new Error(`Bundle budget exceeded: ${failures.join(", ")}`);
  }
}

console.log(
  `Bundle: entry ${formatBytes(summary.entryJs.raw)} raw / ${formatBytes(summary.entryJs.gzip)} gzip; ` +
    `largest ${formatBytes(summary.largestJsChunk.raw)} raw / ${formatBytes(summary.largestJsChunk.gzip)} gzip; ` +
    `total JS ${formatBytes(summary.totalJs.raw)} raw / ${formatBytes(summary.totalJs.gzip)} gzip; ` +
    `CSS ${formatBytes(summary.totalCss.raw)} raw / ${formatBytes(summary.totalCss.gzip)} gzip`
);
