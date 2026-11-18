/**
 * The visited-property list still points at real listings, and the matcher
 * agrees with the claims we are willing to make.
 *
 *   node scripts/verify-visited.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createVisitedIndex, visitedConfidence, visitedIsClaimed } from "../lib/visited-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const file = read("data/visited-properties.json");
const properties = file.properties || [];
const index = createVisitedIndex(properties);
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

check(typeof file._readme === "string" && file._readme.includes("name"), "the file explains how to add an entry");
check(properties.length > 0, "the list is not empty");

const names = new Map();
for (const entry of properties) {
  check(typeof entry.name === "string" && entry.name.trim().length > 1, `entry is missing a name: ${JSON.stringify(entry).slice(0, 80)}`);
  const key = String(entry.name || "").toLowerCase();
  if (names.has(key)) failures.push(`duplicate name: ${entry.name}`);
  names.set(key, true);
  const confidence = visitedConfidence(entry);
  if (confidence !== "certain" && !(entry.reviewNote && String(entry.reviewNote).trim())) {
    failures.push(`${entry.name} is ${confidence} and has no reviewNote`);
  }
  if (!visitedIsClaimed(entry) && (entry.listings || []).length) {
    failures.push(`${entry.name} is uncertain but still linked to a listing`);
  }
  if (entry.photos && !Array.isArray(entry.photos)) failures.push(`${entry.name} photos is not a list`);
}

const hotels = read("data/atlas/hotel/luxury-hotels.json");
const hotelById = new Map(hotels.map((h) => [h.id, h]));

const STOP = new Set(["the", "and", "hotel", "resort", "spa", "island", "private", "collection"]);
function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
}

const sailings = read("data/atlas/cruise/sailings.json");
const shipIdx = sailings.schema.indexOf("ship");
const opIdx = sailings.schema.indexOf("operator");
const cruiseShips = new Set();
const cruiseOps = new Set();
for (const row of sailings.rows) {
  if (row[shipIdx]) cruiseShips.add(String(row[shipIdx]).trim());
  if (row[opIdx]) cruiseOps.add(String(row[opIdx]).trim());
}

const yacht = read("data/atlas/yacht/itinerary.json");
const yachtShips = new Set((yacht.TRIPS || []).map((t) => t.ship).filter(Boolean));
const world = read("data/atlas/world/itinerary.json");
const worldOps = new Set(
  (world.TRIPS || []).map((t) => world.BRANDS?.[t.brand]?.short).filter(Boolean),
);

let linked = 0;
let unlinked = 0;
const linkedNames = [];
const unlinkedNames = [];

for (const entry of properties) {
  const links = entry.listings || [];
  if (!visitedIsClaimed(entry)) continue;
  if (!links.length) {
    unlinked += 1;
    unlinkedNames.push(entry.name);
    continue;
  }
  linked += 1;
  linkedNames.push(entry.name);
  for (const link of links) {
    if (link.collection === "hotel") {
      const hotel = hotelById.get(link.id);
      check(!!hotel, `${entry.name} lists hotel ${link.id}, which is not in the guide`);
      if (hotel) {
        const wanted = new Set([...tokens(entry.name), ...tokens((entry.aliases || []).join(" "))]);
        const hay = tokens(`${hotel.name} ${hotel.city}`);
        const overlap = hay.some((t) => wanted.has(t));
        check(overlap, `${entry.name} (${link.id}) does not resemble "${hotel.name}"`);
      }
    } else if (link.vessel) {
      const ship = link.vessel;
      const inCruise = cruiseShips.has(ship);
      const inYacht = yachtShips.has(ship);
      check(
        (link.collection === "cruise" && inCruise) || (link.collection === "yacht" && inYacht),
        `${entry.name} lists ${link.collection} vessel "${ship}", which is not in that feed`,
      );
    } else if (link.operator) {
      const ok = link.collection === "cruise"
        ? cruiseOps.has(link.operator)
        : link.collection === "worldcruise"
          ? worldOps.has(link.operator)
          : false;
      check(ok, `${entry.name} lists ${link.collection} operator "${link.operator}", which is not in that feed`);
    } else {
      failures.push(`${entry.name} has a listing with no id, vessel, or operator`);
    }
  }
}

// The matcher itself, on records shaped the way the atlas and the Guide hand them over.
const littleNell = index.visitsForRecord({ id: "h_02038", collection: "hotel", title: "The Little Nell" });
check(littleNell.some((e) => e.name === "The Little Nell"), "The Little Nell does not match h_02038");
check(index.visitsForRecord({ id: "h_00002", collection: "hotel" }).length === 0, "an unvisited hotel matched");

const ilma = index.visitsForRecord({
  collection: "yacht",
  vessel: "Ilma",
  operator: "Ritz-Carlton Yacht Collection",
});
check(ilma.some((e) => e.name === "Ilma"), "Ilma did not match a yacht sailing");
check(
  index.visitsForRecord({ collection: "yacht", vessel: "Evrima", operator: "Ritz-Carlton Yacht Collection" }).length === 0,
  "Evrima was treated as visited because Ilma is",
);

const amundsen = index.visitsForRecord({
  collection: "cruise",
  vessel: "MS Roald Amundsen",
  operator: "HX Expeditions",
});
check(amundsen.some((e) => e.name === "MS Roald Amundsen"), "Roald Amundsen did not match");
check(
  index.visitsForRecord({ collection: "cruise", vessel: "MS Fram", operator: "HX Expeditions" }).length === 0,
  "an unvisited HX ship matched",
);

const silver = index.visitsForRecord({
  collection: "cruise",
  vessel: "Silver Endeavour",
  operator: "Silversea",
});
check(silver.some((e) => e.name === "Silversea"), "a Silversea sailing did not match the line");
check(
  index.visitsForRecord({ collection: "worldcruise", operator: "Silversea", vessel: "Silver Dawn" }).some((e) => e.name === "Silversea"),
  "a Silversea world cruise did not match",
);
check(
  index.visitsForRecord({ collection: "hotel", operator: "Silversea", brand: "Silversea" }).length === 0,
  "a hotel inherited the Silversea line",
);

const prompt = index.visitedGuideSection();
check(prompt.includes("The Little Nell"), "the Guide prompt omits The Little Nell");
check(prompt.includes("not in the guide"), "the Guide prompt has no unlisted visits");
check(prompt.includes("Four Seasons Resort Marrakech"), "an unlisted visit was dropped from the prompt");
check(!prompt.includes("\n- AVRP"), "an uncertain name is claimed in the prompt");
check(prompt.includes("Do not say the advisors have been to these"), "uncertain names are not withheld from the prompt");
check(prompt.includes("AVRP"), "uncertain names are missing from the do-not-claim line");

const claimed = properties.filter(visitedIsClaimed);
const uncertain = properties.filter((e) => !visitedIsClaimed(e));
const likely = properties.filter((e) => visitedConfidence(e) === "likely");

console.log(`visited properties: ${properties.length}`);
console.log(`claimed: ${claimed.length}  (${linked} linked to a listing, ${unlinked} not in the guide)`);
console.log(`uncertain, not shown: ${uncertain.length}`);
console.log(`likely, flagged for review: ${likely.length}`);
console.log("");
console.log("Linked:");
for (const name of linkedNames) console.log(`  ${name}`);
console.log("");
console.log("Not in the guide:");
for (const name of unlinkedNames) console.log(`  ${name}`);
console.log("");
console.log("Uncertain:");
for (const entry of uncertain) console.log(`  ${entry.name} — ${entry.reviewNote}`);
console.log("");
console.log("Likely:");
for (const entry of likely) console.log(`  ${entry.name} — ${entry.reviewNote}`);

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? "" : "s"} failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nOK");
