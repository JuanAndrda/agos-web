// constants.js: fixed lists the forms and filters use. Choosing from a list instead of typing
// prevents spelling mistakes (for example "Santa Barbara" vs "Sta. Barbara"). At the bottom: one small helper for showing prices.

// The crops are NOT here any more: there are 104 of them, so they live in ONE place, the
// server's crop catalog (server/crops.js). React gets them with GET /api/crops (cropsService.js).

// Iloilo Province: 42 towns, Passi City and Iloilo City (same list as our Agos app)
export const TOWNS = [
  "Ajuy", "Alimodian", "Anilao", "Badiangan", "Balasan", "Banate",
  "Barotac Nuevo", "Barotac Viejo", "Batad", "Bingawan", "Cabatuan", "Calinog",
  "Carles", "Concepcion", "Dingle", "Dueñas", "Dumangas", "Estancia",
  "Guimbal", "Igbaras", "Janiuay", "Lambunao", "Leganes", "Lemery",
  "Leon", "Maasin", "Miagao", "Mina", "New Lucena", "Oton",
  "Pavia", "Pototan", "San Dionisio", "San Enrique", "San Joaquin", "San Miguel",
  "San Rafael", "Santa Barbara", "Sara", "Tigbauan", "Tubungan", "Zarraga",
  "Passi City", "Iloilo City",
];

// Writes a price the way people in the Philippines read it: 1500 -> "1,500.00"
// (add "₱" in front where you use it). Used on Market Prices, Crop Details and the listing cards.
export function formatPeso(amount) {
  return Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The address of a crop's Crop Details page. encodeURIComponent() makes spaces and brackets
// safe in a URL: "Banana (Saba)" -> "/crops/Banana%20(Saba)". React Router turns it back.
export function cropLink(cropName) {
  return "/crops/" + encodeURIComponent(cropName);
}
