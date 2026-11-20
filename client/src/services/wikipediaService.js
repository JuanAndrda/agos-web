// wikipediaService.js: gets a crop's photo and short description from the Wikipedia API.
// Like the Dog API in our class activity, React calls it directly: no key and no server needed.
// Endpoint: GET https://en.wikipedia.org/api/rest_v1/page/summary/<page title>

// Many of our crop names are not Wikipedia page titles, so we say which page to use.
// Crops that are not in this list use their own name ("Tomato" -> the "Tomato" page).
// Varieties share one page (all 3 papayas use "Papaya"), so their photo is the same.
// A crop with no Wikipedia page or photo just shows its first letter (for example Asparagus,
// whose page has no summary photo). All titles were checked on 2026-11-20.
const WIKI_TITLES = {
  // Fruit vegetables
  Eggplant: "Eggplant",
  "Eggplant (native round)": "Eggplant",
  Ampalaya: "Momordica charantia", // bitter gourd
  Squash: "Calabaza", // kalabasa
  Upo: "Calabash", // bottle gourd
  "Patola (native)": "Luffa acutangula",
  "Patola (Baguio)": "Luffa aegyptiaca",
  "Green papaya": "Papaya",
  "Young jackfruit": "Jackfruit",
  "Banana blossom": "Banana blossom",
  // Leafy vegetables
  Pechay: "Bok choy",
  Kangkong: "Ipomoea aquatica", // water spinach
  "Pechay Baguio": "Napa cabbage",
  Alugbati: "Basella alba",
  Malunggay: "Moringa oleifera",
  Saluyot: "Corchorus olitorius",
  "Camote tops": "Sweet potato",
  "Squash tops": "Calabaza",
  "Gabi leaves": "Taro",
  Mustard: "Brassica juncea",
  "Chili leaves": "Capsicum frutescens",
  // Root crops
  Carrots: "Carrot",
  Camote: "Sweet potato",
  Ubi: "Dioscorea alata",
  "Gabi (Cebu)": "Taro",
  "Gabi (Tagalog)": "Taro",
  "Pao galiang": "Xanthosoma sagittifolium",
  // Condiments
  Onion: "Red onion",
  "Spring onion": "Scallion",
  "Siling labuyo": "Siling labuyo",
  "Finger pepper": "Siling haba",
  "Ginger (native)": "Ginger",
  "Ginger (Hawaiian)": "Ginger",
  Leeks: "Leek",
  // Beans
  Sitao: "Yardlong bean",
  "Snap beans": "Green bean",
  Sigarilyas: "Winged bean",
  Kadios: "Pigeon pea",
  "Mongo (green, labo)": "Mung bean",
  "Mongo (green, shiny)": "Mung bean",
  "Mongo (yellow, shiny)": "Mung bean",
  "Peanut (dry)": "Peanut",
  "Peanut (fresh)": "Peanut",
  Patani: "Lima bean",
  // Fruits
  "Mango (Carabao)": "Carabao mango",
  "Mango (Piko)": "Mango",
  "Mango (Indian)": "Mango",
  "Banana (Saba)": "Saba banana",
  "Banana (Lakatan)": "Lakatan banana",
  "Banana (Latundan)": "Latundan banana",
  "Banana (Bungulan)": "Banana",
  "Banana (Cavendish)": "Cavendish banana",
  "Pineapple (Hawaiian)": "Pineapple",
  "Pineapple (native)": "Pineapple",
  "Pineapple (Formosa)": "Pineapple",
  "Papaya (Hawaiian)": "Papaya",
  "Papaya (Solo)": "Papaya",
  "Papaya (native)": "Papaya",
  Atis: "Sugar-apple",
  Guyabano: "Soursop",
  Chico: "Sapodilla",
  "Dragon fruit": "Pitaya",
  Duhat: "Syzygium cumini",
  "Ripe jackfruit": "Jackfruit",
  Marang: "Artocarpus odoratissimus",
  Santol: "Sandoricum koetjape",
  Tambis: "Syzygium aqueum",
  Camachile: "Pithecellobium dulce",
  Orange: "Orange (fruit)",
  Sineguelas: "Spondias purpurea",
  Starapple: "Chrysophyllum cainito",
  Muskmelon: "Cucumis melo", // "Muskmelon" is a list of meanings, not one page
  "Grapes (green)": "Grape",
  "Grapes (red)": "Grape",
  "Honeydew melon": "Honeydew (melon)",
  "Golden melon": "Canary melon",
  "Mandarin (Szinkom)": "Mandarin orange",
  "Mandarin (Ladu)": "Mandarin orange",
  Mangosteen: "Purple mangosteen",
  Guapple: "Guava",
  Lanzones: "Lansium parasiticum",
  Canistel: "Pouteria campechiana",
};

// Returns { title, description, photo, link }, or null if Wikipedia has no page for it
export async function getCropInfo(cropName) {
  const title = WIKI_TITLES[cropName] || cropName;
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);

  let response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch {
    throw new Error("We can't reach Wikipedia right now. Check your internet connection.");
  }

  // Check the status code, like in the Dog API activity
  if (response.status === 404) {
    return null; // 404 Not Found: Wikipedia has no page with that title
  }
  if (!response.ok) {
    // response.ok is true for any 2xx code. Anything else (like 500) is a problem.
    throw new Error("Wikipedia isn't answering right now. Please try again.");
  }

  // 200 OK: read the JSON. Wikipedia sends a lot; we keep only the 4 things we show.
  const data = await response.json();
  let photo = "";
  if (data.thumbnail) photo = data.thumbnail.source; // some pages have no photo
  let link = "";
  if (data.content_urls) link = data.content_urls.desktop.page;

  return {
    title: data.title,
    description: data.extract,
    photo: photo,
    link: link,
  };
}

// Gets the photos of many crops and returns them like
// { Tomato: "https://upload.wikimedia.org/...", ... }. Used by Home, Market Prices, the Marketplace
// and My Listings. With about 100 crops, asking one by one would take too long, so:
//   1. we ask for each Wikipedia PAGE only once (the 3 papayas share the "Papaya" page), and
//   2. Promise.all sends those requests at the same time and waits until all of them are back.
// If one photo fails, we just skip it, so that card shows a letter and the rest still work.
export async function getCropPhotos(crops) {
  // 1. The different page titles we need, like ["Tomato", "Papaya", ...]
  const titles = [];
  for (const crop of crops) {
    const title = WIKI_TITLES[crop] || crop;
    if (!titles.includes(title)) titles.push(title);
  }

  // 2. Ask Wikipedia for all of them at the same time
  const results = await Promise.all(
    titles.map((title) =>
      getCropInfo(title).catch((err) => {
        console.error("No photo for " + title, err);
        return null; // this one failed, the others still count
      })
    )
  );

  // 3. Give every crop the photo of its page
  const photos = {};
  for (const crop of crops) {
    const info = results[titles.indexOf(WIKI_TITLES[crop] || crop)];
    if (info && info.photo) photos[crop] = info.photo;
  }
  return photos;
}
