// Home.js: the landing page at "/", the first page a visitor sees. Anyone can open it, even
// before logging in. It uses two APIs we already have:
//   1. our server's GET /api/prices (PSA prices), which doesn't need a login
//   2. Wikipedia, for a photo of each crop (getCropPhotos, shared with Market Prices)
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPrices } from "../services/pricesService";
import { getCropPhotos } from "../services/wikipediaService";
import { TOWNS, formatPeso } from "../constants";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

// The 3 steps in "How it works"
const STEPS = [
  { title: "Check the price", text: "See PSA's farmgate price per kg, so you know what is fair." },
  { title: "Find a crop near you", text: "Search the Marketplace by crop, town and price." },
  { title: "Call the farmer", text: "Tap the number on a listing to call or text the farmer." },
];

function Home() {
  const { user } = useAuth();
  const [prices, setPrices] = useState([]);
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The name in the browser tab
  useEffect(() => {
    document.title = "AgosUgnayan Web · Iloilo crop prices and marketplace";
  }, []);

  // useCallback keeps the same function between redraws, so useEffect below runs only once
  const loadCrops = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPrices(""); // GET /api/prices -> the newest price of each crop
      setPrices(data.prices);
      setLoading(false);
      setPhotos(await getCropPhotos(data.prices.map((p) => p.crop))); // Wikipedia, one call per crop
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the crops when the page opens
  useEffect(() => {
    loadCrops();
  }, [loadCrops]);

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
              <span>call the farmer directly</span>
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
