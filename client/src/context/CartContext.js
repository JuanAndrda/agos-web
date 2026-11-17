// CartContext.js: remembers what is in the cart, so the Marketplace (Add to cart), the top bar
// (the number of items) and the Cart page all see the same cart. It works like AuthContext.js.
// The cart lives only in React state: it is empty again after a page reload or log out,
// and nothing is saved in the database until the buyer presses "Send order request".
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  // Each item: { listing: { id, crop, pricePerKg, quantityKg, ownerName, ... }, quantityKg: 5 }
  const [items, setItems] = useState([]);

  // A different person logged in (or logged out): start with an empty cart
  const uid = user ? user.uid : null;
  useEffect(() => {
    setItems([]);
  }, [uid]);

  // Add kilos of one listing. If it's already in the cart, add to the kilos that are there.
  function addToCart(listing, quantityKg) {
    const inCart = items.find((item) => item.listing.id === listing.id);
    if (inCart) {
      setItems(items.map((item) => (item.listing.id === listing.id ? { ...item, quantityKg: item.quantityKg + quantityKg } : item)));
    } else {
      setItems([...items, { listing, quantityKg }]);
    }
  }

  // Change the kilos of one item (the number box on the Cart page)
  function changeQuantity(listingId, quantityKg) {
    setItems(items.map((item) => (item.listing.id === listingId ? { ...item, quantityKg } : item)));
  }

  function removeFromCart(listingId) {
    setItems(items.filter((item) => item.listing.id !== listingId));
  }

  function clearCart() {
    setItems([]);
  }

  // How many kilos of this listing are in the cart already (0 if none)
  function kilosInCart(listingId) {
    const inCart = items.find((item) => item.listing.id === listingId);
    return inCart ? inCart.quantityKg : 0;
  }

  return (
    <CartContext.Provider value={{ items, addToCart, changeQuantity, removeFromCart, clearCart, kilosInCart }}>
      {children}
    </CartContext.Provider>
  );
}

// Any page can call useCart() to get the cart and its functions
export function useCart() {
  return useContext(CartContext);
}
