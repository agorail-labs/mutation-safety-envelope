import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(packageRoot, "..");
const run = spawnSync("npm", ["run", "build"], { cwd: repo, encoding: "utf8", shell: process.platform === "win32" });
if (run.status !== 0) throw Error("MSE root TypeScript build failed; refusing to pack: " + run.stderr + run.stdout);

const source = join(repo, "dist", "src");
if (!existsSync(join(source, "index.js"))) throw Error("MSE package entrypoint missing from build output");
const target = join(packageRoot, "dist", "src");
rmSync(join(packageRoot, "dist"), { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });

// The root research tsconfig uses ES2022/bundler resolution with extensionless
// specifiers. Shipped Node ESM JS MUST have explicit .js extensions.
// Rewrite only literal relative import/export specifiers; leave package imports
// and absolute URLs alone. Apply the same rewrite to declarations.
function patch(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { patch(path); continue; }
    if (!/\.(js|d\.ts)$/.test(entry.name)) continue;
    const before = readFileSync(path, "utf8");
    const after = before.replace(/(\b(?:from\s*|import\s*\(|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
      (_m, prefix, spec, suffix) =>
        /\.(js|json|mjs|cjs|node)$/.test(spec)
          ? prefix + spec + suffix
          : prefix + spec + ".js" + suffix);
    writeFileSync(path, after);
  }
}
patch(target);
mkdirSync(join(packageRoot, "schema"), { recursive: true });
cpSync(join(repo, "schema", "mse-core.schema.json"), join(packageRoot, "schema", "mse-core.schema.json"));
cpSync(join(repo, "LICENSE"), join(packageRoot, "LICENSE"));
// Keep stdout clean: npm pack --json consumers must see JSON, not lifecycle messages.
