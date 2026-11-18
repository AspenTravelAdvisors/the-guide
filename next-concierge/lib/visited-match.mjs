/**
 * Pure matching for data/visited-properties.json.
 *
 * No file access: the caller passes the property list, so the same function
 * runs in the Next bundle (the JSON is imported) and in scripts/verify-visited.mjs
 * (the JSON is read from disk). Uncertain entries are never returned.
 */

export function visitedConfidence(entry) {
  return entry && (entry.confidence === "likely" || entry.confidence === "uncertain")
    ? entry.confidence
    : "certain";
}

export function visitedIsClaimed(entry) {
  return visitedConfidence(entry) !== "uncertain";
}

function norm(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vesselKey(raw) {
  return norm(raw).replace(/^(?:ms|mv|my|m y)\s+/, "");
}

function push(map, key, value) {
  const cur = map.get(key);
  if (cur) cur.push(value);
  else map.set(key, [value]);
}

function collectionOf(raw) {
  const value = raw.collection ?? raw.type;
  return typeof value === "string" ? value : "";
}

function stringsFrom(raw, keys) {
  const out = [];
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) out.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) out.push(item);
      }
    }
  }
  return out;
}

function promptLine(entry) {
  const where = entry.place ? `, ${entry.place}` : "";
  const listed = (entry.listings || []).length ? "in the guide" : "not in the guide";
  const when = entry.visited ? ` Visited: ${entry.visited}.` : "";
  const note = entry.notes ? ` Advisor note: ${entry.notes}` : "";
  return `- ${entry.name}${where} (${listed}).${when}${note}`;
}

/**
 * @param {Array<Record<string, unknown>>} properties
 */
export function createVisitedIndex(properties) {
  const list = Array.isArray(properties) ? properties : [];
  const byId = new Map();
  const byVessel = new Map();
  const byOperator = new Map();

  for (const entry of list) {
    if (!visitedIsClaimed(entry)) continue;
    for (const link of entry.listings || []) {
      const collections = link.collection ? [link.collection] : null;
      if (link.id) push(byId, link.id, entry);
      if (link.vessel) push(byVessel, vesselKey(link.vessel), { entry, collections });
      if (link.operator) push(byOperator, norm(link.operator), { entry, collections });
    }
  }

  function visitsForRecord(raw) {
    if (!raw || typeof raw !== "object") return [];
    const found = [];
    const seen = new Set();
    const add = (entry) => {
      if (!entry || seen.has(entry) || !visitedIsClaimed(entry)) return;
      seen.add(entry);
      found.push(entry);
    };

    const id = typeof raw.id === "string" ? raw.id : "";
    if (id) for (const entry of byId.get(id) || []) add(entry);

    const collection = collectionOf(raw);
    for (const vessel of stringsFrom(raw, ["vessel", "ship", "vessels"])) {
      for (const link of byVessel.get(vesselKey(vessel)) || []) {
        if (!link.collections || !collection || link.collections.includes(collection)) add(link.entry);
      }
    }
    for (const operator of stringsFrom(raw, ["operator", "brand", "brandLabel"])) {
      for (const link of byOperator.get(norm(operator)) || []) {
        if (link.collections && collection && link.collections.includes(collection)) add(link.entry);
      }
    }
    return found;
  }

  function hotelVisits(id) {
    if (!id) return [];
    return (byId.get(id) || []).filter(visitedIsClaimed);
  }

  function visitedGuideSection() {
    const claimed = list.filter(visitedIsClaimed);
    const uncertain = list.filter((entry) => !visitedIsClaimed(entry));
    const held = uncertain.length
      ? `\nNames in the same notes that are not identified well enough to claim. Do not say the advisors have been to these, and do not guess which property they mean: ${uncertain.map((entry) => entry.name).join("; ")}.\n`
      : "";
    return `## WHERE THE ADVISORS HAVE BEEN

Aspen Travel Advisors has personally stayed at, or sailed with, every place on the list below. That is first-hand, and it is separate from what a search returns.

When you recommend or describe one of these, say once, in your own voice, that Aspen Travel Advisors has been there. Vary the wording. Do not hang it on every sentence, and do not invent a room, a rate, a view, or a story that is not in an advisor note on that line.

A search result with advisorVisited set to true is one of these. A sailing on a ship or a line they have traveled counts. Mention it.

Lines marked "not in the guide" are still real visits. You may name them when they belong in the conversation, and you may offer to have an advisor arrange them. Do not present them as search results, cards, or live inventory, and do not invent a listing, a rate, or availability for them.

Never claim a visit that is not on this list.

${claimed.map(promptLine).join("\n")}
${held}`;
  }

  return {
    properties: list,
    visitsForRecord,
    hotelVisits,
    visitedGuideSection,
    claimedCount: list.filter(visitedIsClaimed).length,
  };
}
