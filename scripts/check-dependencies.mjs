#!/usr/bin/env node
/**
 * Reports outdated npm packages and security audit summary.
 * Used locally (`npm run deps:check`) and in CI (dependency-audit workflow).
 *
 * This project is Next.js — there is no WordPress CMS/plugins layer.
 * Keeping dependencies updated is the equivalent security practice here.
 */

import { execSync } from "node:child_process";

const ciMode = process.argv.includes("--ci");

function runJson(command) {
  try {
    const stdout = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(stdout || "{}");
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    if (stdout.trim()) {
      try {
        return JSON.parse(stdout);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function printOutdated() {
  const data = runJson("npm outdated --json");
  if (!data || Object.keys(data).length === 0) {
    console.log("Outdated packages: none (or all within semver range).");
    return [];
  }

  const rows = Object.entries(data).map(([name, info]) => ({
    name,
    current: info.current ?? "—",
    wanted: info.wanted ?? "—",
    latest: info.latest ?? "—",
    type: info.type ?? "—",
  }));

  console.log(`Outdated packages: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `  - ${row.name} (${row.type}): ${row.current} → wanted ${row.wanted}, latest ${row.latest}`
    );
  }
  return rows;
}

function printAudit() {
  const data = runJson("npm audit --json");
  const meta = data?.metadata?.vulnerabilities ?? {};
  const totals = {
    low: Number(meta.low ?? 0),
    moderate: Number(meta.moderate ?? 0),
    high: Number(meta.high ?? 0),
    critical: Number(meta.critical ?? 0),
  };

  console.log(
    `Vulnerabilities: low ${totals.low}, moderate ${totals.moderate}, high ${totals.high}, critical ${totals.critical}`
  );

  if (totals.high > 0 || totals.critical > 0) {
    console.log("Run `npm audit` for details. Fix with `npm audit fix` where safe, or update packages.");
  }

  return totals;
}

console.log("i-Robox dependency check\n");

const outdated = printOutdated();
console.log("");
const audit = printAudit();

if (ciMode && (audit.high > 0 || audit.critical > 0)) {
  process.exit(1);
}

if (!ciMode && outdated.length > 0) {
  console.log("\nTip: Dependabot opens weekly update PRs on GitHub. Review and merge when tests pass.");
}
