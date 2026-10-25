// Answer pages — villas. Counts and from-rates are `{{villas:…}}` and
// `{{villaFrom:…}}` tokens resolved from data/villas-of-distinction.json at
// render (lib/seo/facts.mjs), reading the published nightly rate a villa card
// shows. A villa named by `villaFrom:name=…` that leaves the feed fails
// verify:seo rather than staying on the page. Sleeps and bedroom figures in the
// tables, and the worked example's ranges, are prose as of `updated`.

const UPDATED = "2026-10-25";

export const villaAnswers = [
  {
    slug: "best-caribbean-villas-for-12-guests",
    category: "Villas",
    question: "What are the best luxury villas in the Caribbean for 12+ guests?",
    title: "Best Caribbean Villas for 12+ Guests",
    description:
      "{{villas:region=Caribbean&sleepsMin=12}} Caribbean villas sleeping 12 or more, from {{villaFrom:region=Caribbean&sleepsMin=12}}/night — Turks & Caicos, the Dominican Republic, Barbados, Jamaica, St. Martin and beyond, with real from-rates and how to choose an island for a big group.",
    updated: UPDATED,
    capsule:
      "The Caribbean islands with the deepest inventory of villas sleeping 12 or more are Turks & Caicos, the Dominican Republic, Barbados and Jamaica, with St. Barths and St. Martin close behind; St. Martin and Martinique hold the best-priced big houses. For a dozen guests a villa routinely costs less per bedroom than two hotel rooms.",
    answer: [
      "Our villa atlas currently holds {{villas:region=Caribbean&sleepsMin=12}} Caribbean villas that sleep 12 or more guests, with published from-rates starting at {{villaFrom:region=Caribbean&sleepsMin=12}} a night — proof that a villa for a dozen people routinely costs less per bedroom than two hotel rooms. The islands with the deepest big-group inventory are Turks & Caicos ({{villas:destination=Turks %26 Caicos&sleepsMin=12}}), the Dominican Republic ({{villas:destination=Dominican Republic&sleepsMin=12}}), Barbados ({{villas:destination=Barbados&sleepsMin=12}}) and Jamaica ({{villas:destination=Jamaica&sleepsMin=12}}), with St. Barths and St. Martin close behind.",
      "For groups of twelve, the honest value shortlist from the data: Caribbean Heritage in Martinique (sleeps 12, 5 bedrooms, from {{villaFrom:name=Caribbean Heritage&destination=Martinique}}/night), La Maison L'Ile in St. Martin (sleeps 12, from {{villaFrom:name=La Maison L'Ile&destination=St. Martin}}), Colibri Cottage in St. Lucia (sleeps 12, from {{villaFrom:name=Colibri Cottage&destination=St. Lucia}}), Loblolly in the BVI (sleeps 14, from {{villaFrom:name=Loblolly&destination=British Virgin Islands}}), Casabella in Barbados (sleeps 12, from {{villaFrom:name=Casabella&destination=Barbados}}), and Alizee in St. Martin, which stretches to 18 guests from {{villaFrom:name=Alizee&destination=St. Martin}}. All are staffed or serviced, and all book through your advisor with the supplier's concierge included.",
    ],
    sections: [
      {
        h2: "The value math nobody runs",
        paras: [
          "Twelve guests at a luxury Caribbean resort means six rooms at $800–$1,500 each in season — $4,800–$9,000 a night before breakfast. The villas above land between {{villaFrom:name=Caribbean Heritage&destination=Martinique}} and about $1,000 a night total, with full kitchens, pools, and the option of a private chef at roughly $150–$300 a day plus groceries. Even tripling the villa budget for a marquee estate leaves margin for a chef, a boat day and a driver.",
          "What you trade: the resort's restaurants-and-towel-boy infrastructure. What you gain: one table big enough for everyone, nobody negotiating pool chairs, and grandparents with their own wing.",
        ],
      },
      {
        h2: "Big-group villas worth knowing, from the atlas",
        table: {
          caption: "Published from-rates (USD/night, whole villa), read live from the supplier feed — seasonal; holiday weeks price higher.",
          columns: ["Villa", "Island", "Sleeps", "Bedrooms", "From"],
          rows: [
            ["Caribbean Heritage", "Martinique", "12", "5", "{{villaFrom:name=Caribbean Heritage&destination=Martinique}}"],
            ["La Maison L'Ile", "St. Martin", "12", "6", "{{villaFrom:name=La Maison L'Ile&destination=St. Martin}}"],
            ["Colibri Cottage", "St. Lucia", "12", "6", "{{villaFrom:name=Colibri Cottage&destination=St. Lucia}}"],
            ["Loblolly", "British Virgin Islands", "14", "6", "{{villaFrom:name=Loblolly&destination=British Virgin Islands}}"],
            ["Casabella", "Barbados", "12", "6", "{{villaFrom:name=Casabella&destination=Barbados}}"],
            ["Villa Nirvana, Terres Basses", "St. Martin", "12", "6", "{{villaFrom:name=Villa Nirvana - Terres Basses&destination=St. Martin}}"],
            ["Alizee", "St. Martin", "18", "7", "{{villaFrom:name=Alizee&destination=St. Martin}}"],
            ["Tortuga B19", "Dominican Republic", "12", "5", "{{villaFrom:name=Tortuga B19&destination=Dominican Republic}}"],
            ["Coach House at Good Hope", "Jamaica", "14", "7", "{{villaFrom:name=Coach House at Good Hope&destination=Jamaica}}"],
          ],
        },
        paras: [
          "Above this tier, the Caribbean scales almost without limit — multi-villa compounds like Grand Cayman's Black Urchin estates sleep 40–88 for full family-reunion takeovers. If the group is 20+, we assemble compounds rather than single houses.",
        ],
      },
      {
        h2: "Picking the island for a group of twelve",
        list: [
          "St. Martin — with Martinique, the best-priced big houses in the region; two nations of restaurants, easy nonstops. The default answer for a value-minded group.",
          "Barbados — polished staff culture (most villas come cooked-for), calm west-coast swimming, direct flights from both coasts and London.",
          "St. Lucia — drama (Pitons, rainforest) at friendly pricing, but only a handful of houses sleep twelve: book early, and plan drivers for the winding roads.",
          "Dominican Republic / Jamaica — deep big-house inventory: Punta Cana estates (from {{villaFrom:destination=Dominican Republic&sleepsMin=12}} a night) and Montego Bay great houses (from {{villaFrom:destination=Jamaica&sleepsMin=12}}).",
          "BVI — sailing-centric groups; pair the villa with a day-charter catamaran.",
          "Turks & Caicos / Grand Cayman — the most big houses and the splurge tier: Grace Bay and Seven Mile beachfront estates from {{villaFrom:destination=Turks %26 Caicos&sleepsMin=12}} to well over $20,000 a night, for milestone events.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do these villas come with staff?",
        a: "Nearly all include housekeeping and a villa manager; Barbados and St. Lucia estates often include cooks. Private chefs, provisioning, boat days and spa calls are arranged through the villa concierge your booking includes.",
      },
      {
        q: "When should a 12-person group book?",
        a: "For February/March or holiday weeks: 9–12 months ahead — big villas are scarcer than hotel suites. Summer and late spring can book 3–5 months out at 25–40% below winter rates.",
      },
      {
        q: "How do deposits and payments work for groups?",
        a: "Typically 25–50% to hold, balance 60–90 days out, one contract — your advisor runs the split-payment diplomacy so the group chat doesn't have to.",
      },
    ],
    related: [
      { href: "/atlas/villa?region=Caribbean&sleeps=12", label: "Search all {{villas:region=Caribbean&sleepsMin=12}} Caribbean 12+ villas on the map" },
      { href: "/villas", label: "Every villa in the atlas, by destination" },
      { href: "/answers/villa-vs-resort-for-a-family-of-10", label: "Villa vs. resort for a family of 10 — the cost math" },
      { href: "/answers/best-villas-under-2000-that-sleep-8", label: "Best villas under $2,000 that sleep 8+" },
    ],
  },

  {
    slug: "villa-vs-resort-for-a-family-of-10",
    category: "Villas",
    question: "Villa or five-star resort for a family of 10 — which actually costs less?",
    title: "Villa vs. Five-Star Resort for a Family of 10: The Real Cost Math",
    description:
      "Running the real numbers on a 10-person family trip: five hotel rooms vs. one staffed villa, using live from-rates from {{collection:villa}} tracked villas — plus when the resort is still worth it.",
    updated: UPDATED,
    capsule:
      "For ten people the villa usually wins by a wide margin: five luxury-resort rooms at $700–$1,200 each run $3,500–$6,000 a night, while villas sleeping eight or more are widely available under $2,000 a night in total. Add a private chef at $200–$300 a day and the villa still lands at a third to a half of the resort bill.",
    answer: [
      "For ten people, the villa usually wins the arithmetic by a wide margin: five luxury-resort rooms at $700–$1,200 each run $3,500–$6,000 a night, while our atlas holds {{villas:sleepsMin=8&priceMax=2000}} villas that sleep eight or more for $2,000 a night or less in total — {{villas:sleepsMin=8&priceMax=1000}} of them at $1,000 or less. Add a private chef (roughly $200–$300/day plus groceries) and the villa still typically lands at a third to a half of the resort bill, with a kitchen, laundry, and no one sleeping on a rollaway.",
      "The resort wins on different axes: kids' clubs and instant friends for children, restaurants without decisions, service that materializes without being organized, and — non-trivially — nobody in the family is the de facto innkeeper. The honest answer is usually a split trip: villa for the together-time, two resort nights at the end for the towel-boy decompression.",
    ],
    sections: [
      {
        h2: "The worked example",
        table: {
          caption: "Seven nights, family of 10, high-season Caribbean. The villa column spans the published from-rates of the cheaper half of 6-bedroom Caribbean villas in the atlas, October 2026.",
          columns: ["", "Five-star resort (5 rooms)", "Staffed villa (6BR)"],
          rows: [
            ["Lodging", "$3,500–6,000/night → $24,500–42,000", "$1,100–2,250/night → $7,700–15,750"],
            ["Breakfast for 10", "$400–600/day → ~$3,500", "In the kitchen"],
            ["Chef + provisioning", "—", "~$250/day + ~$1,500 groceries → ~$3,250"],
            ["Dinners out (half the nights)", "Included in resort life? No — add $2,500+", "$1,500 (chef covers rest)"],
            ["Service/staff gratuities", "Resort fees + tips ~$1,500", "Villa staff gratuity ~$700–1,000"],
            ["Realistic week total", "$30,000–50,000", "$13,500–21,500"],
          ],
        },
        paras: [
          "Even generously salting the villa column with a boat day and a babysitter, the gap doesn't close. Where it does close: peak-festive weeks (villa minimums spike), groups that would have shared fewer hotel rooms, and destinations where five-star rates are soft (Mexico all-inclusives, shoulder-season Asia).",
        ],
      },
      {
        h2: "Choose by family, not by spreadsheet",
        list: [
          "Choose the villa when: three generations, toddlers with nap schedules, dietary chaos, a reunion where the point is one long table, or any group allergic to 7pm restaurant negotiations for ten.",
          "Choose the resort when: teenagers who need a scene, parents who want a real vacation from logistics, water-sports/kids-club dependence, or a family that's never traveled together and needs escape hatches.",
          "Choose both when: the budget freed by the villa week funds two resort nights — the pattern our returning families settle into almost universally.",
        ],
      },
    ],
    faqs: [
      {
        q: "Doesn't someone have to run the villa?",
        a: "That's what the villa manager and your advisor's pre-arrival planning are for: chef hired, fridge stocked, boat booked and babysitters vetted before you land. The failure mode is booking a bare villa with no plan — which is a rental, not a villa holiday.",
      },
      {
        q: "What about connecting rooms or a resort residence instead?",
        a: "Resort residences (the {{hotels:category=Villas / Residences}} villas/residences properties in our hotel atlas — Rocco Forte Private Villas at Verdura and kin) are exactly the hybrid: villa space with resort infrastructure. They price between the two columns and are the right answer for families who want both and will pay for it.",
      },
      {
        q: "Is a villa riskier — what if it's not as pictured?",
        a: "This is why the supplier matters. Our villa inventory is professionally managed and inspected (Villas of Distinction network), with local managers on call — not peer-to-peer listings. The advisor's job is knowing which houses photograph better than they live, and vice versa.",
      },
    ],
    related: [
      { href: "/answers/best-caribbean-villas-for-12-guests", label: "The Caribbean big-group shortlist with real rates" },
      { href: "/answers/best-villas-under-2000-that-sleep-8", label: "{{villas:sleepsMin=8&priceMax=2000}} villas under $2,000 that sleep 8+" },
      { href: "/atlas/villa", label: "Search the villa atlas map" },
      { href: "/villas", label: "Every villa in the atlas, by destination" },
    ],
  },

  {
    slug: "best-villas-under-2000-that-sleep-8",
    category: "Villas",
    question: "What are the best private villas under $2,000/night that sleep 8+?",
    title: "Best Villas Under $2,000/Night That Sleep 8+",
    description:
      "{{villas:sleepsMin=8&priceMax=2000}} villas at $2,000 a night or less sleeping eight or more — where they cluster (Hawaii, Colorado, Italy, St. Martin, Barbados) and how to pick well at this price point.",
    updated: UPDATED,
    capsule:
      "Villas that sleep eight or more under $2,000 a night are the sweet spot of the market, and the inventory clusters in Hawaii, Colorado ski country, Italy and the value Caribbean — St. Martin, Barbados and St. Barths — with Florida and France close behind. Per person per night that is a private staffed house below the price of a mid-tier hotel room.",
    answer: [
      "This is the sweetest spot in the villa market: our atlas currently lists {{villas:sleepsMin=8&priceMax=2000}} villas that sleep eight or more with from-rates of $2,000 a night or less — which per-person, per-night puts a private staffed house below a mid-tier hotel room. The inventory clusters where you'd hope: Hawaii ({{villas:destination=Hawaii&sleepsMin=8&priceMax=2000}} villas), Colorado ski country ({{villas:destination=Colorado&sleepsMin=8&priceMax=2000}} — Vail, Beaver Creek, Breckenridge), Italy ({{villas:destination=Italy&sleepsMin=8&priceMax=2000}} — Tuscany and points south), the Caribbean's value islands, led by St. Martin ({{villas:destination=St. Martin&sleepsMin=8&priceMax=2000}}), Barbados ({{villas:destination=Barbados&sleepsMin=8&priceMax=2000}}) and — at the style end — St. Barths ({{villas:destination=St. Barthélemy&sleepsMin=8&priceMax=2000}}), then Florida ({{villas:destination=Florida&sleepsMin=8&priceMax=2000}}) and France ({{villas:destination=France&sleepsMin=8&priceMax=2000}}).",
      "At this price the skill isn't finding a villa; it's filtering {{villas:sleepsMin=8&priceMax=2000}} of them. The three questions that do most of the work: walk-to-something or gated-privacy? staffed-daily or weekly-service? and — the one people skip — how far is the beach/lift/town in minutes, not miles.",
    ],
    sections: [
      {
        h2: "Where $2,000/night lands you, by destination",
        table: {
          caption: "Villas sleeping 8+ at $2,000/night or less, by destination, counted live from the atlas.",
          columns: ["Destination", "Villas available", "What the money buys"],
          rows: [
            ["Hawaii", "{{villas:destination=Hawaii&sleepsMin=8&priceMax=2000}}", "Big Island and Maui homes with pools; oceanfront needs timing or luck"],
            ["Colorado", "{{villas:destination=Colorado&sleepsMin=8&priceMax=2000}}", "4–6BR ski homes; ski-in/out enters the budget outside festive weeks"],
            ["Italy", "{{villas:destination=Italy&sleepsMin=8&priceMax=2000}}", "Tuscan/Umbrian farmhouses with pools; Amalfi at this price means hillside, not waterfront"],
            ["St. Martin", "{{villas:destination=St. Martin&sleepsMin=8&priceMax=2000}}", "Terres Basses and Orient Bay; the Caribbean's best villa value"],
            ["Barbados", "{{villas:destination=Barbados&sleepsMin=8&priceMax=2000}}", "Staffed west-coast houses — cooked breakfast included culture"],
            ["Florida", "{{villas:destination=Florida&sleepsMin=8&priceMax=2000}}", "30A, Keys and Orlando estates — the domestic easy button"],
            ["St. Barths", "{{villas:destination=St. Barthélemy&sleepsMin=8&priceMax=2000}}", "2–3BR design villas — bring fewer friends, better sunglasses"],
            ["France", "{{villas:destination=France&sleepsMin=8&priceMax=2000}}", "Provence and Côte d'Azur hinterland; Alps in summer are a steal"],
            ["Costa Rica / Croatia / Greece", "{{villas:destination=Costa Rica&sleepsMin=8&priceMax=2000}} / {{villas:destination=Croatia&sleepsMin=8&priceMax=2000}} / {{villas:destination=Greece&sleepsMin=8&priceMax=2000}}", "The rising class: new-build infinity-pool territory"],
          ],
        },
      },
      {
        h2: "How to pick well under $2,000",
        list: [
          "Spend on position, not bedrooms you won't use: a great 4BR beats a tired 6BR at the same rate.",
          "Shoulder seasons flip the market: the same Tuscan house is $1,100 in June and $1,900 in August; Caribbean May–June runs 30–40% under winter.",
          "Staff levels are the hidden differentiator — 'daily housekeeping + cook' vs. 'weekly clean' at identical rates. Ask, always.",
          "Check the from-rate's season: supplier from-rates are low-season anchors. Budget the quote, not the teaser.",
          "New-build Croatia, Costa Rica and Greece inventory often out-specs old-money islands at the same price — heated pools, gyms, cinema rooms.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I get beachfront under $2,000?",
        a: "Yes in St. Martin, Barbados (off-peak), Costa Rica and parts of Hawaii; rarely in St. Barths or Grace Bay in season. 'Three minutes' walk, ocean view' is where the value hides.",
      },
      {
        q: "Do these villas include a concierge?",
        a: "Yes — bookings through our supplier network include pre-arrival planning and an on-island manager: chefs, groceries, transfers, boats and babysitters arranged before you land.",
      },
      {
        q: "What's the catch versus a $5,000/night villa?",
        a: "Usually one of: location premium, architectural pedigree, full daily staff, or festive-week eligibility. The sleep-quality difference is smaller than the price difference — which is the entire thesis of this page.",
      },
    ],
    related: [
      { href: "/atlas/villa?sleeps=8&priceMax=2000", label: "Open the {{villas:sleepsMin=8&priceMax=2000}} on the villa atlas map" },
      { href: "/villas", label: "Every villa in the atlas, by destination" },
      { href: "/answers/best-caribbean-villas-for-12-guests", label: "Caribbean villas for 12+ guests" },
      { href: "/answers/villa-vs-resort-for-a-family-of-10", label: "Villa vs. resort cost math" },
    ],
  },
];
