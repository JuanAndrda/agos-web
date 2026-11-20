// crops.js: our crop catalog, the ONE list of crops the whole app uses.
// - The server checks every new listing against it (listings.js).
// - psa.js asks PSA for the prices of exactly these crops.
// - React gets the list from GET /api/crops, so the crop picker, the Market Prices page and the
//   Marketplace all show the same names and categories. Nothing in React has its own crop list.
//
// To add a crop later: add ONE line in the right category below and restart the server.
//   name    = what people see in the app (keep it short and clear)
//   psaName = PSA's own name for it, copied EXACTLY from PSA OpenSTAT (or the price won't match)
//   popular = true for the 10 crops shown first on the Home page
//
// 104 crops: the Iloilo vegetables and fruits that PSA has prices for (checked on 2026-11-20).
// Left out on purpose: "Mango, Other Variety" and "Banana, Other Variety" (catch-all groups,
// not real crops), "Cassava for industrial use" (sold to factories) and Broccoli (no Iloilo
// price since June 2024).
// The first 10 names (Tomato, Carrots, Eggplant, ...) are the same as before, so every listing
// that is already in the database still matches a crop.

// Each category is one PSA farmgate price table, so a crop's category also tells psa.js which
// table to ask. They are in the order the crop picker shows them.
export const CATEGORIES = [
  { name: "Fruit vegetables", table: "NFG/0032M4AFN05.px" },
  { name: "Leafy vegetables", table: "NFG/0032M4AFN06.px" },
  { name: "Root crops", table: "NFG/0032M4AFN02.px" },
  { name: "Condiments", table: "NFG/0032M4AFN04.px" },
  { name: "Beans", table: "NFG/0032M4AFN03.px" },
  { name: "Fruits", table: "NFG/0032M4AFN07.px" },
];

