import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CSV_URL =
  "https://raw.githubusercontent.com/datasets/currency-codes/main/data/codes-all.csv";
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/utils/iso4217.js",
);

function parseCsvLine(line) {
  const parts = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

const REQUEST_TIMEOUT_MS = 30_000;

const req = get(CSV_URL, (res) => {
  if (res.statusCode !== 200) {
    res.resume();
    console.error(
      `Failed to fetch ${CSV_URL}: HTTP ${res.statusCode} ${res.statusMessage ?? ""}`.trim(),
    );
    process.exit(1);
  }

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    const lines = data.trim().split("\n").slice(1);
    const map = new Map();

    for (const line of lines) {
      const [, , alpha, numeric, , withdrawal] = parseCsvLine(line);
      if (!alpha || !numeric || withdrawal) continue;

      const code = alpha.trim().toUpperCase();
      const num = numeric.trim().padStart(3, "0");
      if (!/^[A-Z]{3}$/.test(code)) continue;
      if (!/^\d{3}$/.test(num)) continue;
      map.set(code, num);
    }

    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const out = createWriteStream(OUT_PATH);

    out.write(`/**
 * ISO 4217 alphabetic → numeric codes (active currencies only).
 * Source: ISO 4217 / datasets/currency-codes (WithdrawalDate empty).
 * Do not edit by hand — regenerate with: npm run generate:iso4217
 */
export const ISO4217_ALPHA_TO_NUMERIC = Object.freeze({
`);
    for (const [alpha, num] of entries) {
      out.write(`  ${alpha}: "${num}",\n`);
    }
    out.write(`});
`);
    out.end();
    console.log(`Wrote ${OUT_PATH} (${entries.length} currencies)`);
  });
});

req.setTimeout(REQUEST_TIMEOUT_MS, () => {
  req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
});

req.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
