// Builds the static site for GitHub Pages and publishes it to the gh-pages branch.
// Run with `npm run deploy`. GitHub Pages serves that branch at /<repository name>/.
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const run = (command, options = {}) => execSync(command, { stdio: "inherit", ...options });
const read = (command) => execSync(command, { encoding: "utf8" }).trim();

const remote = read("git remote get-url origin");
const commit = read("git rev-parse --short HEAD");
const basePath = `/${basename(remote).replace(/\.git$/, "")}`;

// Nothing is published unless the code is sound.
console.log("Checking types, lint and tests ...");
run("npx tsc --noEmit");
run("npx eslint .");
run("npx vitest run");

console.log(`Building ${commit} for ${basePath} ...`);
run("npm run build", { env: { ...process.env, PAGES_BASE_PATH: basePath } });

// A throwaway repository holding only the built files, pushed over the gh-pages branch.
const staging = mkdtempSync(join(tmpdir(), "clackwork-pages-"));
try {
  cpSync("out", staging, { recursive: true });
  // Without this, Pages would skip folders that start with an underscore (such as _next).
  writeFileSync(join(staging, ".nojekyll"), "");
  const git = (args) => run(`git ${args}`, { cwd: staging });
  git("init -q -b gh-pages");
  git("add -A");
  git(`-c user.name="${read("git config user.name")}" -c user.email="${read("git config user.email")}" commit -q -m "Publish build of ${commit}"`);
  git(`push -f "${remote}" gh-pages`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log("Published. The live site updates in about a minute.");
