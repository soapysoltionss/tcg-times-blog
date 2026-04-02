/**
 * Scrapes real TCG card images for all blog post covers.
 * Sources:
 *   FaB  — static.wikia.nocookie.net (Flesh and Blood fandom wiki CDN)
 *   GA   — api.gatcg.com/cards/search + /cards/images/ CDN
 *   OP   — en.onepiece-cardgame.com/images/cardlist/card/
 * Run: node scripts/scrape-cover-images.mjs
 */
import { createWriteStream, mkdirSync, existsSync, statSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import https from "https";
import http from "http";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const OUT_DIR = path.resolve("public/images");
mkdirSync(OUT_DIR, { recursive: true });
const agent = new https.Agent({ rejectUnauthorized: false });

async function fetchStream(url, redirects = 10) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      agent,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects === 0) return reject(new Error("Too many redirects"));
        const next = new URL(res.headers.location, url).href;
        res.resume();
        resolve(fetchStream(next, redirects - 1));
      } else { resolve(res); }
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function download(filename, url) {
  const dest = path.join(OUT_DIR, filename);
  if (existsSync(dest) && statSync(dest).size > 5000) {
    console.log(`  ⏭  ${filename} (exists)`);
    return true;
  }
  try {
    const res = await fetchStream(url);
    const ct = res.headers["content-type"] || "";
    if (res.statusCode !== 200 || !ct.startsWith("image/")) {
      res.resume();
      console.error(`  ✗ ${filename} — HTTP ${res.statusCode} (${ct.slice(0,30)})  ${url.slice(0,80)}`);
      return false;
    }
    await pipeline(res, createWriteStream(dest));
    const size = statSync(dest).size;
    if (size < 3000) { console.error(`  ✗ ${filename} — too small (${size}b)`); return false; }
    console.log(`  ✓ ${filename} (${(size/1024).toFixed(0)} kb)`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${filename} — ${e.message}`);
    return false;
  }
}

// GA API: search by name, return first edition image URL
async function gaUrl(name) {
  const res = await fetchStream(`https://api.gatcg.com/cards/search?name=${encodeURIComponent(name)}`);
  const chunks = [];
  for await (const c of res) chunks.push(c);
  const json = JSON.parse(Buffer.concat(chunks).toString());
  const editions = json.data?.[0]?.editions;
  if (!editions?.length) return null;
  const ed = editions.find(e => e.image) ?? editions[0];
  return ed?.image ? `https://api.gatcg.com${ed.image}` : null;
}

// FaB fandom wiki CDN (pre-resolved)
const FAB = "https://static.wikia.nocookie.net/flesh-and-blood/images";
const F = {
  fai:        `${FAB}/7/7d/Fai-rising-rebellion-hero-adult.jpg/revision/latest?cb=20230802025101`,
  bravo:      `${FAB}/f/fc/Bravo-showstopper-hero-adult.jpg/revision/latest?cb=20230802024624`,
  bravo_star: `${FAB}/5/5f/Bravo-star-of-the-show-hero-adult.jpg/revision/latest?cb=20230802030148`,
  oldhim:     `${FAB}/c/ca/Oldhim-grandfather-of-eternity-hero-adult.jpg/revision/latest?cb=20230802030041`,
  iyslander:  `${FAB}/a/a2/Iyslander-stormbind-hero-adult.jpg/revision/latest?cb=20230802025101`,
  dromai:     `${FAB}/9/98/Dromai-ash-artist-hero-adult.jpg/revision/latest?cb=20230802024625`,
  kano:       `${FAB}/0/06/Kano-dracai-of-aether-hero-adult.jpg/revision/latest?cb=20230802024625`,
  chane:      `${FAB}/4/41/Chane-bound-by-shadow-hero-adult.jpg/revision/latest?cb=20230802024625`,
  dash:       `${FAB}/e/e7/Dash-inventor-extraordinaire-hero-adult.jpg/revision/latest?cb=20230802025101`,
  lexi:       `${FAB}/1/16/Lexi-livewire-hero-adult.jpg/revision/latest?cb=20230802030040`,
  prism:      `${FAB}/5/5f/Prism-awakener-of-sol-hero-adult.jpg/revision/latest?cb=20230802030040`,
  katsu:      `${FAB}/2/28/Katsu-the-wanderer-hero-adult.jpg/revision/latest?cb=20230802025101`,
};

// OP official card images
const OP = "https://en.onepiece-cardgame.com/images/cardlist/card";

// [filename, "direct"|"ga", url_or_ga_name]
const PLAN = [
  // Flesh and Blood
  ["fai-silver-age.jpg",      "direct", F.fai],
  ["compendium-rathe.jpg",    "direct", F.bravo],
  ["bravo-guardian.jpg",      "direct", F.bravo],
  ["fab-pitch-guide.jpg",     "direct", F.kano],
  ["oldhim-guide.jpg",        "direct", F.oldhim],
  ["rosetta-review.jpg",      "direct", F.bravo_star],
  ["fab-equipment-guide.jpg", "direct", F.dash],
  ["high-seas-review.jpg",    "direct", F.dromai],
  ["fab-beatdown-theory.jpg", "direct", F.chane],
  // Grand Archive — live from api.gatcg.com
  ["ga-tier-list.jpg",        "ga", "Lorraine"],
  ["ga-fundamentals.jpg",     "ga", "Silvie"],
  ["ga-first-deck.jpg",       "ga", "Tristan"],
  ["ga-floating-memory.jpg",  "ga", "Emilia"],
  ["lorraine-guide.jpg",      "ga", "Lorraine Crux Knight"],
  ["ga-vs-fab.jpg",           "ga", "Diana"],
  ["ga-meta-2025.jpg",        "ga", "Lorraine"],
  ["silvie-guide.jpg",        "ga", "Silvie"],
  ["ga-draft-primer.jpg",     "ga", "Tristan"],
  ["diana-archer.jpg",        "ga", "Diana"],
  // One Piece TCG
  ["op-tournament-prep.jpg",  "direct", `${OP}/OP01-001.png`],
  ["op-tier-list.jpg",        "direct", `${OP}/OP01-001.png`],
  ["op-emperors-guide.jpg",   "direct", `${OP}/OP01-091.png`],
  ["op-luffy-guide.jpg",      "direct", `${OP}/OP01-060.png`],
  ["op-law-guide.jpg",        "direct", `${OP}/OP02-001.png`],
  ["op-crew-rankings.jpg",    "direct", `${OP}/OP01-028.png`],
  ["op-deckbuilding.jpg",     "direct", `${OP}/OP01-002.png`],
  ["op-don-mechanic.jpg",     "direct", `${OP}/OP01-091.png`],
  ["op-beginners-guide.jpg",  "direct", `${OP}/OP01-001.png`],
  ["op-op01-review.jpg",      "direct", `${OP}/OP01-001.png`],
  // General — use FaB hero art as TCG imagery
  ["tcg-community.jpg",       "direct", F.prism],
  ["card-valuation.jpg",      "direct", F.lexi],
  ["budget-deckbuilding.jpg", "direct", F.katsu],
  ["collector-vs-player.jpg", "direct", F.dromai],
  ["card-conditions.jpg",     "direct", F.iyslander],
  ["card-storage-guide.jpg",  "direct", F.dash],
  ["tcg-fundamentals.jpg",    "direct", F.kano],
  ["whos-the-beatdown.jpg",   "direct", F.chane],
];

console.log(`\nDownloading ${PLAN.length} cover images...\n`);
let ok = 0, fail = 0;

for (const [filename, type, arg] of PLAN) {
  let url = arg;
  if (type === "ga") {
    try {
      url = await gaUrl(arg);
      if (!url) { console.error(`  ✗ ${filename} — GA: no result for "${arg}"`); fail++; continue; }
    } catch (e) { console.error(`  ✗ ${filename} — GA error: ${e.message}`); fail++; continue; }
  }
  const success = await download(filename, url);
  success ? ok++ : fail++;
  await new Promise(r => setTimeout(r, 150));
}

console.log(`\n✓ ${ok} downloaded   ✗ ${fail} failed`);
