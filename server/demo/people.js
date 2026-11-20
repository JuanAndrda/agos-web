// people.js: the demo accounts, shared by seed.js (makes them) and reset.js (deletes them).
// ---- The demo people ----
// The phone numbers (0900 000 0001 ...) are made up for testing; they belong to nobody we know of.
export const DEMO_FARMERS = [
  { key: "farmer1", name: "Maria Santos (Demo)", town: "Pototan", phone: "09000000001" },
  { key: "farmer2", name: "Jose Dela Cruz (Demo)", town: "Janiuay", phone: "09000000002" },
  { key: "farmer3", name: "Liza Villanueva (Demo)", town: "Dumangas", phone: "09000000003" },
  { key: "farmer4", name: "Ramon Garcia (Demo)", town: "Cabatuan", phone: "09000000004" },
  { key: "farmer5", name: "Teresa Bautista (Demo)", town: "Miagao", phone: "09000000005" },
  { key: "farmer6", name: "Eduardo Ramos (Demo)", town: "Passi City", phone: "09000000006" },
];
export const DEMO_BUYERS = [
  { key: "buyer1", name: "Ana Reyes (Demo)" }, // runs a carinderia: orders often
  { key: "buyer2", name: "Ben Torres (Demo)" }, // a market vendor
  { key: "buyer3", name: "Carla Mendoza (Demo)" }, // a family that buys for home
];
export function demoEmail(key) {
  return `demo.${key}@agosugnayan.test`;
}
