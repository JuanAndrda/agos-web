// wikipediaService.js: gets a crop's photo and short description from the Wikipedia API.
// Like the Dog API in our class activity, React calls it directly: no key and no server needed.
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

// Gets the photos of many crops, one after another, and returns them like
// { Tomato: "https://upload.wikimedia.org/...", ... }. Used by Home and Market Prices.
// If one photo fails, we just skip it, so that card shows a letter and the rest still work.
export async function getCropPhotos(crops) {
  const photos = {};
  for (const crop of crops) {
    try {
      const info = await getCropInfo(crop);
      if (info && info.photo) photos[crop] = info.photo;
    } catch (err) {
      console.error("No photo for " + crop, err);
    }
  }
  return photos;
}
