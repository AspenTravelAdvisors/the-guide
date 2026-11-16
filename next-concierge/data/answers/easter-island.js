// Answer pages — Easter Island (Rapa Nui), written for the release of Martin
// McDonagh's Wild Horse Nine (Searchlight, US release 6 November 2026), which
// was filmed on the island and in Santiago.
//
// Departure dates and routings in the tables were read from the shipped feeds
// on `updated` and are prose, so they are a dated snapshot: when a departure
// leaves the feed, take its row out. The atlas links ("/atlas/cruise?port=…",
// "/atlas/jet?location=…") are live views and stay current on their own.
//
// The production has not published a list of filming locations. Every island
// site below is described as "reported", which is the honest word for it; do
// not upgrade one to "filmed at" without a primary source.

const UPDATED = "2026-11-16";

export const easterIslandAnswers = [
  {
    slug: "wild-horse-nine-filming-locations-easter-island",
    category: "Planning",
    question: "Where was Wild Horse Nine filmed, and can you visit the locations?",
    title: "Wild Horse Nine Filming Locations: How to Visit Easter Island (Rapa Nui) and Santiago",
    description:
      "Where Martin McDonagh's Wild Horse Nine was filmed on Easter Island and in Santiago, which moai sites you can visit, the park rules, where to stay, and how to get there by air, private jet, expedition cruise or world cruise.",
    updated: UPDATED,
    capsule:
      "Wild Horse Nine, Martin McDonagh's film about two CIA officers sent to Easter Island in 1973, was shot on Rapa Nui in early 2025 and finished in Santiago. The island sites most often reported, Ahu Tongariki, Rano Raraku and Tahai near Hanga Roa, are all open to visitors with a Rapa Nui National Park ticket and a licensed local guide.",
    answer: [
      "Wild Horse Nine is Martin McDonagh's black comedy for Searchlight Pictures. Sam Rockwell and John Malkovich play two CIA officers sent from Santiago to Easter Island in the days before Chile's September 1973 coup, with Steve Buscemi, Parker Posey, Tom Waits, Mariana di Girolamo and Ailín Salas. It premiered in competition at the Venice Film Festival on 3 September 2026 and opened in US cinemas on 6 November. Principal photography began on Rapa Nui in early 2025, moved to Santiago in April and wrapped on 28 April. The shoot was coordinated with Ma'u Henua, the Rapa Nui community body that manages the national park, with archaeologists supervising work at the sites.",
      "The production has not published a list of its island locations, so treat any list, including ours, as reported rather than confirmed. What is certain is that the landscape on screen is the island you can visit: the moai platforms, the quarry at Rano Raraku, the grass-covered volcanic slopes and the small town of Hanga Roa. Nearly everything worth seeing sits inside Rapa Nui National Park, a UNESCO World Heritage Site, and you see it with a licensed Rapa Nui guide. Three or four full days on the island covers the major sites without rushing. Base yourself at {{hotel:Explora Rapa Nui}} and spend a night in Santiago on the way, at the {{hotel:Mandarin Oriental, Santiago}} or {{hotel:The Ritz-Carlton, Santiago}}.",
    ],
    sections: [
      {
        h2: "The locations, and how confirmed each one is",
        table: {
          caption: "Island sites as reported in press and travel coverage of the shoot, early 2025. Santiago locations as reported in coverage of the production. The production itself has not published a list.",
          columns: ["Place", "Link to the film", "Visiting today"],
          rows: [
            ["Ahu Tongariki, south-east coast", "Reported by several outlets as the main island set-up", "The largest ceremonial platform on the island, with fifteen restored moai. Go at sunrise, when the sun comes up behind them."],
            ["Rano Raraku, the moai quarry", "Reported", "The volcano where the moai were carved, with hundreds still on its slopes. A park ticket allows one entry, so plan the visit with your guide."],
            ["Tahai and Hanga Roa", "Reported", "The island's only town and, at its edge, Tahai's restored platforms. The sunset spot, and an easy walk from town."],
            ["Central Santiago", "Filmed there in April 2025", "Allow a day. La Moneda, the presidential palace at the centre of the 1973 coup, and the Museum of Memory and Human Rights give the history behind the story."],
            ["Arturo Merino Benítez International Airport, Santiago", "Filmed there in April 2025", "Santiago's airport, and where scheduled flights to Easter Island leave from."],
            ["A rayuela club in Conchalí, Santiago", "Filmed there in April 2025", "A neighborhood club for rayuela, a traditional Chilean throwing game. Not a visitor site."],
          ],
        },
        paras: [
          "Some travel sites add Anakena, the island's white-sand beach with the moai of Ahu Nau Nau behind it, and other coastal platforms to their lists. We have not seen those confirmed. Whether or not the camera went there, Anakena belongs in any visit, along with Orongo, the ceremonial village of the birdman cult on the rim of the Rano Kau crater, and Ahu Akivi, where seven moai stand inland looking toward the sea.",
        ],
      },
      {
        h2: "The rules on the island",
        list: [
          "Every foreign visitor needs a Rapa Nui National Park ticket, valid for ten consecutive days. Buy it before you travel or when you arrive, and carry it with you.",
          "Most park sites can only be visited with a licensed local guide. A good guide is the best part of the trip.",
          "Rano Raraku and Orongo allow one entry each per ticket, so do not use that entry on a rushed visit.",
          "The ahu, the stone platforms, are sacred and are burial sites. Do not climb them or touch the moai. Guides and rangers enforce this.",
          "Chile requires every visitor to complete an online entry form before flying to the island, with a return ticket and a confirmed place to stay. Tourist stays are limited to 30 days.",
        ],
      },
      {
        h2: "Four ways to get there",
        table: {
          columns: ["How", "Time on the island", "Best for"],
          rows: [
            ["Scheduled flight from Santiago, about five hours, with a hotel stay", "As long as you like, within the 30-day limit", "Travelers who want three or four unhurried days and the film's landscapes at sunrise and sunset"],
            ["{{page:/answers/easter-island-by-private-jet|Round-the-world private jet journey}}", "Usually one or two days", "Seeing the island as one stop among many, with no commercial connections"],
            ["{{page:/answers/easter-island-expedition-cruises|Expedition cruise}}", "Usually two days anchored offshore, or two nights ashore before boarding with Lindblad", "Combining the island with Pitcairn, French Polynesia or the Chilean coast"],
            ["{{page:/answers/world-cruises-that-stop-at-easter-island|World cruise or segment}}", "Usually one or two days anchored offshore", "Travelers already crossing the Pacific by ship"],
          ],
        },
        paras: [
          "Ships cannot dock at Easter Island. They anchor and bring guests ashore by tender or Zodiac, and a heavy swell can cancel a landing. If the film is the reason for your trip, fly in and stay a few nights, or pair a voyage with nights on land.",
        ],
      },
    ],
    evidence: {
      h2: "Where to stay: our hotels in Chile",
      note: "Explora Rapa Nui is our hotel on the island itself. The Santiago hotels suit the night before or after the island flight, and the rest are in the Atacama and Patagonia for a longer Chile trip. We arrange the other hotels on the island, such as Nayara Hangaroa, directly.",
      query: "country=Chile",
      limit: 20,
    },
    faqs: [
      {
        q: "Can you visit the exact spots from the film?",
        a: "The island sites most often reported, Ahu Tongariki, Rano Raraku and Tahai, are all open to visitors with a park ticket, and most with a licensed guide. The production has not confirmed its locations, so no one can promise you are standing on the exact spot. You will be in the same landscape, and on an island this small, often in the same view.",
      },
      {
        q: "How many days do you need on Easter Island?",
        a: "Three or four full days covers the major sites: one for the south-east coast with Tongariki at sunrise and Rano Raraku, one for Anakena and the north, one for Orongo and Hanga Roa, and a spare day for weather or a second sunrise. With two days you will see the highlights, at a quicker pace.",
      },
      {
        q: "When is the best time to go?",
        a: "The island is mild all year. January to March is warmest and busiest, and early February brings the Tapati Rapa Nui festival, about two weeks of traditional sport, music and dance. Flights and the best rooms go early that month. April to June and September to November are quieter, with comfortable temperatures.",
      },
    ],
    related: [
      { href: "/answers/easter-island-by-private-jet", label: "Easter Island by private jet" },
      { href: "/answers/easter-island-expedition-cruises", label: "Expedition cruises that call at Easter Island" },
      { href: "/answers/world-cruises-that-stop-at-easter-island", label: "World cruises that stop at Easter Island" },
      { href: "/hotels/chile", label: "Every Chile hotel in the atlas" },
    ],
  },

  {
    slug: "easter-island-by-private-jet",
    category: "Planning",
    question: "Can you visit Easter Island by private jet?",
    title: "Easter Island by Private Jet: The Round-the-World Journeys That Land on Rapa Nui",
    description:
      "Which private jet journeys land on Easter Island, the island made famous again by Wild Horse Nine: National Geographic, Four Seasons and TCS World Travel, and Abercrombie & Kent departures for 2026 to 2028, with how the stop works and when a private charter makes sense.",
    updated: UPDATED,
    capsule:
      "Yes. Easter Island is a regular stop on round-the-world private jet journeys, usually between Peru and Tahiti or Samoa, with one or two days on the island. National Geographic, TCS World Travel (including the Four Seasons Private Jet) and Abercrombie & Kent all have departures that land at Mataveri airport. A fully private charter is also possible, with permits and handling arranged well ahead.",
    answer: [
      "Easter Island is about five hours' flying from Santiago and farther from almost anywhere else, and scheduled flights are few. A private jet journey removes that problem. The group flies in on its own aircraft, usually from Peru, and spends one or two days with local guides at the moai sites, often including sunrise at Ahu Tongariki, the setting most associated with Wild Horse Nine. Then the jet crosses the Pacific to Tahiti, Samoa or New Zealand. It is the only practical way to put Machu Picchu, Easter Island and the South Pacific into the same week.",
      "Our atlas lists the departures that call there in {{page:/atlas/jet?location=Easter+Island|one view of the jet atlas}}. They come from three operators. {{op:jet/National Geographic}} flies a Boeing 757 with up to 75 guests and gives the island two days. {{op:jet/TCS World Travel}} runs its own round-the-world programs and operates the Four Seasons Private Jet. {{op:jet/Abercrombie & Kent}} includes the island on its Seven Continents journey.",
    ],
    sections: [
      {
        h2: "Private jet departures that land on Easter Island",
        table: {
          caption: "From the jet atlas on 16 November 2026. On-request journeys run on dates set with the operator. Prices for the National Geographic and Four Seasons programs are in our private jet explainer.",
          columns: ["Operator", "Journey", "Departures", "Days", "Before and after the island"],
          rows: [
            ["TCS World Travel", "{{page:/journeys/jet/tcs-world-travel-seven-continents-the-ultimate-around-the-world-journey-by-private-jet|Seven Continents: The Ultimate Around the World Journey}}", "27 Dec 2026; 30 Dec 2027", "29", "Peru (Pisco) to Easter Island to Tahiti"],
            ["National Geographic", "{{page:/journeys/jet/national-geographic-around-the-world-by-private-jet|Around the World by Private Jet}}", "1 Jan, 30 Mar and 26 Oct 2027", "26", "Cusco for Machu Picchu, or Trujillo, to two days on Easter Island, then across the date line to Samoa"],
            ["Four Seasons Private Jet, operated by TCS World Travel", "{{page:/journeys/jet/tcs-world-travel-ancient-explorer-i-a-four-seasons-private-jet-experience|Ancient Explorer I}}", "3 Sep 2027", "23", "Mexico City to Easter Island to Bora Bora"],
            ["Abercrombie & Kent", "{{page:/journeys/jet/abercrombie-and-kent-the-seven-continents-by-private-jet-one-extraordinary-world|The Seven Continents by Private Jet: One Extraordinary World}}", "3 Jan 2028", "28", "Iguazú Falls to Easter Island to Auckland"],
            ["TCS World Travel", "{{page:/journeys/jet/tcs-world-travel-around-the-world-by-private-jet-the-signature-expedition|Around the World by Private Jet: The Signature Expedition}}", "On request", "25", "Peru (Pisco) to Easter Island to Tahiti or Moorea"],
            ["TCS World Travel", "{{page:/journeys/jet/tcs-world-travel-around-the-world-a-luxury-tour-by-private-jet|Around the World: A Luxury Tour by Private Jet}}", "On request", "24", "Cusco and Pisco to Easter Island to Papeete"],
          ],
        },
        paras: [
          "The December 2026 Seven Continents departure leaves in about six weeks. Seats on a departure that close are rare, but they do come back when someone cancels, so it is worth asking. For everything else, a year ahead is normal. These journeys sell on a small number of seats, and the same guests often return.",
        ],
      },
      {
        h2: "How the stop works",
        paras: [
          "The jet lands at Mataveri International Airport on the edge of Hanga Roa. Its runway is one of the longest in the Pacific, because NASA lengthened it in the 1980s as an emergency landing site for the Space Shuttle. A long-range aircraft has no trouble with it. Guests transfer straight to their hotel, and the operator's team arranges the park tickets and licensed Rapa Nui guides that every visitor needs.",
          "With one day you see the essentials: Ahu Tongariki, the quarry at Rano Raraku and the beach at Anakena. With two days you add Orongo on the crater rim, Ahu Akivi and a sunset at Tahai, and you can see Tongariki at sunrise without rushing breakfast. If the island is the reason you are traveling, choose a journey with two days.",
        ],
      },
      {
        h2: "A fully private charter",
        paras: [
          "A private charter to Easter Island is possible on a long-range business jet, usually from Santiago or from Tahiti. Landing permission, ground handling and fuel are arranged weeks ahead, because the island is a long way from any alternative airport and its fuel arrives by ship. The arrival paperwork is the same as for anyone else: Chile's online entry form, a confirmed place to stay and a park ticket. A charter makes most sense for a group or a family that wants three or four nights at {{hotel:Explora Rapa Nui}}, which no group journey offers.",
        ],
      },
    ],
    faqs: [
      {
        q: "How long do private jet journeys stay on Easter Island?",
        a: "National Geographic's Around the World by Private Jet gives the island two days. Other journeys vary, so read the day-by-day itinerary before you book, because the difference between one day and two is the difference between the highlights and the island.",
      },
      {
        q: "Which private jet journey is best for Easter Island?",
        a: "For the island itself, National Geographic's two days and its archaeologists and photographers make the strongest case. For the hotels and service across the whole trip, the Four Seasons Private Jet. For the widest sweep, with all seven continents, TCS World Travel's Seven Continents or Abercrombie & Kent's version.",
      },
      {
        q: "Can I add extra nights on Easter Island to a private jet journey?",
        a: "Not usually, because the jet moves the whole group on together. The common answer is to fly to the island on a scheduled flight from Santiago a few days before the group arrives, then join the journey there or at the next stop. It needs careful timing, and it is worth having an advisor arrange it with the operator.",
      },
    ],
    related: [
      { href: "/atlas/jet?location=Easter+Island", label: "Every private jet departure that lands on Easter Island" },
      { href: "/answers/private-jet-journeys-explained", label: "Private jet journeys explained, with prices" },
      { href: "/answers/wild-horse-nine-filming-locations-easter-island", label: "Wild Horse Nine filming locations" },
      { href: "/answers/world-cruises-that-stop-at-easter-island", label: "The slower way: world cruises that stop at Easter Island" },
    ],
  },

  {
    slug: "easter-island-expedition-cruises",
    category: "Expedition",
    question: "Which expedition cruises visit Easter Island?",
    title: "Easter Island Expedition Cruises: Lindblad, Seabourn and Silversea Compared",
    description:
      "The expedition voyages that call at Easter Island, where Wild Horse Nine was filmed: Lindblad's National Geographic Resolution, Seabourn Pursuit and Silversea's Silver Cloud, with routes, departures, how landings work and which voyage gives you the most time ashore.",
    updated: UPDATED,
    capsule:
      "Three expedition lines in our atlas call at Easter Island: Lindblad-National Geographic on National Geographic Resolution, Seabourn on Seabourn Pursuit and Silversea on Silver Cloud. Most voyages link the island with Pitcairn and French Polynesia or with Chile's offshore islands, and schedule two days at anchor. Lindblad's Easter Island to Tahiti voyage adds two nights in a hotel on the island before boarding.",
    answer: [
      "Easter Island lies in the middle of one of the emptiest stretches of the Pacific, and expedition ships reach it on long positioning voyages between Chile and Tahiti. Those voyages are some of the most interesting in the expedition calendar. Along with Rapa Nui, they call at Pitcairn, home of the descendants of the Bounty mutineers, at uninhabited Ducie or Henderson, at Mangareva in French Polynesia, and at the Juan Fernández Islands off Chile, where Alexander Selkirk was marooned. The island where Wild Horse Nine was filmed is the high point, but rarely the only reason to go.",
      "The thing to understand is how you land. No ship can dock at Easter Island. Expedition ships anchor off Hanga Roa, or move round the island in search of shelter, and take guests ashore by Zodiac or tender. A strong swell can cancel a landing, which is why nearly every voyage below gives the island two days. {{op:cruise/National Geographic-Lindblad Expeditions|Lindblad}} goes further on its Easter Island to Tahiti voyage: guests fly in from Santiago and spend two nights in a hotel on the island before boarding, so the moai do not depend on the sea.",
    ],
    sections: [
      {
        h2: "The voyages, line by line",
        table: {
          caption: "From the expedition atlas on 16 November 2026. Easter Island days are the scheduled calls; landings depend on weather.",
          columns: ["Line and ship", "Voyage", "Route", "Days", "Departures"],
          rows: [
            ["Lindblad-National Geographic, National Geographic Resolution", "{{page:/journeys/cruise/national-geographic-lindblad-expeditions-easter-island-to-tahiti-tales-of-the-pacific|Easter Island to Tahiti: Tales of the Pacific}}", "Santiago, two nights on Easter Island, then Pitcairn and Henderson to Papeete", "17", "24 Mar 2027; 3 Apr 2028"],
            ["Lindblad-National Geographic, National Geographic Resolution", "{{page:/journeys/cruise/national-geographic-lindblad-expeditions-chile-s-wild-pacific-patagonia-juan-fernandez-and-easter-island|Chile's Wild Pacific: Patagonia, Juan Fernández and Easter Island}}", "Puerto Montt to Robinson Crusoe and Alexander Selkirk islands, two days at Easter Island, then fly to Santiago", "16", "19 Mar 2028"],
            ["Seabourn, Seabourn Pursuit", "{{page:/journeys/cruise/seabourn-easter-and-pitcairn-islands-marooned-moai-and-mutineers|Easter and Pitcairn Islands: Marooned, Moai, and Mutineers}}", "San Antonio (for Santiago) to Juan Fernández, Easter Island, Ducie and Pitcairn to Papeete", "19", "7 Apr and 29 Sep 2027"],
            ["Seabourn, Seabourn Pursuit", "{{page:/journeys/cruise/seabourn-chilean-fjords-easter-island-and-pitcairn-islands|Chilean Fjords, Easter Island, and Pitcairn Islands}}", "Buenos Aires through the Chilean fjords to the Juan Fernández Islands, Easter Island and Pitcairn, ending in Papeete. A 44-day version adds Antarctica", "34", "23 Mar 2027 (44-day version 13 Mar 2027)"],
            ["Silversea, Silver Cloud", "{{page:/journeys/cruise/silversea-south-pacific-exploring-easter-island-and-french-polynesia|South Pacific: Exploring Easter Island and French Polynesia}}", "Valparaíso to Robinson Crusoe Island, two days at Easter Island, Pitcairn and Mangareva to Papeete", "22", "10 Mar 2027; 11 Mar 2028"],
            ["Silversea, Silver Cloud", "{{page:/journeys/cruise/silversea-south-pacific-exploring-french-polynesia-and-easter-island|South Pacific: Exploring French Polynesia and Easter Island}}", "The same route in reverse, Papeete to Valparaíso", "23", "23 Oct 2027; 23 Oct 2028"],
            ["Silversea, Silver Cloud", "{{page:/journeys/cruise/silversea-chile-exploring-chilean-fjords-and-easter-island|Chile: Exploring Chilean Fjords and Easter Island}}", "Puerto Williams through the fjords to the Juan Fernández Islands and Easter Island, ending in Papeete", "34", "29 Feb 2028"],
          ],
        },
        paras: [
          "Seabourn Pursuit also calls at Easter Island on its long Pacific crossings in August and September 2027, from Australia or Fiji to Chile and on to Antarctica. Silver Cloud's South Pacific and Antarctica voyage of October 2028 does the same. The {{page:/atlas/cruise?port=Easter+Island%2C+Chile|cruise atlas filtered to Easter Island}} shows the Seabourn and Silversea departures together, and {{page:/atlas/cruise?port=Hanga+Roa%2C+Chile|this view}} shows Lindblad's.",
        ],
      },
      {
        h2: "Which voyage suits whom",
        list: [
          "The most certain time on the island: Lindblad's Easter Island to Tahiti voyage, because the two island nights are on land before the ship sails. It is the only one in the table where the swell cannot take the moai away from you.",
          "The most complete South Pacific crossing: Silversea's Valparaíso to Papeete voyages, with Robinson Crusoe Island, Easter Island, Pitcairn and Mangareva in three weeks.",
          "The grandest scale: Seabourn's 34- and 44-day voyages from Buenos Aires, which sail the Chilean fjords, with Antarctica on the longer one, before turning out into the Pacific.",
          "The shortest: Seabourn's 19-day Marooned, Moai, and Mutineers from San Antonio, near Santiago, which suits travelers who want the remote islands without the fjords.",
        ],
      },
    ],
    faqs: [
      {
        q: "What happens if the ship cannot land at Easter Island?",
        a: "The captain waits for better conditions, tries another anchorage on the sheltered side of the island, or uses the second scheduled day. If no landing is possible, the call is missed. Expedition lines do not usually refund a missed landing caused by weather. This is why the voyages that give the island two days, or Lindblad's hotel nights ashore, are worth choosing.",
      },
      {
        q: "Do I need a park ticket if I arrive by ship?",
        a: "Yes. Every foreign visitor needs a Rapa Nui National Park ticket and most sites need a licensed guide. Expedition lines arrange both as part of their shore program.",
      },
      {
        q: "When do the voyages run?",
        a: "Most sail between late February and April, at the end of the southern summer, or in September and October. Those windows match the ships' moves between Antarctica, the Chilean fjords and the South Pacific, so each voyage usually runs once or twice a year.",
      },
    ],
    related: [
      { href: "/atlas/cruise?port=Easter+Island%2C+Chile", label: "Expedition departures calling at Easter Island" },
      { href: "/answers/wild-horse-nine-filming-locations-easter-island", label: "Wild Horse Nine filming locations" },
      { href: "/answers/ponant-vs-lindblad-vs-silversea-expeditions", label: "Lindblad, Silversea and Ponant compared" },
      { href: "/answers/world-cruises-that-stop-at-easter-island", label: "World cruises that stop at Easter Island" },
    ],
  },

  {
    slug: "world-cruises-that-stop-at-easter-island",
    category: "Voyages",
    question: "Which world cruises stop at Easter Island?",
    title: "World Cruises That Stop at Easter Island, 2027 to 2029",
    description:
      "The world cruises and long segments that call at Easter Island, the setting of Wild Horse Nine: Seabourn, Crystal, Azamara, Holland America, Oceania, Regent, Explora Journeys and Princess, with how many days each gives the island and the shorter segments that include it.",
    updated: UPDATED,
    capsule:
      "Easter Island sits on the South Pacific crossing many world cruises make between Peru or Chile and French Polynesia. Seabourn, Crystal and Azamara give the island two days, which matters because ships anchor offshore and swell can cancel a landing. Holland America, Oceania, Regent, Explora Journeys and Princess give it one. Most of these voyages also sell the Pacific crossing as a shorter segment.",
    answer: [
      "A world cruise that sails from the Americas toward Australia often takes the southern route across the Pacific: down the coast of Peru, across open ocean to Easter Island, then on to Pitcairn and French Polynesia. For many passengers it is the stop they remember best from four months at sea, and since Wild Horse Nine it is one more people are asking about. Our atlas shows every world cruise departure that calls there in {{page:/atlas/worldcruise?port=Easter+Island%2C+Chile|one view}}, and the Crystal, Oceania and Regent sailings, which list the stop as Hanga Roa, in {{page:/atlas/worldcruise?port=Hanga+Roa%2C+Chile|another}}.",
      "The detail that separates these voyages is the number of days at the island. Large ships anchor off Hanga Roa and run tenders to the small harbor, and on a day of heavy swell they cannot land anyone. With two scheduled days the odds improve a good deal. If Easter Island is the reason you are choosing a world cruise, give that more weight than the ship or the length of the voyage.",
    ],
    sections: [
      {
        h2: "World cruises that call at Easter Island",
        table: {
          caption: "From the world cruise atlas on 16 November 2026. Days at Easter Island are scheduled calls.",
          columns: ["Line and ship", "Voyage", "Sails", "Days at Easter Island", "Shorter segments with the island"],
          rows: [
            ["Seabourn, Seabourn Quest", "{{page:/journeys/worldcruise/seabourn-world-cruise-australia-and-south-pacific-panorama-146-days|World Cruise: Australia and South Pacific Panorama}}", "5 Jan 2027, Miami, 127 or 146 days", "2", "{{page:/journeys/worldcruise/seabourn-world-cruise-panama-canal-polynesia-and-new-zealand-64-days|Miami to Sydney, 64 days}}"],
            ["Seabourn, Seabourn Quest", "{{page:/journeys/worldcruise/seabourn-cape-to-cape-world-cruise-miami-to-southampton-121-days|Cape to Cape World Cruise}}", "7 Jan 2028, Miami, 113 or 121 days", "2", "{{page:/journeys/worldcruise/seabourn-panama-canal-chilean-fjords-antarctica-and-falklands-58-days|Miami to Buenos Aires by Antarctica, 58 days}}"],
            ["Seabourn, Seabourn Quest", "{{page:/journeys/worldcruise/seabourn-world-cruise-iconic-islands-and-remote-horizons-140-days|World Cruise: Iconic Islands and Remote Horizons}}", "7 Jan 2029, Miami, 140 days", "2", "{{page:/journeys/worldcruise/seabourn-world-cruise-south-america-and-south-pacific-islands-48-days|Miami to Auckland, 48 days}}"],
            ["Crystal, Crystal Serenity", "{{page:/journeys/worldcruise/crystal-san-diego-to-vancouver-140-days|San Diego to Vancouver}}", "8 Jan 2027, 140 days", "2", "—"],
            ["Crystal, Crystal Symphony", "{{page:/journeys/worldcruise/crystal-roundtrip-fort-lauderdale-152-days|Roundtrip Fort Lauderdale}}", "11 Jan 2028, 152 days", "2", "{{page:/journeys/worldcruise/crystal-fort-lauderdale-to-singapore-87-days|Fort Lauderdale to Singapore, 87 days}}"],
            ["Azamara, Azamara Onward", "{{page:/journeys/worldcruise/azamara-2028-world-cruise-177-days|2028 World Cruise}}", "5 Jan 2028, Miami, 177 days", "2", "{{page:/journeys/worldcruise/azamara-miami-to-sydney-grand-voyage-57-days|Miami to Sydney, 57 days}}"],
            ["Holland America, Volendam", "{{page:/journeys/worldcruise/holland-america-grand-world-voyage-131-days|Grand World Voyage}}", "5 Jan 2027 and 4 Jan 2028, Fort Lauderdale, 131 days", "1", "{{page:/journeys/worldcruise/holland-america-grand-world-voyage-48-days|San Antonio, Chile to Singapore, 48 days}} (2028)"],
            ["Oceania, Aurelia", "{{page:/journeys/worldcruise/oceania-cruises-around-the-world-in-180-days-182-days|Around the World in 180 Days}}", "6 Jan 2029, Los Angeles, 182 days", "1", "—"],
            ["Regent Seven Seas, Seven Seas Mariner", "{{page:/journeys/worldcruise/regent-seven-seas-eras-of-exploration-miami-to-civitavecchia-151-days|Eras of Exploration}}", "6 Jan 2029, Miami, 151 days", "1", "—"],
            ["Explora Journeys, EXPLORA I", "{{page:/journeys/worldcruise/explora-journeys-endless-worlds-a-108-day-inaugural-world-journey-109-days|Endless Worlds}}", "6 Jan 2029, Dubai, 109 to 129 days", "1", "—"],
            ["Princess, Grand Princess", "{{page:/journeys/worldcruise/princess-cruises-grand-world-odyssey-roundtrip-sydney-130-days|Grand World Odyssey}}", "May 2029, from Australia, 124 to 141 days", "1", "{{page:/journeys/worldcruise/princess-cruises-grand-world-odyssey-liner-dover-to-sydney-68-days|Dover to Sydney, 68 days}}"],
          ],
        },
        paras: [
          "Seabourn Pursuit, Seabourn's expedition ship, also crosses from Australia or Fiji to Chile in August and September 2027 with two Easter Island days. Those voyages are covered with the expedition cruises.",
        ],
      },
      {
        h2: "Taking only the Pacific crossing",
        paras: [
          "Four months is more than most people can give. The good news is that the Easter Island crossing usually falls in the first two months of a January world cruise, so it is often sold as the first segment: Miami or Fort Lauderdale through the Panama Canal, down the coast of Peru, across to Easter Island and Polynesia, ending in Sydney or Auckland. Holland America's 2028 segment joins in San Antonio, the port for Santiago, which makes it possible to spend a few days in the city first.",
          "A segment is booked like any cruise. The fares on the full voyage often carry extras, such as included air or credit, which segments may not, so compare the per-day cost and what is included rather than the headline fare. {{page:/answers/world-cruise-segments-explained|Our segments explainer}} covers how that works.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will a world cruise definitely land at Easter Island?",
        a: "No. Large ships anchor offshore and tender guests to Hanga Roa, and a heavy swell can stop that for a day or more. Two scheduled days, as on Seabourn, Crystal and Azamara, give a much better chance than one. If seeing the island matters more than the rest of the cruise, fly in from Santiago and stay a few nights instead.",
      },
      {
        q: "What can you see in one day ashore?",
        a: "With a licensed guide, which the island requires at most sites: Ahu Tongariki, the quarry at Rano Raraku and Anakena beach make a full day. On a day when a large ship is in, guides and vehicles are in demand, so book the ship's tour or a private guide early.",
      },
      {
        q: "Which world cruise is best for Easter Island?",
        a: "For time on the island, one of the two-day calls on Seabourn, Crystal or Azamara. For the most complete Pacific crossing in a shorter trip, a segment ending in Sydney or Auckland. For an expedition-style visit with Zodiac landings at Pitcairn and Ducie as well, Seabourn Pursuit's 2027 crossings.",
      },
    ],
    related: [
      { href: "/atlas/worldcruise?port=Easter+Island%2C+Chile", label: "World cruises calling at Easter Island" },
      { href: "/answers/world-cruises-compared", label: "World cruises compared, line by line" },
      { href: "/answers/easter-island-expedition-cruises", label: "Expedition cruises that call at Easter Island" },
      { href: "/answers/wild-horse-nine-filming-locations-easter-island", label: "Wild Horse Nine filming locations" },
    ],
  },
];
