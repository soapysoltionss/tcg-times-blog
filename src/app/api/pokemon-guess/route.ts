import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, saveUser } from "@/lib/db";
import { TASK_CATALOGUE } from "@/lib/xp";
// ---------------------------------------------------------------------------
// Deterministic daily Pokémon picker
// ---------------------------------------------------------------------------

// We use the first 151 Pokémon (Gen 1) by ID.
// The daily pick is: POKÉMON_IDS[ daysSinceEpoch % 151 ]
// This means every user worldwide sees the same Pokémon for the same UTC day.

const TOTAL = 151;

/** Returns today's UTC date string in YYYY-MM-DD format */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the Pokémon ID (1-151) for a given UTC date */
function pokemonIdForDate(dateStr: string): number {
  // days since unix epoch
  const ms    = new Date(dateStr).getTime();
  const days  = Math.floor(ms / 86_400_000);
  return (days % TOTAL) + 1; // 1-indexed
}

// ---------------------------------------------------------------------------
// GET /api/pokemon-guess
//   Returns today's Pokémon metadata (name, id) so the client can render the
//   silhouette image without needing to call PokéAPI directly.
//   Fully public — alreadyGuessed is resolved client-side after a POST attempt.
// ---------------------------------------------------------------------------
export async function GET() {
  const todayStr   = todayUtc();
  const pokemonId  = pokemonIdForDate(todayStr);
  const pokemonName = POKEMON_NAMES[pokemonId - 1];

  return NextResponse.json(
    { pokemonId, pokemonName, date: todayStr },
    {
      headers: {
        // Same Pokémon all day — safe to CDN-cache for 30 min, serve stale
        // for up to the rest of the day while revalidating in background.
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
      },
    }
  );
}

// ---------------------------------------------------------------------------
// POST /api/pokemon-guess
//   Body: { guess: string }
//   Returns: { correct, pokemonName, xpAwarded, alreadyGuessed }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const todayStr  = todayUtc();
  const pokemonId = pokemonIdForDate(todayStr);
  const pokemonName = POKEMON_NAMES[pokemonId - 1];

  // Already guessed today?
  if (user.lastPokemonGuessDate === todayStr) {
    return NextResponse.json({
      correct: true,
      pokemonName,
      xpAwarded: 0,
      alreadyGuessed: true,
    });
  }

  let body: { guess?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw   = typeof body.guess === "string" ? body.guess.trim() : "";
  const guess = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const answer = pokemonName.toLowerCase();

  const correct = guess === answer || guess === answer.replace(/-/g, "");

  if (!correct) {
    return NextResponse.json({ correct: false, pokemonName: null, xpAwarded: 0, alreadyGuessed: false });
  }

  // Award XP
  const task = TASK_CATALOGUE.find(t => t.id === "daily_pokemon_guess");
  const xpReward = task?.xpReward ?? 50;

  user.lastPokemonGuessDate = todayStr;
  user.xp += xpReward;
  // Mark the task as done the first time (shows in quest log)
  const existingTask = user.tasks.find(t => t.id === "daily_pokemon_guess");
  if (!existingTask) {
    user.tasks.push({ id: "daily_pokemon_guess", completedAt: new Date().toISOString() });
  } else if (!existingTask.completedAt) {
    existingTask.completedAt = new Date().toISOString();
  }
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  return NextResponse.json({ correct: true, pokemonName, xpAwarded: xpReward, alreadyGuessed: false });
}

// ---------------------------------------------------------------------------
// Gen 1 Pokémon names (index 0 = Pokémon #1 Bulbasaur)
// ---------------------------------------------------------------------------
const POKEMON_NAMES: string[] = [
  "bulbasaur","ivysaur","venusaur","charmander","charmeleon","charizard",
  "squirtle","wartortle","blastoise","caterpie","metapod","butterfree",
  "weedle","kakuna","beedrill","pidgey","pidgeotto","pidgeot",
  "rattata","raticate","spearow","fearow","ekans","arbok",
  "pikachu","raichu","sandshrew","sandslash","nidoran-f","nidorina",
  "nidoqueen","nidoran-m","nidorino","nidoking","clefairy","clefable",
  "vulpix","ninetales","jigglypuff","wigglytuff","zubat","golbat",
  "oddish","gloom","vileplume","paras","parasect","venonat",
  "venomoth","diglett","dugtrio","meowth","persian","psyduck",
  "golduck","mankey","primeape","growlithe","arcanine","poliwag",
  "poliwhirl","poliwrath","abra","kadabra","alakazam","machop",
  "machoke","machamp","bellsprout","weepinbell","victreebel","tentacool",
  "tentacruel","geodude","graveler","golem","ponyta","rapidash",
  "slowpoke","slowbro","magnemite","magneton","farfetchd","doduo",
  "dodrio","seel","dewgong","grimer","muk","shellder",
  "cloyster","gastly","haunter","gengar","onix","drowzee",
  "hypno","krabby","kingler","voltorb","electrode","exeggcute",
  "exeggutor","cubone","marowak","hitmonlee","hitmonchan","lickitung",
  "koffing","weezing","rhyhorn","rhydon","chansey","tangela",
  "kangaskhan","horsea","seadra","goldeen","seaking","staryu",
  "starmie","mr-mime","scyther","jynx","electabuzz","magmar",
  "pinsir","tauros","magikarp","gyarados","lapras","ditto",
  "eevee","vaporeon","jolteon","flareon","porygon","omanyte",
  "omastar","kabuto","kabutops","aerodactyl","snorlax","articuno",
  "zapdos","moltres","dratini","dragonair","dragonite","mewtwo",
  "mew",
];
