import data from "./devlog.json";

export type DevlogCommit = {
  fullHash: string;
  hash: string;
  date: string; // YYYY-MM-DD
  subject: string;
};

export type DevlogSnapshot = {
  generatedAt: string;
  commits: DevlogCommit[];
};

export type DevlogDay = {
  date: string;
  commits: DevlogCommit[];
};

export const DEVLOG = data as DevlogSnapshot;

/** Group newest-first commits into date buckets (also newest-first). */
export function groupDevlogByDate(commits: DevlogCommit[] = DEVLOG.commits): DevlogDay[] {
  const map = new Map<string, DevlogCommit[]>();
  for (const c of commits) {
    const list = map.get(c.date);
    if (list) list.push(c);
    else map.set(c.date, [c]);
  }
  return Array.from(map.entries()).map(([date, dayCommits]) => ({
    date,
    commits: dayCommits,
  }));
}

/** Display date like 22 JUL 2026 */
export function formatDevlogDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}
