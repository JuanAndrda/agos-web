// AddToCart.js: the "kilos + Add to cart" box at the bottom of each Marketplace card.
// It checks the number BEFORE adding: more than 0, a whole number, and not more than the stock.
// The server checks the same things again at checkout, because the stock can change.
import { useState } from "react";

// cart and setCart are props from App.js (through Marketplace.js)
function AddToCart({ listing, cart, setCart }) {
  const [kilos, setKilos] = useState("1");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");

  // Is this listing in the cart already? find() gives the item, or undefined if it isn't there
  const itemInCart = cart.find((item) => item.listing.id === listing.id);
  const inCart = itemInCart ? itemInCart.quantityKg : 0; // kilos already in the cart
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
      if (itemInCart) {
        // Already in the cart: add the new kilos to that item
        setCart(
          cart.map((item) =>
            item.listing.id === listing.id ? { listing: item.listing, quantityKg: item.quantityKg + wanted } : item
          )
        );
      } else {
        // Not in the cart yet: add a new item at the end
        setCart([...cart, { listing: listing, quantityKg: wanted }]);
      }
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
