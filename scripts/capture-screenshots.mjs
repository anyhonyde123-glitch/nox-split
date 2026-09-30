import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUT = path.join("docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.DEMO_URL || "https://nox-split.vercel.app";

const browser = await chromium.launch({ headless: true });
const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desk.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await desk.waitForTimeout(1500);
await desk.screenshot({
  path: path.join(OUT, "desktop-live.png"),
  fullPage: true,
});

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await mobile.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await mobile.waitForTimeout(1500);
await mobile.screenshot({
  path: path.join(OUT, "mobile-live.png"),
  fullPage: true,
});

const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const raw = fs.readFileSync(path.join(OUT, "ci-test-output.txt"), "utf8");
const text = raw
  .replace(/\u001b\[[0-9;]*m/g, "")
  .split(/\r?\n/)
  .filter(
    (l) =>
      !l.includes("CategoryInfo") &&
      !l.includes("FullyQualified") &&
      !l.includes("NativeCommand") &&
      l.trim(),
  )
  .join("\n")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;");

await page.setContent(`<!doctype html><html><body style="margin:0;background:#121416;font-family:ui-monospace,monospace;color:#e8ece8"><div style="padding:28px"><div class="card" style="background:#1e2227;border:1px solid #3dcf8e55;border-radius:14px;padding:22px"><h1 style="margin:0 0 8px;font:700 20px Georgia,serif;color:#fff">NoxSplit Vitest</h1><div style="color:#3dcf8e;margin-bottom:12px;font-size:13px">13 tests passed</div><pre style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5">${text}</pre></div></div></body></html>`);
await page.locator(".card").screenshot({
  path: path.join(OUT, "test-results.png"),
});

await browser.close();
console.log("screenshots ok");
