// Home.js: the landing page at "/", the first page a visitor sees. Anyone can open it, even
// before logging in. It uses two APIs we already have:
//   1. our server's GET /api/crops (our crop catalog with PSA prices), which doesn't need a login
//   2. Wikipedia, for a photo of each crop (getCropPhotos, shared with Market Prices)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCrops } from "../services/cropsService";
import { getCropPhotos } from "../services/wikipediaService";
import { TOWNS, formatPeso, cropLink } from "../constants";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

// The 3 steps in "How it works"
const STEPS = [
  { title: "Check the price", text: "See PSA's farmgate price per kg, so you know what is fair." },
  { title: "Find a crop and order", text: "Search the Marketplace by crop, town and price, then add it to your cart." },
  { title: "The farmer accepts", text: "The farmer accepts your order request. Then you agree on pickup and payment by phone." },
];

// user is a prop from App.js: null when nobody is logged in
function Home({ user }) {
  const [crops, setCrops] = useState([]); // every crop in our catalog
  const [popular, setPopular] = useState([]); // the 10 popular crops we show as tiles
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The name in the browser tab
  useEffect(() => {
    document.title = "AgosUgnayan Web · Iloilo crop prices and marketplace";
  }, []);

  // Gets the prices from our server, then the photos from Wikipedia.
  // A plain async function with try / catch / finally, like fetchDogs() in our class activity.
  async function loadCrops() {
    setLoading(true);
    setError("");
    try {
      const data = await getCrops(); // GET /api/crops -> every crop with its newest price
      // 71 tiles would be too many for the Home page, so we show the 10 "popular" crops.
      // The rest are on Market Prices.
      const popularCrops = data.crops.filter((c) => c.popular);
      setCrops(data.crops);
      setPopular(popularCrops);
      setLoading(false); // show the tiles now; the photos come after
      setPhotos(await getCropPhotos(popularCrops.map((c) => c.name))); // GET Wikipedia
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load the crops once, when the page opens ([] = run only once)
  useEffect(() => {
    loadCrops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="home">
      {/* 1. The hero: the big welcome box at the top */}
      <section className="hero">
        <div className="hero-text">
          <span className="hero-tag">For Iloilo farmers and buyers</span>
          <h1>Fair crop prices, straight from the farm</h1>
          <p>
            Check PSA's latest farmgate prices, then buy fresh crops directly from farmers
            in your town.
          </p>
          <div className="hero-actions">
            {user ? (
              <>
                <Link to="/prices" className="btn btn-primary btn-pill">
                  See market prices →
                </Link>
                <Link to="/marketplace" className="btn btn-secondary btn-pill">
                  Go to the Marketplace
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-pill">
                  Get started →
                </Link>
                <Link to="/login" className="btn btn-secondary btn-pill">
                  I already have an account
                </Link>
              </>
            )}
          </div>
          <div className="hero-stats">
            <p>
              <strong>{crops.length || 71} crops</strong>
              <span>tracked by PSA</span>
            </p>
            <p>
              <strong>{TOWNS.length} towns</strong>
              <span>across Iloilo</span>
            </p>
            <p>
              <strong>Free</strong>
              <span>order straight from the farmer</span>
            </p>
          </div>
        </div>
        <img className="hero-art" src="/basket.svg" alt="" />
      </section>

      {/* 2. Crop tiles: one per crop, with its Wikipedia photo and its newest PSA price */}
      <section className="home-section">
        <div className="section-head">
          <h2>Popular crops</h2>
          <Link to="/prices">See all {crops.length || ""} crops</Link>
        </div>
        {!user && <p className="muted small">Log in to open a crop's full price history.</p>}

        {loading && <Loading text="Getting prices from PSA..." />}
        {error && <ErrorMessage message={error} onRetry={loadCrops} />}

        {!loading && !error && (
          <div className="crop-tiles">
            {popular.map((c, i) => (
              // "tile-1" to "tile-6" are 6 soft colors in App.css. "i % 6" repeats them.
              <Link key={c.name} to={cropLink(c.name)} className={`crop-tile tile-${(i % 6) + 1}`}>
                {photos[c.name] ? (
                  <img src={photos[c.name]} alt="" />
                ) : (
                  <span className="crop-tile-letter" aria-hidden="true">
                    {c.name[0]}
                  </span>
                )}
                <strong>{c.name}</strong>
                {/* The price and its month, or a note when PSA's prices aren't available */}
                <span>{c.latest ? `₱${formatPeso(c.latest.pricePerKg)} per kg · ${c.latest.month}` : "Price not available"}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="muted small">Prices: PSA OpenSTAT, monthly farmgate prices · Photos: Wikipedia</p>
      </section>

      {/* 3. How it works: 3 simple steps */}
      <section className="home-section">
        <div className="section-head">
          <h2>How it works</h2>
        </div>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title} className="step">
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default Home;
