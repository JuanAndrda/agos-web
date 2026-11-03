// constants.js: fixed lists the forms and filters use. Choosing from a list instead of typing
// prevents spelling mistakes (for example "Tomatoes" vs "Tomato"), so every listing matches
// a crop on the Market Prices page.

// The same 10 crops our server gets prices for from PSA (server/psa.js)
export const CROPS = [
  "Tomato", "Cabbage", "Carrots", "Eggplant", "Ampalaya",
  "Pechay", "Onion", "Squash", "Okra", "Kangkong",
];

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
