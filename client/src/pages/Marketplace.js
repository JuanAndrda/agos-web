// Marketplace.js: every available listing, for buyers (and farmers) to browse.
// We load the listings from our server once (GET /api/listings), then search, filter and sort
// them in React with .filter() and .sort(). Nothing is sent when a filter changes, so the
// results change instantly while you type.
// Since Nov 17 buyers get an "Add to cart" box on each card (AddToCart.js). Farmers only sell,
// so they get no box, and their own listings say "This is your listing".
import { useEffect, useState } from "react";
import { getAvailableListings } from "../services/listingsService";
import { getCropPhotos } from "../services/wikipediaService";
import { TOWNS } from "../constants";
import SearchBar from "../components/SearchBar";
import ListingCard from "../components/ListingCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import AddToCart from "../components/AddToCart";

// Our server sends the time as text, like "2026-11-15T12:30:00.000Z". This turns it into a
// number we can sort by.
function timeOf(listing) {
  return listing.createdAt ? Date.parse(listing.createdAt) : 0;
}

// user, cart and setCart are props from App.js
function Marketplace({ user, cart, setCart }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }

  // The filters
  const [search, setSearch] = useState("");
  const [town, setTown] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");

  // The name in the browser tab
  useEffect(() => {
    document.title = "Marketplace · AgosUgnayan Web";
  }, []);

  // READ: GET /api/listings. A plain async function with try / catch / finally.
  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const data = await getAvailableListings(); // 200 OK: a list of listings
      setListings(data);
      setLoading(false); // show the cards now; the photos come after
      loadPhotos(data);
    } catch (err) {
      console.error(err);
      setError(err.message); // like "Please log in first." (401)
    } finally {
      setLoading(false);
    }
  }

  // GET Wikipedia for the photo of each crop that is for sale (once per crop, not once per card)
  async function loadPhotos(list) {
    const crops = [];
    for (const listing of list) {
      if (!crops.includes(listing.crop)) crops.push(listing.crop);
    }
    setPhotos(await getCropPhotos(crops));
  }

  // Load the listings once, when the page opens
  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Filter: keep only the listings that match every filter
  const text = search.trim().toLowerCase();
  const shown = listings
    .filter((l) => l.crop.toLowerCase().includes(text))
    .filter((l) => town === "" || l.town === town)
    .filter((l) => minPrice === "" || l.pricePerKg >= Number(minPrice))
    .filter((l) => maxPrice === "" || l.pricePerKg <= Number(maxPrice));

  // 2. Sort
  if (sort === "newest") shown.sort((a, b) => timeOf(b) - timeOf(a));
  if (sort === "price-low") shown.sort((a, b) => a.pricePerKg - b.pricePerKg);
  if (sort === "price-high") shown.sort((a, b) => b.pricePerKg - a.pricePerKg);

  const filtersOn = text !== "" || town !== "" || minPrice !== "" || maxPrice !== "";

  // A max price below the min price can never match anything, so we explain it
  const priceRangeWrong = minPrice !== "" && maxPrice !== "" && Number(maxPrice) < Number(minPrice);

  function clearFilters() {
    setSearch("");
    setTown("");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <section>
      {/* page-banner-tall leaves room at the bottom, so the filter box can overlap it */}
      <div className="page-banner page-banner-tall">
        <h1>Marketplace</h1>
        <p>Crops that Iloilo farmers are selling now.</p>
      </div>

      <div className="filters card">
        <SearchBar id="listing-search" label="Search a crop" value={search} onChange={setSearch} placeholder="e.g. eggplant" />

        <div className="filter-row">
          <div className="field">
            <label htmlFor="town-filter">Town</label>
            <select id="town-filter" value={town} onChange={(e) => setTown(e.target.value)}>
              <option value="">All towns</option>
              {TOWNS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="min-price">Min price per kg (₱)</label>
            <input
              id="min-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="max-price">Max price per kg (₱)</label>
            <input
              id="max-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
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
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <Loading text="Loading listings..." />}
      {error && <ErrorMessage message={error} onRetry={loadListings} />}

      {!loading && !error && listings.length === 0 && (
        <div className="empty">
          <p>No crops are for sale right now. Please check again later.</p>
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <>
          <p className="result-note" aria-live="polite">
            Showing {shown.length} of {listings.length} listing{listings.length === 1 ? "" : "s"}.{" "}
            {filtersOn && (
              <button type="button" className="link-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          {shown.length === 0 ? (
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
            <div className="listing-grid">
              {shown.map((listing) => (
                <ListingCard key={listing.id} listing={listing} photo={photos[listing.crop]}>
                  {user.role === "buyer" && <AddToCart listing={listing} cart={cart} setCart={setCart} />}
                  {listing.ownerId === user.uid && <p className="cart-note">This is your listing.</p>}
                </ListingCard>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Marketplace;
