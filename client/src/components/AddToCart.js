// AddToCart.js: the "kilos + Add to cart" box at the bottom of each Marketplace card.
// It checks the number BEFORE adding: more than 0, a whole number, and not more than the stock.
// The server checks the same things again at checkout, because the stock can change.
import { useState } from "react";
import { useCart } from "../context/CartContext";

function AddToCart({ listing }) {
  const { addToCart, kilosInCart } = useCart();
  const [kilos, setKilos] = useState("1");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");

  const inCart = kilosInCart(listing.id);
  const left = listing.quantityKg - inCart; // what the buyer can still add
  const inputId = `kilos-${listing.id}`;

  function handleAdd() {
    const wanted = Number(kilos);
    setAdded("");
    if (kilos === "" || !Number.isInteger(wanted) || wanted <= 0) {
      setError("Enter whole kilos, like 5.");
    } else if (wanted > left) {
      setError(inCart > 0 ? `Only ${left} kg more is left (${inCart} kg is in your cart).` : `Only ${left} kg left.`);
    } else {
      addToCart(listing, wanted);
      setError("");
      setAdded(`Added ${wanted} kg to your cart.`);
    }
  }

  // Everything is in the cart already
  if (left <= 0) {
    return <p className="cart-note">All {listing.quantityKg} kg are in your cart.</p>;
  }

  return (
    <div className="add-to-cart">
      <div className="add-to-cart-row">
        <label htmlFor={inputId} className="visually-hidden">
          Kilos of {listing.crop}
        </label>
        <input
          id={inputId}
          type="number"
          min="1"
          max={left}
          step="1"
          inputMode="numeric"
          value={kilos}
          onChange={(e) => setKilos(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <span className="unit">kg</span>
        <button type="button" className="btn btn-primary" onClick={handleAdd}>
          Add to cart
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      )}
      {/* role="status" makes screen readers read the message out loud */}
      <p className="cart-note" role="status">
        {added || (inCart > 0 ? `${inCart} kg in your cart.` : "")}
      </p>
    </div>
  );
}

export default AddToCart;
