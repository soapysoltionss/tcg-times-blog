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
  const riddle     = RIDDLES[pokemonId] ?? "I am a mysterious Pokémon. Who am I?";

  return NextResponse.json(
    { pokemonId, pokemonName, date: todayStr, riddle },
    {
      headers: {
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

// ---------------------------------------------------------------------------
// Riddles — keyed by Pokémon ID (1-indexed)
// One punny / flavour-text clue per Pokémon.
// ---------------------------------------------------------------------------
const RIDDLES: Record<number, string> = {
  1:   "I carry a seed on my back that blooms as I grow stronger. I smell like a flower but fight like a fighter.",
  2:   "My bulb has opened just enough to let the sun in. Almost there — but not quite fully bloomed.",
  3:   "A giant flower crowns my back and I can unleash a solar beam powerful enough to scorch forests.",
  4:   "My tail flame burns bright. If it ever goes out, so do I.",
  5:   "My flame grows hotter and my claws sharper, but I haven't quite earned my wings yet.",
  6:   "I soar the skies breathing fire. My flame burns so hot, rain can't put it out.",
  7:   "I hide in my shell when scared, but my water cannon can punch through steel.",
  8:   "My shell is growing thicker and my water jets stronger. Evolution is close.",
  9:   "Three water cannons on my back can fire with enough force to knock down a building.",
  10:  "I nibble on leaves all day and just want to become something beautiful someday.",
  11:  "I can't move or eat right now — I'm busy becoming something magnificent inside this shell.",
  12:  "My wings scatter a powder that makes enemies drowsy, and I dance on the wind.",
  13:  "My stinger drips poison and I burrow into the ground to build my nest.",
  14:  "I look harmless wrapped in my cocoon, but something fierce is waiting inside.",
  15:  "Three stingers, a swarm of friends, and a bad temper — don't knock down my nest.",
  16:  "A small, common bird — but someday I'll rule the skies.",
  17:  "My wings are growing stronger and I scout wide territories from high above.",
  18:  "I am a majestic bird with perfect control of wind and sky. Pilots fear me.",
  19:  "I gnaw through anything — walls, steel, you name it. Small but relentless.",
  20:  "My long whiskers detect danger before I see it. I've survived by being sneaky.",
  21:  "A sharp beak and a piercing cry — I dive like an arrow to claim my prey.",
  22:  "My beak can shatter diamond and my cry can be heard for miles around.",
  23:  "I shed my skin to become stronger. My fang drips with paralysing venom.",
  24:  "I coil around my prey and squeeze. My hypnotic patterns mesmerise the unwary.",
  25:  "Electric cheeks and a love of ketchup. I'm the most famous Pokémon in the world.",
  26:  "I channel lightning through my body with ease. My evolved form crackles with raw power.",
  27:  "I burrow underground at blinding speed. My claws can slice through hard rock.",
  28:  "My curled-up body is armoured like a pinball and I bowl over anything in my path.",
  29:  "A toxic horn and a fierce personality — I'm the feminine counterpart to a poison-type pair.",
  30:  "Gentle until threatened, then my poisonous horn comes out. Growing into a queen.",
  31:  "I am a queen of poison and ground. My stomp can level buildings.",
  32:  "A poisonous horn and restless energy — I'm the masculine counterpart to a poison-type pair.",
  33:  "My horn grows sharper every day. I charge without hesitation.",
  34:  "I am a king of ground and poison, one of the largest Pokémon in Gen 1.",
  35:  "I sing lullabies that make even the toughest trainers fall fast asleep.",
  36:  "My metronome attack can become anything — truly unpredictable in battle.",
  37:  "Six beautiful tails that can mesmerise and control the weather around me.",
  38:  "Nine magnificent tails, legendary beauty, and flames that can incinerate forests.",
  39:  "I puff up and sing until everyone nearby falls asleep — then I draw on their faces.",
  40:  "My evolved form is round, pink, and surprisingly fierce with its powerful voice.",
  41:  "I hang upside down in dark caves and screech at anything that enters.",
  42:  "I am a larger, more menacing bat that can drain life with a single bite.",
  43:  "My spores can cause drowsiness or poison. I grow wild in fields and forests.",
  44:  "I emit a foul stench but my poisonous pollen is my real weapon.",
  45:  "I am a large, blooming flower with an intoxicating scent. My petals can absorb sunlight.",
  46:  "A mushroom grows on my back and drains nutrients from whatever I cling to.",
  47:  "My mushroom releases clouds of poisonous spores. I evolved far beyond a parasite.",
  48:  "I look like a moth covered in poisonous scales. My powder can disorient foes.",
  49:  "A graceful moth with psychic powers and poison-dusted wings that glow at night.",
  50:  "I peek out of the ground with tiny claws. I can tunnel faster than you can run.",
  51:  "Three heads, triple the digging speed. The shockwaves from my burrowing cause tremors.",
  52:  "A coin on my head and mischief in my heart. I'm a cat burglar in every sense.",
  53:  "Elegant, prideful, and sharp-clawed. My evolved form believes itself royalty.",
  54:  "A confused duck with a permanent headache — my psychic powers grow stronger when the pain does.",
  55:  "My confusion is gone and my psychic powers are fully unleashed. Fear the golden duck.",
  56:  "Hot-tempered and always looking for a fight. I'll brawl with anything, anywhere.",
  57:  "Pure rage on two legs. I punch faster than the eye can see.",
  58:  "A playful pup with a mane of fire. I'll grow into something fearsome.",
  59:  "A legendary dog of fire, majestic and blazing — once I start running I don't stop.",
  60:  "I swim using my curled tail and evolve through water-stone to become powerful.",
  61:  "I spin in circles to generate a vortex. My whirlpool can suck in small boats.",
  62:  "I can use both water and fighting attacks. I'm a master of both elements.",
  63:  "I teleport before you can even blink. My psychic power is off the charts — but my arms are tiny.",
  64:  "I bend spoons with my mind. My twin spoons amplify my psychic energy.",
  65:  "I hold two spoons and my IQ is said to be 5,000. I can predict any attack.",
  66:  "I'm small but I can lift 1,000 times my own weight. I never skip leg day.",
  67:  "Belt around my waist, muscles everywhere. I toss opponents like ragdolls.",
  68:  "Four arms, all muscle. I can punch 1,000 times in two seconds.",
  69:  "My vines snap shut on anything that comes near. I drain nutrients from my prey.",
  70:  "My bell-shaped body lures prey close before my vines grab them.",
  71:  "A carnivorous plant with a wide maw — I swallow whole anything I catch.",
  72:  "Transparent and poisonous, I drift through the ocean stinging anything I touch.",
  73:  "A massive, menacing jellyfish. My tentacles stretch 160 feet and deliver instant paralysis.",
  74:  "I look like a humble rock, but I roll into you with crushing force.",
  75:  "Halfway between a rock and a boulder — I gravitate toward trouble.",
  76:  "I explode when defeated. My body is harder than any mineral on Earth.",
  77:  "A horse with a flaming mane that gallops across lava fields without slowing down.",
  78:  "I race faster than the wind and my hooves spark flame with every step.",
  79:  "Perpetually dazed, I drift through water thinking about absolutely nothing.",
  80:  "My dopey expression hides the fact that my tail is a second brain.",
  81:  "I am made of magnets and float using electromagnetic force. Three screws spin around me.",
  82:  "Two magnets merged — my magnetic field can warp compasses for miles.",
  83:  "I carry a leek as both my weapon and my treasure. Don't try to take it.",
  84:  "Two heads always argue but they run at 60 mph without tripping.",
  85:  "Three heads, three beaks pecking at once. I dive-bomb from the sky.",
  86:  "I lazily float in icy seas with a pup-like face. My cry sounds like a beautiful song.",
  87:  "My long whiskers detect ocean currents. I am a graceful sea lion of the ice.",
  88:  "I am a pile of living sludge that smells horrific and poisons everything I touch.",
  89:  "My toxic sludge can melt anything it touches. Nothing smells worse than me.",
  90:  "A spiky shell with something soft hiding inside. I shoot water from my shell.",
  91:  "Spikes sharp as swords, shell hard as steel. I clamp down and never let go.",
  92:  "I am a disembodied gas that lurks in graveyards, scaring away intruders.",
  93:  "I lick people to steal their soul — or just to give them a nasty chill.",
  94:  "The king of ghosts. I hide in darkness and curse anyone foolish enough to look at me.",
  95:  "A giant rock snake that tunnels underground. My body is made of solid stone.",
  96:  "I put people to sleep by waving a pendulum, then feed on their dreams.",
  97:  "I devour the nightmares I create. My pendulum swings and your consciousness fades.",
  98:  "A tiny crab that snaps its claws ferociously. Don't let the size fool you.",
  99:  "A king crab with claws so powerful they can crush a bowling ball with ease.",
  100: "I look harmless, but if you flip my switch, I detonate with a massive explosion.",
  101: "I overcharge constantly. One day I'll just explode — and I'm strangely okay with that.",
  102: "A cluster of six eggs with a single shared consciousness. My psychic power is strangely strong.",
  103: "Coconut palms for a head and psychic powers for a brain. I look ridiculous and don't care.",
  104: "I carry my mother's skull on my head. The weight of grief makes me stronger.",
  105: "The bone I carry channels ghostly energy. Marowak is the name of the grief I carry.",
  106: "The fastest kicker in Pokémon. My high kicks can shatter concrete walls.",
  107: "Boxing gloves forever attached to my fists. I'm the punching specialist.",
  108: "A long sticky tongue that can snatch your wallet without you ever noticing.",
  109: "My toxic gas leaks constantly and peels the paint off anything nearby.",
  110: "Two balloon heads of poison gas. We argue constantly but drift together.",
  111: "A thick-skulled rhino with a rock-hard horn. I charge without thinking twice.",
  112: "My drill-like horn can pierce anything. Bigger, meaner, harder-headed.",
  113: "I carry an egg in my pouch that appears out of nowhere. I'm the healer of the original 151.",
  114: "Vines whip around me constantly, draining nutrients from whatever I grab onto.",
  115: "I carry my baby in a pouch. No one messes with a mother and her child.",
  116: "A tiny seahorse with a snout that shoots water. I dream of becoming something magnificent.",
  117: "My spines became more impressive and my water jets grow stronger every day.",
  118: "A golden fish with a sharp horn. I leap rivers in a single bound.",
  119: "I crown myself the king of ponds with my flowing fins and powerful water attacks.",
  120: "A star-shaped water creature that spins rapidly to deflect attacks.",
  121: "A powerful starfish with a gemstone core — I'm both a water and psychic master.",
  122: "I mimic everything you do perfectly. It's unsettling how good I am at this.",
  123: "Razor-sharp scythes for arms and blazing speed — I'm the original bug-type powerhouse.",
  124: "Ice and psychic energy wrapped in a humanoid form. My kiss can freeze you solid.",
  125: "Static electricity crackles around me and I punch with electric-charged fists.",
  126: "I breathe fire from the flame on my head and punch with magma-powered fists.",
  127: "Pincers like vice grips and a reckless fighting style. I'm the pride of Bug-types.",
  128: "A raging bull with an intimidating Normal-type charge. I'm surprisingly hard to beat.",
  129: "The world laughs at me, but I'm plotting my magnificent revenge. Just wait.",
  130: "The sea monster of legend, once a joke, now a nightmare. My Hyper Beam fears nothing.",
  131: "A gentle giant of the sea — ancient, kind, and nearly impossible to find.",
  132: "I am everyone and no one. I shift my DNA to copy any Pokémon perfectly.",
  133: "Cute, adaptable, and full of potential — I can become one of several evolutions.",
  134: "I surf on waves made of pure water and attack with a Water Gun so powerful it shears rock.",
  135: "I crackle with electric energy and run faster than lightning itself.",
  136: "My body blazes with internal fire. I warm those I care for and scorch those I don't.",
  137: "I am not made of flesh — my body is pure code and circuitry. The first digital Pokémon.",
  138: "A primordial spiral-shelled creature revived from an ancient fossil.",
  139: "An ancient cephalopod with armoured coils, revived from prehistoric amber.",
  140: "A horseshoe crab from millions of years ago, given new life through fossil science.",
  141: "My ancient shell is a formidable armour and my claw is as sharp as any blade.",
  142: "A fierce pterodactyl revived from a prehistoric wing. I dominate the skies.",
  143: "I sleep almost all the time, but my weight and power make me nearly unstoppable when awake.",
  144: "A legendary bird of ice. My wings freeze the air and summon blizzards.",
  145: "A legendary bird of lightning. Thunderclouds follow wherever I fly.",
  146: "A legendary bird of fire. My wake leaves scorched feathers and ash.",
  147: "A gentle dragon-child, swimming through clouds. My power is still sleeping.",
  148: "Elegant and long, I glide through storm clouds and grow toward something legendary.",
  149: "The mightiest dragon. I circle the globe in 16 hours and master wind and water alike.",
  150: "Created in a lab, escaping in fury — I am the most powerful Pokémon ever made.",
  151: "A mythical cat-like being, said to carry the DNA of all Pokémon. Few have seen me.",
};

