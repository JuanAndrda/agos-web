// wikipediaService.js: gets a crop's photo and short description from the Wikipedia API.
// Like the Dog API in Ma'am's example, React calls it directly: no key and no server needed.
// Endpoint: GET https://en.wikipedia.org/api/rest_v1/page/summary/<page title>

// Some of our crop names are not the Wikipedia page title, so we say which page to use.
// (Same pages our Agos app uses, picked to match the kind sold in Iloilo.)
const WIKI_TITLES = {
  Carrots: "Carrot",
  Ampalaya: "Momordica charantia", // bitter gourd
  Pechay: "Bok choy",
  Onion: "Red onion",
  Squash: "Calabaza", // kalabasa
  Kangkong: "Ipomoea aquatica", // water spinach
};

// Returns { title, description, photo, link }, or null if Wikipedia has no page for it
export async function getCropInfo(cropName) {
  const title = WIKI_TITLES[cropName] || cropName;
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("We can't reach Wikipedia right now. Check your internet connection.");
  }
  if (response.status === 404) return null; // no page with that title
  if (!response.ok) throw new Error("Wikipedia isn't answering right now. Please try again.");

  const data = await response.json();
  // Wikipedia sends a lot. We keep only the 4 things we show.
  return {
    title: data.title,
    description: data.extract,
    photo: data.thumbnail?.source, // ?. means "if there is one"
    link: data.content_urls?.desktop?.page,
  };
}
