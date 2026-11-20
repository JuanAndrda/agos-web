// paginate.js: splits a long list into PAGES, so the server sends one page at a time.
// Used by GET /api/listings (Marketplace) and GET /api/orders/mine and /received (Orders).
//
// React asks for a page with QUERY PARAMETERS in the address, like:
//   GET /api/listings?page=2&limit=12
//   page  = which page (1 is the first)
//   limit = how many items on one page (6, 12 or 24)
// The server answers with that page AND the numbers React needs to draw the page buttons:
//   { page: 2, limit: 12, total: 58, totalPages: 5, ... }

export const PAGE_SIZES = [6, 12, 24]; // the "Show 6 / 12 / 24 per page" choices

// Reads ?page= and ?limit= from the request and checks them.
// Gives back { page, limit } or { error } (the route then answers 400 Bad Request).
export function readPageQuery(query, defaultLimit) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) {
    return { error: "page must be a whole number, 1 or more." };
  }
  if (!PAGE_SIZES.includes(limit)) {
    return { error: `limit must be one of ${PAGE_SIZES.join(", ")}.` };
  }
  return { page: page, limit: limit };
}

// Cuts one page out of the full (already filtered and sorted) list.
// If the page asked for is past the end (for example, the last item on page 3 was deleted),
// we send the last page that exists instead of an empty page.
export function paginate(items, page, limit) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit)); // at least 1 page, even when empty
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit; // page 1 starts at 0, page 2 at 12, page 3 at 24...
  return {
    items: items.slice(start, start + limit), // slice(start, end) copies just that part
    page: safePage,
    limit: limit,
    total: total,
    totalPages: totalPages,
  };
}
