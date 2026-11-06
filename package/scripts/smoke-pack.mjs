import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "mse-package-smoke-"));
function run(args, cwd = root) {
  const p = spawnSync("npm", args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (p.status !== 0) throw Error("npm " + args.join(" ") + " failed: " + p.stderr + p.stdout);
  return p.stdout;
}
try {
  // Release-workflow mode: when AGORAIL_SMOKE_TARBALL names an
  // already-packed artifact, smoke-test THAT exact tarball and
  // never pack a second one — the bytes tested must be the bytes
  // that can be published. Standalone local runs keep the
  // original self-pack behavior.
  const prepacked = process.env.AGORAIL_SMOKE_TARBALL;
  let filename, paths, tarballPath;
  if (prepacked) {
    tarballPath = resolve(prepacked);
    filename = tarballPath.split("/").pop();
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" });
    paths = out.split("\n").filter(Boolean).map(p => p.replace(/^package\//, ""));
  } else {
    const info = JSON.parse(run(["pack", "--json", "--pack-destination", temp]));
    if (info.length !== 1) throw Error("npm pack must produce exactly one artifact");
    filename = info[0].filename;
    paths = info[0].files.map(f => f.path);
    tarballPath = join(temp, filename);
  }
  for (const needed of ["package.json", "README.md", "LICENSE", "schema/mse-core.schema.json", "dist/src/index.js", "dist/src/index.d.ts"]) {
    if (!paths.includes(needed)) throw Error("Published artifact missing " + needed);
  }
  for (const p of paths) {
    if (/^(test|examples|docs|spec|node_modules|scripts)\/|\.env|\.npmrc|\.pem$/.test(p)) throw Error("Disallowed file in package: " + p);
  }
  const bytes = readFileSync(tarballPath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const consumer = join(temp, "consumer");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), '{"name":"mse-external-consumer","private":true,"type":"module"}');
  run(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], consumer);
  const script = `
    const pkg = await import("@agorail-labs/mse-reference");
    for(const symbol of ["evaluateAdmissionOnly","ReferenceProvider","assertAdmissionReportWellFormed","deriveSatisfactionRealization"]) {
      if (typeof pkg[symbol] !== "function") throw Error("Missing runtime export " + symbol);
    }
    console.log("PASS MSE clean-room external ESM import");
  `;
  const x = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: consumer, encoding: "utf8" });
  if (x.status !== 0) throw Error("External npm install/import failed: " + x.stderr + x.stdout);
  console.log(x.stdout.trim());
  console.log(JSON.stringify({ filename, sha256: sha, bytes: bytes.length, files: paths.length }));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
