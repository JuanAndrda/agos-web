// cropsService.js: gets our crop catalog from OUR Express server (server/crops.js).
// The catalog is the ONE crop list of the whole app, so React has no crop list of its own:
// the crop picker, Market Prices, the Marketplace and Crop Details all use this.
import { readResponse } from "./readResponse";

// READ: GET /api/crops -> every crop with its category and its newest PSA price
// Answer: { categories: ["Fruit vegetables", ...], crops: [{ name, category, popular, latest }] }
// "latest" is null when PSA has no recent price for that crop (the crop can still be chosen).
// Success: 200 OK (even when PSA is down: then every "latest" is null).
export async function getCrops() {
  const response = await fetch("/api/crops", { method: "GET" });
  return readResponse(response);
}

// Puts the crops into groups, one per category, in the catalog's order:
// [{ category: "Fruit vegetables", crops: [...] }, { category: "Leafy vegetables", crops: [...] }, ...]
// Categories with no crops (for example after a search) are left out.
export function groupByCategory(categories, crops) {
  const groups = [];
  for (const category of categories) {
    const inCategory = crops.filter((crop) => crop.category === category);
    if (inCategory.length > 0) groups.push({ category: category, crops: inCategory });
  }
  return groups;
}
