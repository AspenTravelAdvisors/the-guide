// Supplier offers, as a traveler may see them.
//
// The Virtuoso promotions feed is written for advisors. Some offers are
// addressed to us outright — "2% Bonus Commission" on 76 sailings, "20% Advisor
// Commission | Opening Incentive", an invitation for New York advisors — and
// many that are real traveler offers still state our commission in the middle
// of their terms: "Complimentary round-trip airport transfers 15% commission***",
// "Commission: 15% commission is paid on commissionable rates with a valid
// travel industry ID." None of that belongs on a page a traveler reads.
//
// The amenities themselves (the upgrade, the breakfast, the credit) go to the
// guest and are kept. Only what is paid to the advisor, or said to the advisor
// about how they are paid, is taken out.
//
// Applied where the feeds are built (scripts/merge-virtuoso-hotels.mjs and
// merge-virtuoso-journeys.mjs), so the hotel and journey pages, the atlases,
// the dossiers and the Guide all read offers that are already clean. The hotel
// and journey pages (lib/seo) apply it again, which costs nothing and covers a
// feed built before this existed.

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * An offer named for advisors: "2% Bonus Commission", "Exclusive Invitation for
 * NY Advisors", "2026 Sell 3 Sail Free" (sell three bookings, the advisor sails).
 */
const ADVISOR_NAME = /commission|\badvisors?\b|\bagents?\b|incentive|\bfam\b|\bsell \d/i;
/**
 * A description selling commission rather than a stay: "This winter, earn more
 * with Winter Advantage… an enhanced 12% commission". Such an offer is advisor
 * only when nothing is left for the guest once the commission is cut.
 */
const COMMISSION_PITCH = /enhanced commissions?\b|\bearn more\b/i;
const GUEST_BENEFIT =
  /\d+\s*%\s*(?:off|savings?|discount)|\bsave\b|\bsavings\b|complimentary|\bfree (?:nights?|breakfast|upgrade|transfers?|flights?|wi-?fi)|\bnights? (?:free|on us)\b|\bcredit\b|\bpay \d/i;

/** Whether an offer is meant for travelers at all. */
export function isTravelerOffer(p) {
  if (ADVISOR_NAME.test(clean(p?.name))) return false;
  const text = clean(p?.description);
  return !COMMISSION_PITCH.test(text) || GUEST_BENEFIT.test(travelerOfferText(text) ?? '');
}

/**
 * Commission named inline: "15% commission***", "along with 10% commission,",
 * "+ 15 --> 20% advisor commission", "• 15% commission •".
 */
const COMMISSION_CLAUSE =
  /\s*(?:,\s*)?(?:(?:along with|plus|and|with)\s+)?(?:\+\s*)?(?:an?\s+)?(?:additional\s+)?(?:\d+(?:\.\d+)?\s*%?\s*(?:-+>|→|to)\s*)?\d+(?:\.\d+)?\s*%\s*(?:(?:enhanced|advisor|agent|bonus)\s+)?commission\b\**[,;]?/gi;
/**
 * "Commissionable Rate" as a label in a run-on list of perks. Only the label:
 * cutting the word out of "The offer is commissionable at 10%" would leave
 * "The offer is at 10%", which reads as a discount, so that sentence goes whole.
 */
const COMMISSIONABLE = /\s*\bCommissionable Rates?\b(?:\s+-)?/g;
/**
 * "The offer is commissionable at 10% and is not combinable…", run on after the
 * offer itself ("Stay 3 Nights, Pay For 2 The offer is…") with no full stop
 * between them. Cut from the clause to the end of its sentence, so the offer
 * before it stays.
 */
const COMMISSIONABLE_CLAUSE =
  /\s*\b(?:the|this)\s+(?:offer|rate|promotion|promotional rate|package)\s+is\s+commissionable\b[^.]*(?:\.|$)/gi;

/** A sentence about how the advisor is paid or who may book at the rate. */
const ADVISOR_SENTENCE =
  /commission|incentive|travel industry id|\biata\b|bona[ -]?fide (?:travel )?(?:agent|advisor)|your overall return\b|\bearn more\b/i;

/**
 * An offer description with commission terms taken out, or null when nothing
 * is left. Inline clauses are cut first, so a perk list that only mentions
 * commission in passing keeps its perks; any sentence still about commission
 * then goes whole.
 */
export function travelerOfferText(text) {
  const s = clean(text)
    .replace(COMMISSIONABLE_CLAUSE, '')
    .replace(COMMISSION_CLAUSE, '')
    .replace(COMMISSIONABLE, '')
    .replace(/•(?:\s*•)+/g, '•');
  if (!s) return null;
  const out = s
    // Full stops where there are any; the feed's run-on blobs ("…for selected
    // room categories An excellent opportunity…") also break before a word
    // that can only open a sentence. A wrong break keeps more text, never less.
    .split(/(?<=[.!?…])\s+(?=[A-Z0-9$€£"“(])|(?<=[a-z0-9)])\s+(?=(?:An?|This|These|Please|Guests|Enjoy|Rates?|Commissions?)\s)/)
    .filter((sentence) => !ADVISOR_SENTENCE.test(sentence))
    .join(' ')
    .trim();
  return out || null;
}

/** The offers a traveler may see, with their descriptions cleaned. */
export function travelerOffers(list) {
  return (Array.isArray(list) ? list : [])
    .filter(isTravelerOffer)
    .map((p) => (p && 'description' in p ? { ...p, description: travelerOfferText(p.description) } : p));
}
