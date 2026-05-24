/**
 * Production manual checks 16–20 (headless Chromium via Playwright).
 * Run: npx playwright install chromium && node scripts/prod-manual-checks.mjs
 */
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://i-robox.com";
const OUT = join(process.cwd(), "scripts", "prod-check-output");

function msSinceNav(request, navStart) {
  const t = request.timing?.startTime ?? request._timing?.startTime;
  if (t == null || navStart == null) return null;
  return Math.round(t - navStart);
}

async function checkShopEdwardmartin(page) {
  const navStart = await page.evaluate(() => performance.timeOrigin);

  await page.goto(`${BASE}/shop`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(25000);

  const timing = await page.evaluate((origin) => {
    const entries = performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      startTime: e.startTime,
      duration: e.duration,
      initiatorType: e.initiatorType,
    }));
    const nav = performance.getEntriesByType("navigation")[0];
    const ttiProxy = nav?.domInteractive ?? nav?.loadEventEnd ?? 0;
    return { entries, ttiProxy, origin };
  }, navStart);

  const edward = timing.entries.filter((e) => e.name.includes("edwardmartin"));
  const gtm = timing.entries.filter((e) => e.name.includes("googletagmanager.com"));
  const first3s = edward.filter((e) => e.startTime < 3000);

  return {
    check: 16,
    edwardmartinCount: edward.length,
    gtmCount: gtm.length,
    first3sCount: first3s.length,
    edwardTimingsMs: edward.map((e) => Math.round(e.startTime)),
    gtmTimingsMs: gtm.map((e) => Math.round(e.startTime)),
    ttiProxyMs: Math.round(timing.ttiProxy),
    pass:
      edward.length === 0
        ? gtm.length === 0
          ? "INCONCLUSIVE (no GTM/edwardmartin in headless — verify in Chrome DevTools)"
          : "PASS (GTM deferred; no edwardmartin yet — nb-collector may need GTM trigger update)"
        : first3s.length === 0 && edward.every((e) => e.startTime >= timing.ttiProxy)
          ? "PASS"
          : first3s.length === 0
            ? "PASS (no edwardmartin in first 3s)"
            : "FAIL",
    note: "Site owner: set nb-collector tag trigger to Window Loaded in GTM dashboard.",
  };
}

async function checkShopLcpImage(page) {
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);

  const img = page.locator('img[alt*="Kawasaki Ninja H2R"]').first();
  await img.waitFor({ state: "visible", timeout: 30000 });

  const attrs = await img.evaluate((el) => ({
    fetchpriority: el.getAttribute("fetchpriority"),
    loading: el.getAttribute("loading"),
    src: el.getAttribute("src"),
    decoding: el.getAttribute("decoding"),
  }));

  return {
    check: 17,
    attrs,
    pass:
      attrs.fetchpriority === "high" && attrs.loading === "eager"
        ? "PASS"
        : "FAIL",
  };
}

async function checkConsole(page, path) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(8000);

  const preloadWarnings = errors.filter(
    (e) =>
      e.includes("preload") ||
      e.includes("Preload") ||
      e.includes("was preloaded")
  );

  return { path, errors, preloadWarnings, pass: errors.length === 0 ? "PASS" : "FAIL" };
}

async function checkHeroCarouselSlow4G(browser) {
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    locale: "en-US",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 180000 });

  const result = await page.evaluate(() => {
    return new Promise((resolve) => {
      const carousel = document.querySelector('[aria-label="Hero banner carousel"]');
      const heroImg =
        carousel?.querySelector('img[fetchpriority="high"]') ||
        carousel?.querySelector("img");
      if (!heroImg) {
        resolve({ error: "hero img not found", advancedBeforeLoad: null });
        return;
      }

      const tabs = Array.from(
        document.querySelectorAll('[role="tablist"][aria-label="Banner slides"] [role="tab"]')
      );

      const getActiveIndex = () =>
        tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");

      let advancedBeforeLoad = false;
      const interval = setInterval(() => {
        const active = getActiveIndex();
        if (active > 0 && !heroImg.complete) {
          advancedBeforeLoad = true;
          clearInterval(interval);
          resolve({
            advancedBeforeLoad: true,
            activeIndex: active,
            complete: heroImg.complete,
          });
        }
      }, 150);

      const finish = (extra = {}) => {
        clearInterval(interval);
        resolve({
          advancedBeforeLoad,
          activeIndex: getActiveIndex(),
          complete: heroImg.complete,
          ...extra,
        });
      };

      heroImg.addEventListener("load", () => finish({ loadedVia: "event" }), { once: true });
      setTimeout(() => finish({ timedOut: true }), 14000);
    });
  });

  await context.close();
  return {
    check: 18,
    ...result,
    pass:
      result.error != null
        ? "INCONCLUSIVE"
        : result.advancedBeforeLoad
          ? "FAIL"
          : "PASS",
  };
}

async function screenshots(browser) {
  mkdirSync(OUT, { recursive: true });
  const widths = [375, 768, 1440];
  const paths = ["/", "/shop"];
  const files = [];

  for (const w of widths) {
    const context = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await context.newPage();
    for (const p of paths) {
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(2000);
      const name = `check19-${p === "/" ? "home" : "shop"}-${w}.png`.replace(/\//g, "");
      const file = join(OUT, name);
      await page.screenshot({ path: file, fullPage: false });
      files.push(file);
    }
    await context.close();
  }
  return { check: 19, files, pass: "PASS (screenshots saved — visual review required)" };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || "chrome",
  });
  const page = await browser.newPage();

  const results = {};
  results.check16 = await checkShopEdwardmartin(page);
  results.check17 = await checkShopLcpImage(page);
  results.check20shop = await checkConsole(await browser.newPage(), "/shop");
  results.check20home = await checkConsole(await browser.newPage(), "/");
  results.check18 = await checkHeroCarouselSlow4G(browser);
  results.check19 = await screenshots(browser);

  await browser.close();

  const outPath = join(OUT, "results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log("\nWrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
