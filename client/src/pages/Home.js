// Home.js: the landing page at "/", the first page a visitor sees. Anyone can open it, even
// before logging in. It uses two APIs we already have:
//   1. our server's GET /api/prices (PSA prices), which doesn't need a login
//   2. Wikipedia, for a photo of each crop (getCropPhotos, shared with Market Prices)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrices } from "../services/pricesService";
import { getCropPhotos } from "../services/wikipediaService";
import { TOWNS, formatPeso } from "../constants";
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
  const [prices, setPrices] = useState([]);
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
      const data = await getPrices(""); // GET /api/prices -> the newest price of each crop
      setPrices(data.prices);
      setLoading(false); // show the tiles now; the photos come after
      const crops = data.prices.map((p) => p.crop);
      setPhotos(await getCropPhotos(crops)); // GET Wikipedia, one call per crop
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
            Check this month's farmgate prices from PSA, then buy fresh crops directly from farmers
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
              <strong>{prices.length || 10} crops</strong>
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
          <h2>Browse crops</h2>
          <Link to="/prices">See all prices</Link>
        </div>
        {!user && <p className="muted small">Log in to open a crop's full price history.</p>}

        {loading && <Loading text="Getting prices from PSA..." />}
        {error && <ErrorMessage message={error} onRetry={loadCrops} />}

        {!loading && !error && (
          <div className="crop-tiles">
            {prices.map((p, i) => (
              // "tile-1" to "tile-6" are 6 soft colors in App.css. "i % 6" repeats them.
              <Link key={p.crop} to={`/crops/${p.crop}`} className={`crop-tile tile-${(i % 6) + 1}`}>
                {photos[p.crop] ? (
                  <img src={photos[p.crop]} alt="" />
                ) : (
                  <span className="crop-tile-letter" aria-hidden="true">
                    {p.crop[0]}
                  </span>
                )}
                <strong>{p.crop}</strong>
                <span>₱{formatPeso(p.pricePerKg)} per kg</span>
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
