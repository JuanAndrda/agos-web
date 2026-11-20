// MarketPrices.js: the newest farmgate price of each crop in Iloilo, from PSA through our server.
// Every API page has the same three states: loading, error and data (plus "empty" when there's no data).
// Each crop is a card with its Wikipedia photo. Clicking a card opens that crop's Crop Details page.
// With about 100 crops, the cards are GROUPED by category (Fruit vegetables, ... Fruits), and the
// category buttons at the top show only one group. A crop whose newest PSA price is from an
// earlier month than the others says "older price", so nobody reads it as this month's price.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrices } from "../services/pricesService";
import { getCropPhotos } from "../services/wikipediaService";
import SearchBar from "../components/SearchBar";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { formatPeso, cropLink } from "../constants";
import { groupByCategory } from "../services/cropsService";

function MarketPrices() {
  const [prices, setPrices] = useState([]);
  const [stale, setStale] = useState(false); // true = PSA isn't answering, these are older prices
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(""); // what is typed in the box
  const [searched, setSearched] = useState(""); // the search the cards are showing
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }
  const [categories, setCategories] = useState([]); // the category names, in order
  const [category, setCategory] = useState(""); // the category button that is on ("" = all)

  // The name in the browser tab
  useEffect(() => {
    document.title = "Market Prices · AgosUgnayan Web";
  }, []);

  // Asks our server for the prices that match the search text.
  // A plain async function with try / catch / finally, like fetchDogs() in our class activity.
  async function loadPrices(text) {
    setLoading(true);
    setError("");
    try {
      const data = await getPrices(text); // GET /api/prices?search=text
      setPrices(data.prices);
      setCategories(data.categories);
      setStale(data.stale);
      setSearched(text);
      setCategory(""); // a new search shows every category again
      // The first time, also GET the photos from Wikipedia (all at the same time, see
      // getCropPhotos). A later search doesn't load them again.
      if (Object.keys(photos).length === 0) {
        getCropPhotos(data.prices.map((p) => p.crop)).then((result) => setPhotos(result));
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // When the page opens ([] = only once): load all prices. loadPrices() then gets the photos.
  useEffect(() => {
    loadPrices("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showAll() {
    setSearch("");
    setCategory("");
    loadPrices("");
  }

  // The cards we show: all crops, or only the chosen category. Then group them by category.
  const shown = prices.filter((p) => category === "" || p.category === category);
  const groups = groupByCategory(categories, shown);

  // How many crops each category button has, like { Fruits: 47, Beans: 10 }
  const countOf = {};
  for (const p of prices) countOf[p.category] = (countOf[p.category] || 0) + 1;

  // The cheapest and the most expensive crop that is shown, for the summary boxes.
  // reduce() goes through the list once and keeps the lowest (or highest) one it has seen.
  const lowest = shown.length > 0 ? shown.reduce((a, b) => (b.pricePerKg < a.pricePerKg ? b : a)) : null;
  const highest = shown.length > 0 ? shown.reduce((a, b) => (b.pricePerKg > a.pricePerKg ? b : a)) : null;

  return (
    <section>
      {/* page-banner: the green box at the top of each page (App.css). The search sits inside it. */}
      <div className="page-banner">
        <h1>Market Prices</h1>
        <p className="source-line">
          Farmgate prices in Iloilo Province · Source: <strong>PSA OpenSTAT</strong>
        </p>
        <SearchBar
          id="price-search"
          label="Search a crop"
          value={search}
          onChange={setSearch}
          onSubmit={() => loadPrices(search.trim())}
          placeholder="e.g. tomato"
        />
      </div>

      {loading && <Loading text="Getting prices from PSA..." />}

      {error && <ErrorMessage message={error} onRetry={() => loadPrices(search.trim())} />}

      {!loading && !error && prices.length === 0 && (
        <div className="empty">
          <p>No crops found for "{searched}". Try another name, like tomato or onion.</p>
          <button type="button" className="btn btn-secondary" onClick={showAll}>
            Show all crops
          </button>
        </div>
      )}

      {!loading && !error && prices.length > 0 && (
        <>
          {/* Category buttons: show all crops, or one group. aria-pressed tells screen readers which is on. */}
          <div className="category-chips" role="group" aria-label="Show a category">
            <button type="button" className="chip" aria-pressed={category === ""} onClick={() => setCategory("")}>
              All <span>{prices.length}</span>
            </button>
            {categories
              .filter((name) => countOf[name])
              .map((name) => (
                <button key={name} type="button" className="chip" aria-pressed={category === name} onClick={() => setCategory(name)}>
                  {name} <span>{countOf[name]}</span>
                </button>
              ))}
          </div>

          {/* Summary boxes: worked out in React from the same prices, no extra API call */}
          <div className="price-summary">
            <Link to={cropLink(lowest.crop)} className="summary-box">
              <span>Lowest price</span>
              <strong>₱{formatPeso(lowest.pricePerKg)}</strong>
              <small>
                {lowest.crop} · per kg · {lowest.month}
              </small>
            </Link>
            <Link to={cropLink(highest.crop)} className="summary-box">
              <span>Highest price</span>
              <strong>₱{formatPeso(highest.pricePerKg)}</strong>
              <small>
                {highest.crop} · per kg · {highest.month}
              </small>
            </Link>
            <div className="summary-box">
              <span>Crops shown</span>
              <strong>{shown.length}</strong>
              <small>
                {category || "all categories"}
                {searched ? ` · matching "${searched}"` : ""}
              </small>
            </div>
          </div>

          {/* Our server couldn't reach PSA, so it sent the last prices it got (see server/index.js) */}
          {stale && (
            <p className="warning-box" role="status">
              PSA isn't answering right now, so these are the prices we got from PSA earlier. They may be a few hours old.
            </p>
          )}

          {/* When a search is on: how many crops matched, and a way back to all crops */}
          {searched && (
            <p className="result-note small">
              Showing {prices.length} result{prices.length === 1 ? "" : "s"} for "{searched}".{" "}
              <button type="button" className="link-button" onClick={showAll}>
                Show all crops
              </button>
            </p>
          )}

          {/* One section per category, one card per crop. The whole card is a link, so it's easy to tap. */}
          {groups.map((group) => (
            <div key={group.category} className="price-group">
              <h2 className="price-group-title">
                {group.category} <span className="muted">({group.crops.length})</span>
              </h2>
              <div className="price-grid">
                {group.crops.map((p) => (
                  <Link key={p.crop} to={cropLink(p.crop)} className="price-card">
                    {photos[p.crop] ? (
                      <img src={photos[p.crop]} alt="" loading="lazy" />
                    ) : (
                      <span className="price-card-letter" aria-hidden="true">
                        {p.crop[0]}
                      </span>
                    )}
                    <span className="price-card-body">
                      <strong className="price-card-name">{p.crop}</strong>
                      <span className="price-card-price">
                        ₱{formatPeso(p.pricePerKg)} <small>per kg</small>
                      </span>
                      <span className={p.older ? "price-card-month older-month" : "price-card-month"}>
                        {p.month}
                        {p.older ? " · older price" : ""}
                      </span>
                      <span className="price-card-more">View price history →</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <p className="muted small">Photos: Wikipedia</p>
        </>
      )}
    </section>
  );
}

export default MarketPrices;