export const CROPS = [
  // ---- Fruit vegetables (PSA table 05) ----
  { name: "Tomato", category: "Fruit vegetables", psaName: "Tomato", popular: true },
  { name: "Eggplant", category: "Fruit vegetables", psaName: "Eggplant, long, purple", popular: true },
  { name: "Ampalaya", category: "Fruit vegetables", psaName: "Ampalaya fruit [Bitter gourd]", popular: true },
  { name: "Squash", category: "Fruit vegetables", psaName: "Squash fruit", popular: true },
  { name: "Okra", category: "Fruit vegetables", psaName: "Okra [Lady's finger]", popular: true },
  { name: "Eggplant (native round)", category: "Fruit vegetables", psaName: "Eggplant, native, round" },
  { name: "Cucumber", category: "Fruit vegetables", psaName: "Cucumber" },
  { name: "Chayote", category: "Fruit vegetables", psaName: "Chayote fruit" },
  { name: "Upo", category: "Fruit vegetables", psaName: "Upo [Bottle gourd]" },
  { name: "Patola (native)", category: "Fruit vegetables", psaName: "Patola, Native" },
  { name: "Patola (Baguio)", category: "Fruit vegetables", psaName: "Patola, Baguio" },
  { name: "Green papaya", category: "Fruit vegetables", psaName: "Papaya, green" },
  { name: "Young jackfruit", category: "Fruit vegetables", psaName: "Jackfruit, young" },
  { name: "Banana blossom", category: "Fruit vegetables", psaName: "Banana Blossom" },

  // ---- Leafy vegetables (PSA table 06) ----
  { name: "Cabbage", category: "Leafy vegetables", psaName: "Cabbage", popular: true },
  { name: "Pechay", category: "Leafy vegetables", psaName: "Pechay, native", popular: true },
  { name: "Kangkong", category: "Leafy vegetables", psaName: "Kangkong [Swamp cabbage]", popular: true },
  { name: "Pechay Baguio", category: "Leafy vegetables", psaName: "Chinese cabbage (Wongbok, Pechay Baguio)" },
  { name: "Alugbati", category: "Leafy vegetables", psaName: "Alugbati" },
  { name: "Malunggay", category: "Leafy vegetables", psaName: "Malunggay leaves" },
  { name: "Saluyot", category: "Leafy vegetables", psaName: "Saluyot" },
  { name: "Camote tops", category: "Leafy vegetables", psaName: "Camote tops" },
  { name: "Squash tops", category: "Leafy vegetables", psaName: "Squash tops" },
  { name: "Gabi leaves", category: "Leafy vegetables", psaName: "Gabi, leaves with stem" },
  { name: "Mustard", category: "Leafy vegetables", psaName: "Mustard" },
  { name: "Chili leaves", category: "Leafy vegetables", psaName: "Chili pepper leaves" },
  { name: "Lettuce", category: "Leafy vegetables", psaName: "Lettuce" },
  { name: "Cauliflower", category: "Leafy vegetables", psaName: "Cauliflower" },
  { name: "Asparagus", category: "Leafy vegetables", psaName: "Asparagus" },

  // ---- Root crops (PSA table 02) ----
  { name: "Carrots", category: "Root crops", psaName: "Carrot", popular: true },
  { name: "Camote", category: "Root crops", psaName: "Camote [Sweet potato]" },
  { name: "Cassava", category: "Root crops", psaName: "Cassava for food, fresh tubers" },
  { name: "Ubi", category: "Root crops", psaName: "Ubi [Greater yam]" },
  { name: "Radish", category: "Root crops", psaName: "Radish" },
  { name: "Gabi (Cebu)", category: "Root crops", psaName: "Gabi for ginataan, Cebu [Taro]" },
  { name: "Gabi (Tagalog)", category: "Root crops", psaName: "Gabi for sinigang, Tagalog [Taro]" },
  { name: "Pao galiang", category: "Root crops", psaName: "Pao Galiang" },

  // ---- Condiments (PSA table 04) ----
  { name: "Onion", category: "Condiments", psaName: "Onion, red creole (Bermuda red)", popular: true },
  { name: "Shallot", category: "Condiments", psaName: "Onion, red shallot (Sibuyas Tagalog)" },
  { name: "Garlic", category: "Condiments", psaName: "Garlic, dried bulb" },
  { name: "Spring onion", category: "Condiments", psaName: "Spring onion" },
  { name: "Siling labuyo", category: "Condiments", psaName: "Chili pepper fruit (Siling labuyo)" },
  { name: "Finger pepper", category: "Condiments", psaName: "Pepper, finger" },
  { name: "Bell pepper", category: "Condiments", psaName: "Pepper, bell" },
  { name: "Ginger (native)", category: "Condiments", psaName: "Ginger, Native" },
  { name: "Ginger (Hawaiian)", category: "Condiments", psaName: "Ginger, Hawaiian" },
  { name: "Leeks", category: "Condiments", psaName: "Onion Leeks" },

  // ---- Beans (PSA table 03) ----
  { name: "Sitao", category: "Beans", psaName: "Sitao [Stringbeans]" },
  { name: "Snap beans", category: "Beans", psaName: "Habitchuelas [Snap beans]" },
  { name: "Sigarilyas", category: "Beans", psaName: "Sigarilyas [Winged beans]" },
  { name: "Kadios", category: "Beans", psaName: "Kadios [Pigeon pea]" },
  { name: "Mongo (green, labo)", category: "Beans", psaName: "Mongo [Mungbean], green, labo" },
  { name: "Mongo (green, shiny)", category: "Beans", psaName: "Mongo [Mungbean], green, shiny" },
  { name: "Mongo (yellow, shiny)", category: "Beans", psaName: "Mongo [Mungbean], yellow, shiny" },
  { name: "Peanut (dry)", category: "Beans", psaName: "Peanut, with shell, dry" },
  { name: "Peanut (fresh)", category: "Beans", psaName: "Peanut, with shell, fresh" },
  { name: "Patani", category: "Beans", psaName: "Patani [Lima beans]" },

  // ---- Fruits (PSA table 07) ----
  { name: "Mango (Carabao)", category: "Fruits", psaName: "Mango Carabao, green" },
  { name: "Mango (Piko)", category: "Fruits", psaName: "Mango Piko, green" },
  { name: "Mango (Indian)", category: "Fruits", psaName: "Mango Indian, green" },
  { name: "Banana (Saba)", category: "Fruits", psaName: "Banana Saba, green" },
  { name: "Banana (Lakatan)", category: "Fruits", psaName: "Banana Lakatan, green" },
  { name: "Banana (Latundan)", category: "Fruits", psaName: "Banana Latundan, green" },
  { name: "Banana (Bungulan)", category: "Fruits", psaName: "Banana Bungulan, green" },
  { name: "Banana (Cavendish)", category: "Fruits", psaName: "Banana Cavendish" },
  { name: "Calamansi", category: "Fruits", psaName: "Calamansi" },
  { name: "Pineapple (Hawaiian)", category: "Fruits", psaName: "Pineapple Hawaiian" },
  { name: "Pineapple (native)", category: "Fruits", psaName: "Pineapple native" },
  { name: "Pineapple (Formosa)", category: "Fruits", psaName: "Pineapple Formosa" },
  { name: "Papaya (Hawaiian)", category: "Fruits", psaName: "Papaya Hawaiian" },
  { name: "Papaya (Solo)", category: "Fruits", psaName: "Papaya Solo" },
  { name: "Papaya (native)", category: "Fruits", psaName: "Papaya native" },
  { name: "Pomelo", category: "Fruits", psaName: "Pomelo" },
  { name: "Rambutan", category: "Fruits", psaName: "Rambutan" },
  { name: "Avocado", category: "Fruits", psaName: "Avocado" },
  { name: "Atis", category: "Fruits", psaName: "Atis [Sugarapple]" },
  { name: "Guyabano", category: "Fruits", psaName: "Guayabano [Soursop]" },
  { name: "Chico", category: "Fruits", psaName: "Chico [Sapota]" },
  { name: "Dragon fruit", category: "Fruits", psaName: "Dragon fruit" },
  { name: "Duhat", category: "Fruits", psaName: "Duhat" },
  { name: "Ripe jackfruit", category: "Fruits", psaName: "Jackfruit, ripe" },
  { name: "Marang", category: "Fruits", psaName: "Marang" },
  { name: "Muskmelon", category: "Fruits", psaName: "Muskmelon" },
  { name: "Santol", category: "Fruits", psaName: "Santol native" },
  { name: "Tambis", category: "Fruits", psaName: "Tambis" },
  { name: "Camachile", category: "Fruits", psaName: "Camatchili" },
  { name: "Lemon", category: "Fruits", psaName: "Lemon" },
  { name: "Orange", category: "Fruits", psaName: "Orange" },
  { name: "Sineguelas", category: "Fruits", psaName: "Siniguelas [Jamaica plum]" },
  { name: "Starapple", category: "Fruits", psaName: "Starapple" },
  { name: "Watermelon", category: "Fruits", psaName: "Watermelon" },
  { name: "Grapes (green)", category: "Fruits", psaName: "Grapes, green" },
  { name: "Grapes (red)", category: "Fruits", psaName: "Grapes, red" },
  { name: "Honeydew melon", category: "Fruits", psaName: "Honeydew melon" },
  { name: "Golden melon", category: "Fruits", psaName: "Golden Melon" },
  { name: "Mandarin (Szinkom)", category: "Fruits", psaName: "Mandarin Szinkom" },
  { name: "Mandarin (Ladu)", category: "Fruits", psaName: "Mandarin Ladu" },
  { name: "Mangosteen", category: "Fruits", psaName: "Mangosteen" },
  { name: "Tamarind", category: "Fruits", psaName: "Tamarind" },
  { name: "Guapple", category: "Fruits", psaName: "Guapple" },
  { name: "Guava", category: "Fruits", psaName: "Guava" },
  { name: "Lanzones", category: "Fruits", psaName: "Lanzones" },
  { name: "Canistel", category: "Fruits", psaName: "Canistel" },
  { name: "Durian", category: "Fruits", psaName: "Durian" },
];

// Finds a crop by its name, whatever the capital letters are ("tomato" finds "Tomato").
// Gives back undefined when we don't have that crop.
export function findCrop(name) {
  const wanted = String(name || "").trim().toLowerCase();
  return CROPS.find((crop) => crop.name.toLowerCase() === wanted);
}

// The PSA table of a crop: the table of its category
export function tableOf(crop) {
  return CATEGORIES.find((category) => category.name === crop.category).table;
}
