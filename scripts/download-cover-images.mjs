/**
 * Downloads cover images for all blog posts.
 * Uses Unsplash Source (free, no API key) with curated keywords per post.
 * Run: node scripts/download-cover-images.mjs
 */

import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import https from "https";
import http from "http";

const OUT_DIR = path.resolve("public/images");
mkdirSync(OUT_DIR, { recursive: true });

// Each entry: [filename, unsplash_keywords, width, height]
// Keywords are passed to source.unsplash.com/featured/?keyword
const IMAGES = [
  // ── Flesh and Blood ───────────────────────────────────────────────
  ["fai-silver-age.jpg",        "fire,fantasy,warrior,flames",            900, 500],
  ["compendium-rathe.jpg",      "dark,fantasy,castle,medieval,battle",    900, 500],
  ["bravo-guardian.jpg",        "knight,armor,shield,warrior,fortress",   900, 500],
  ["fab-pitch-guide.jpg",       "cards,board game,strategy,tabletop",     900, 500],
  ["oldhim-guide.jpg",          "ice,glacier,giant,frost,warrior",        900, 500],
  ["rosetta-review.jpg",        "fantasy,magic,spell,arcane,mystical",    900, 500],
  ["fab-equipment-guide.jpg",   "armor,weapons,fantasy,equipment,gear",   900, 500],
  ["high-seas-review.jpg",      "pirate,ship,ocean,sea,adventure",        900, 500],
  ["fab-beatdown-theory.jpg",   "chess,strategy,game,competition",        900, 500],

  // ── Grand Archive ─────────────────────────────────────────────────
  ["ga-tier-list.jpg",          "fantasy,champions,heroes,arena,battle",  900, 500],
  ["ga-fundamentals.jpg",       "fantasy,cards,game,beginner,learn",      900, 500],
  ["ga-first-deck.jpg",         "deck,cards,collection,game,build",       900, 500],
  ["ga-floating-memory.jpg",    "memory,crystals,magic,fantasy,glow",     900, 500],
  ["lorraine-guide.jpg",        "knight,sword,warrior,female,fantasy",    900, 500],
  ["ga-vs-fab.jpg",             "versus,competition,duel,battle,arena",   900, 500],
  ["ga-meta-2025.jpg",          "competitive,tournament,esports,meta",    900, 500],
  ["silvie-guide.jpg",          "dragon,fantasy,mythical,creature,magic", 900, 500],
  ["ga-draft-primer.jpg",       "draft,cards,selection,strategy,table",   900, 500],
  ["diana-archer.jpg",          "archer,bow,arrow,forest,fantasy,elf",    900, 500],

  // ── One Piece TCG ─────────────────────────────────────────────────
  ["op-tournament-prep.jpg",    "tournament,competition,trophy,winner",   900, 500],
  ["op-tier-list.jpg",          "anime,japan,manga,character,colorful",   900, 500],
  ["op-emperors-guide.jpg",     "emperor,power,authority,sea,battle",     900, 500],
  ["op-luffy-guide.jpg",        "adventure,hero,fist,energy,action",      900, 500],
  ["op-law-guide.jpg",          "submarine,blue,ocean,strategy,control",  900, 500],
  ["op-crew-rankings.jpg",      "crew,team,ship,pirate,ocean",            900, 500],
  ["op-deckbuilding.jpg",       "cards,deck,build,strategy,game",         900, 500],
  ["op-don-mechanic.jpg",       "energy,power,burst,mechanic,anime",      900, 500],
  ["op-beginners-guide.jpg",    "ocean,adventure,map,treasure,journey",   900, 500],
  ["op-op01-review.jpg",        "dawn,sunrise,ocean,new,beginning",       900, 500],

  // ── General TCG ───────────────────────────────────────────────────
  ["tcg-community.jpg",         "community,people,friends,gathering,game",900, 500],
  ["card-valuation.jpg",        "money,value,gold,investment,finance",    900, 500],
  ["budget-deckbuilding.jpg",   "budget,coins,saving,money,smart",        900, 500],
  ["collector-vs-player.jpg",   "collector,display,showcase,cards,shelf", 900, 500],
  ["card-conditions.jpg",       "mint,pristine,quality,inspect,cards",    900, 500],
  ["card-storage-guide.jpg",    "storage,organization,binder,sleeve,box", 900, 500],
  ["tcg-fundamentals.jpg",      "strategy,theory,book,learn,fundamentals",900, 500],
  ["whos-the-beatdown.jpg",     "duel,versus,face off,battle,showdown",   900, 500],
];

const agent = new https.Agent({ rejectUnauthorized: false });

async function fetchFollowingRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { agent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects === 0) return reject(new Error("Too many redirects"));
        resolve(fetchFollowingRedirects(res.headers.location, maxRedirects - 1));
      } else {
        resolve(res);
      }
    });
    req.on("error", reject);
  });
}

async function download(filename, keywords, w, h) {
  const dest = path.join(OUT_DIR, filename);
  const url = `https://source.unsplash.com/featured/${w}x${h}/?${encodeURIComponent(keywords)}`;

  try {
    const res = await fetchFollowingRedirects(url);
    if (res.statusCode !== 200) {
      console.error(`  ✗ ${filename} — HTTP ${res.statusCode}`);
      return;
    }
    await pipeline(res, createWriteStream(dest));
    console.log(`  ✓ ${filename}`);
  } catch (e) {
    console.error(`  ✗ ${filename} — ${e.message}`);
  }
}

console.log(`Downloading ${IMAGES.length} cover images to public/images/...\n`);

// Download in batches of 4 to avoid hammering Unsplash
for (let i = 0; i < IMAGES.length; i += 4) {
  const batch = IMAGES.slice(i, i + 4);
  await Promise.all(batch.map(([f, k, w, h]) => download(f, k, w, h)));
  if (i + 4 < IMAGES.length) await new Promise(r => setTimeout(r, 800));
}

console.log("\nDone!");
