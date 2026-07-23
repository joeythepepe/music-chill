#!/usr/bin/env node
/**
 * Snapshot git work log → src/lib/devlog.json for the in-app Dev Log tree.
 * Runs on predev / prebuild so local + Vercel builds stay current.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/lib/devlog.json");

function readGitLog() {
  try {
    const raw = execFileSync(
      "git",
      ["log", "--pretty=format:%H%x09%h%x09%ad%x09%s", "--date=short"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    if (!raw) return [];
    return raw.split("\n").map((line) => {
      const [fullHash, hash, date, ...rest] = line.split("\t");
      return {
        fullHash,
        hash,
        date,
        subject: rest.join("\t").trim(),
      };
    });
  } catch (err) {
    console.warn(
      "[generate-devlog] git log unavailable — keeping existing snapshot if any.",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

const commits = readGitLog();
if (commits === null) {
  process.exit(0);
}

let prevCommits = null;
if (existsSync(outPath)) {
  try {
    prevCommits = JSON.parse(readFileSync(outPath, "utf8")).commits;
  } catch {
    prevCommits = null;
  }
}

if (JSON.stringify(prevCommits) === JSON.stringify(commits)) {
  console.log(`[generate-devlog] unchanged (${commits.length} commits)`);
  process.exit(0);
}

const payload = {
  generatedAt: new Date().toISOString(),
  commits,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[generate-devlog] wrote ${commits.length} commits → src/lib/devlog.json`);
