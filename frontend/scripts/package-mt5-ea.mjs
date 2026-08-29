#!/usr/bin/env node
/**
 * Packages mt5/TraderOSSync into frontend/public/downloads/TraderOSSync.zip
 * for one-click download from the Connect MT5 wizard.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const srcDir = path.join(root, "mt5/TraderOSSync");
const ex5 = path.join(srcDir, "TraderOSSync.ex5");
const mq5 = path.join(srcDir, "TraderOSSync.mq5");
const outDir = path.join(__dirname, "../public/downloads");
const stageDir = path.join(outDir, "TraderOSSync");
const zipPath = path.join(outDir, "TraderOSSync.zip");

if (!existsSync(ex5)) {
  console.error(
    "TraderOSSync.ex5 not found. Compile TraderOSSync.mq5 in MetaEditor (F7) first, then re-run.",
  );
  process.exit(1);
}

mkdirSync(stageDir, { recursive: true });
cpSync(ex5, path.join(stageDir, "TraderOSSync.ex5"));
if (existsSync(mq5)) {
  cpSync(mq5, path.join(stageDir, "TraderOSSync.mq5"));
}

const install = `Trader OS — MetaTrader 5 Sync
================================

Quick setup (about 5 minutes)
-----------------------------

1. Open MetaTrader 5 → File → Open Data Folder → MQL5 → Experts
2. Copy this entire TraderOSSync folder into Experts
3. In MT5 Navigator → Expert Advisors → right-click → Refresh
4. Drag TraderOSSync onto any chart
5. In EA inputs:
   - ApiBaseUrl — copy from Trader OS (Connect MT5 wizard)
   - ConnectionToken — paste your connection code from Trader OS
6. Tools → Options → Expert Advisors → check "Allow WebRequest for listed URL"
   Add the same ApiBaseUrl (no path, e.g. https://your-app.vercel.app)
7. Enable Algo Trading on the chart

No compilation needed — TraderOSSync.ex5 is pre-built.

Keep MT5 running while you trade. Sync updates every ~10 seconds.

Read-only: the EA cannot place, modify, or close trades.
`;
writeFileSync(path.join(stageDir, "INSTALL.txt"), install, "utf8");

if (existsSync(zipPath)) {
  execSync(`rm -f "${zipPath}"`);
}
execSync(`cd "${outDir}" && zip -rq TraderOSSync.zip TraderOSSync`);
execSync(`rm -rf "${stageDir}"`);

const size = readFileSync(zipPath).length;
console.log(`Packaged ${zipPath} (${size} bytes)`);
