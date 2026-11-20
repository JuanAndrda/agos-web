// Marketplace.js: the available listings, for buyers (and farmers) to browse, ONE PAGE at a time.
// Since Nov 20 the SERVER does the work: React sends the page number and the filters
// (GET /api/listings?page=2&limit=12&search=mango&town=Oton...) and gets back only that page,
// plus the total, so it can draw the page buttons (Pagination.js). When a filter changes, we go
// back to page 1 and ask the server again.
// Since Nov 17 buyers get an "Add to cart" box on each card (AddToCart.js). Farmers only sell,
// so they get no box, and their own listings say "This is your listing".
// Since Nov 20 there are 104 crops, so there is also a Category filter (Fruits, Beans, ...).
// The category of each crop comes from our crop catalog: GET /api/crops.
import { useEffect, useState } from "react";
import { getAvailableListings } from "../services/listingsService";
import { getCropPhotos } from "../services/wikipediaService";
import { getCrops } from "../services/cropsService";
import { TOWNS } from "../constants";
import SearchBar from "../components/SearchBar";
import ListingCard from "../components/ListingCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import AddToCart from "../components/AddToCart";
import Pagination from "../components/Pagination";

// user, cart and setCart are props from App.js
function Marketplace({ user, cart, setCart }) {
  const [listings, setListings] = useState([]); // only the listings on THIS page
  const [loading, setLoading] = useState(true); // waiting for the server right now
  const [loadedOnce, setLoadedOnce] = useState(false); // the first page has arrived
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }

  // The page, and the numbers the server sends back with it
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12); // listings per page: 6, 12 or 24
  const [total, setTotal] = useState(0); // listings that match the filters, on all pages
  const [totalPages, setTotalPages] = useState(1);
  const [totalAvailable, setTotalAvailable] = useState(0); // all listings for sale, no filters
  // The page and page size of the listings ON SCREEN (from the server's answer). They can differ
  // from page/limit for a moment: after a click, page is already 3 while page 2 is still showing.
  const [shownPage, setShownPage] = useState(1);
  const [shownLimit, setShownLimit] = useState(12);
  const [reloadCount, setReloadCount] = useState(0); // +1 = load the page again (Try again)

  // The filters
  const [search, setSearch] = useState("");
  const [town, setTown] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [category, setCategory] = useState("");

  // The category names for the Category filter, from our crop catalog (GET /api/crops).
  // The server checks each listing's category itself.
  const [categories, setCategories] = useState([]);

  // The name in the browser tab
  useEffect(() => {
    document.title = "Marketplace · AgosUgnayan Web";
  }, []);

  // GET Wikipedia for the photo of each crop on this page (once per crop, not once per card)
  async function loadPhotos(list) {
    const crops = [];
    for (const listing of list) {
      if (!crops.includes(listing.crop) && !photos[listing.crop]) crops.push(listing.crop);
    }
    if (crops.length === 0) return;
    const newPhotos = await getCropPhotos(crops);
    setPhotos((old) => ({ ...old, ...newPhotos })); // keep the photos we already have
  }

  // GET /api/crops for the Category filter. If it fails, the filter just stays hidden.
  async function loadCategories() {
    try {
      const data = await getCrops();
      setCategories(data.categories);
    } catch (err) {
      console.error("No categories:", err);
    }
  }

  // Load the categories once, when the page opens
  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // READ: GET /api/listings?page=...&filters... It runs when the page opens AND every time the
  // page, the page size or a filter changes (the list in [ ] at the end).
  // We wait 300 ms first, so typing "mango" sends ONE request, not one per letter. If something
  // changes during those 300 ms, the cleanup function (return ...) cancels the old request, and
  // "stale = true" makes sure an old, slow answer never replaces a newer one.
  useEffect(() => {
    let stale = false;
    setLoading(true); // dim the old page at once, so the click feels answered
    const timer = setTimeout(async () => {
      setError("");
      try {
        const data = await getAvailableListings({
          page: page,
          limit: limit,
          search: search.trim(),
          category: category,
          town: town,
          minPrice: minPrice,
          maxPrice: maxPrice,
          sort: sort,
        });
        if (stale) return; // a newer request is on its way, so ignore this answer
        setListings(data.listings);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setTotalAvailable(data.totalAvailable);
        setShownPage(data.page);
        setShownLimit(data.limit);
        setLoadedOnce(true);
        if (data.page !== page) setPage(data.page); // we asked past the last page; the server sent the last one
        loadPhotos(data.listings);
      } catch (err) {
        console.error(err);
        if (!stale) setError(err.message); // like "Please log in first." (401)
      } finally {
        if (!stale) setLoading(false);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, category, town, minPrice, maxPrice, sort, reloadCount]);

  // A filter changed: save it, and go back to page 1 (page 5 of the old results may not exist)
  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  // A page button was pressed: show that page, and scroll up to the top of the results
  function goToPage(n) {
    setPage(n);
    document.getElementById("listing-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeLimit(n) {
    setLimit(n);
    setPage(1);
  }

  const filtersOn = search.trim() !== "" || category !== "" || town !== "" || minPrice !== "" || maxPrice !== "";

  // A max price below the min price can never match anything, so we explain it
  const priceRangeWrong = minPrice !== "" && maxPrice !== "" && Number(maxPrice) < Number(minPrice);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setTown("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  }

  return (
    <section>
      {/* page-banner-tall leaves room at the bottom, so the filter box can overlap it */}
      <div className="page-banner page-banner-tall">
        <h1>Marketplace</h1>
        <p>Crops that Iloilo farmers are selling now.</p>
      </div>

      <div className="filters card">
        <SearchBar id="listing-search" label="Search a crop" value={search} onChange={(value) => changeFilter(setSearch, value)} placeholder="e.g. eggplant" />

        <div className="filter-row">
          {categories.length > 0 && (
            <div className="field category-field">
              <label htmlFor="category-filter">Category</label>
              <select id="category-filter" value={category} onChange={(e) => changeFilter(setCategory, e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="town-filter">Town</label>
            <select id="town-filter" value={town} onChange={(e) => changeFilter(setTown, e.target.value)}>
              <option value="">All towns</option>
              {TOWNS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field price-field">
            <label htmlFor="min-price">Min price per kg (₱)</label>
            <input
              id="min-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => changeFilter(setMinPrice, e.target.value)}
            />
          </div>
          <div className="field price-field">
            <label htmlFor="max-price">Max price per kg (₱)</label>
            <input
              id="max-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => changeFilter(setMaxPrice, e.target.value)}
              aria-invalid={priceRangeWrong}
              aria-describedby={priceRangeWrong ? "max-price-error" : undefined}
            />
            {priceRangeWrong && (
              <p id="max-price-error" className="field-error">
                Max price can't be lower than min price.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => changeFilter(setSort, e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>

      {/* id="listing-results": the page buttons scroll back up to here */}
      <div id="listing-results">
        {/* The "Loading" text only for the FIRST page. After that, the old page stays on screen
            (dimmed) until the new one arrives, so the page doesn't jump while you move around. */}
        {loading && !loadedOnce && <Loading text="Loading listings..." />}
        {error && <ErrorMessage message={error} onRetry={() => setReloadCount(reloadCount + 1)} />}

        {loadedOnce && !error && totalAvailable === 0 && (
          <div className="empty">
            <p>No crops are for sale right now. Please check again later.</p>
          </div>
        )}

        {loadedOnce && !error && totalAvailable > 0 && (
          <>
            <p className="result-note" aria-live="polite">
              {total} of {totalAvailable} listing{totalAvailable === 1 ? "" : "s"} match.{" "}
              {filtersOn && (
                <button type="button" className="link-button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </p>

            {total === 0 ? (
              <div className="empty">
                <p>
                  {priceRangeWrong
                    ? "The max price is lower than the min price. Change one of them, or clear the filters."
                    : "No listings match your filters."}
                </p>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className={loading ? "listing-grid results-loading" : "listing-grid"} aria-busy={loading}>
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} photo={photos[listing.crop]}>
                      {user.role === "buyer" && <AddToCart listing={listing} cart={cart} setCart={setCart} />}
                      {listing.ownerId === user.uid && <p className="cart-note">This is your listing.</p>}
                    </ListingCard>
                  ))}
                </div>
                <Pagination
                  id="listings"
                  page={shownPage}
                  totalPages={totalPages}
                  total={total}
                  limit={shownLimit}
                  itemName="listings"
                  onPageChange={goToPage}
                  onLimitChange={changeLimit}
                />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Marketplace;
