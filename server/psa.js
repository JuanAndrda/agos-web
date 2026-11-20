// psa.js: everything about talking to the PSA OpenSTAT API lives in this file.
//
// PSA's database uses a system called PxWeb. Every data table has its own web address,
// and we talk to it in two steps:
//   1. GET the table address  -> PSA tells us what is inside (crops, places, years, months), each with a code.
//   2. POST the codes we want -> PSA sends back the prices.
// The rules below are the same ones our Agos app uses, so we know they work with the real PSA.

const BASE_URL = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/";
const PROVINCE = "Iloilo"; // how PSA names our province
const MONTHS_BACK = 24; // PSA publishes prices a few months late, so we ask for the last 2 years
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The crops (and which PSA table has each one) are in crops.js, our crop catalog.
import { CROPS, tableOf } from "./crops.js";

// PSA puts dots in front of names to show levels, like "....Iloilo". We remove them.
function clean(text) {
  return text.replace(/\./g, "").trim();
}

// Which years and months we want: the last 24 months before today.
// Returns years like ["2024", "2025", "2026"] and a set like {"2026|June", "2026|May", ...}.
function wantedMonths(today) {
  const wanted = new Set();
  for (let i = 0; i < MONTHS_BACK; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    wanted.add(date.getFullYear() + "|" + MONTHS[date.getMonth()]);
  }
  const years = [...new Set([...wanted].map((w) => w.split("|")[0]))];
  return { wanted, years };
}

// Gets the prices of some crops from ONE PSA table.
async function fetchTable(table, psaNames) {
  // Step 1: GET the table to learn its codes. We give up after 30 seconds.
  const metaResponse = await fetch(BASE_URL + table, { signal: AbortSignal.timeout(30000) });
  if (!metaResponse.ok) {
    throw new Error(`PSA table ${table} answered with status ${metaResponse.status}`);
  }
  const meta = await metaResponse.json(); // { variables: [{ code, text, values, valueTexts }] }
  const { wanted, years } = wantedMonths(new Date());

  // Finds a variable (like "Commodity") and keeps only the codes whose names pass the test.
  function pick(name, keep) {
    const variable = meta.variables.find((v) => v.text.toLowerCase().includes(name));
    if (!variable) throw new Error(`PSA table ${table} has no "${name}" column`);
    const values = variable.values.filter((code, i) => keep(clean(variable.valueTexts[i])));
    if (values.length === 0) throw new Error(`PSA table ${table}: nothing matched "${name}"`);
    return { code: variable.code, selection: { filter: "item", values } };
  }

  // Step 2: POST the codes we want: Iloilo, our crops, the recent years, and every month.
  const query = [
    pick("geolocation", (text) => text === PROVINCE),
    pick("commodity", (text) => psaNames.includes(text)),
    pick("year", (text) => years.includes(text)),
    pick("period", (text) => MONTHS.includes(text)),
  ];
  const response = await fetch(BASE_URL + table, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json" } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`PSA table ${table} answered with status ${response.status}`);
  }
  const data = await response.json(); // { columns: [...], data: [{ key: [...codes], values: ["48.20"] }] }

  // Step 3: PSA sends codes like ["5", "0", "2", "5"]. We turn each code back into its name.
  function nameOf(columnIndex, code) {
    const variable = meta.variables.find((v) => v.code === data.columns[columnIndex].code);
    return variable ? clean(variable.valueTexts[variable.values.indexOf(code)]) : code;
  }

  const rows = [];
  for (const row of data.data) {
    // The columns come in this order: place, crop, year, month.
    const [, psaName, year, month] = row.key.map((code, i) => nameOf(i, code));
    const price = parseFloat(row.values[0]);
    if (!(price > 0)) continue; // PSA writes "." or ".." when a month has no price
    if (!wanted.has(year + "|" + month)) continue;
    rows.push({ psaName, year, month, price });
  }
  return rows;
}

// Gets the prices of all our crops. Returns a simple list the rest of the server can use:
// [{ crop: "Tomato", monthKey: "2026-06", month: "June 2026", pricePerKg: 48.2 }, ...]
export async function fetchPsaPrices() {
  // Many crops share a table (all fruits are in table 07), so we group them and call each
  // table only once: 6 tables for our 104 crops. Promise.all asks the 6 tables at the same time.
  const tables = [...new Set(CROPS.map((crop) => tableOf(crop)))];
  const results = await Promise.all(
    tables.map((table) =>
      fetchTable(
        table,
        CROPS.filter((crop) => tableOf(crop) === table).map((crop) => clean(crop.psaName))
      )
    )
  );

  const prices = [];
  for (const row of results.flat()) {
    const crop = CROPS.find((c) => clean(c.psaName) === row.psaName);
    if (!crop) continue;
    const monthNumber = String(MONTHS.indexOf(row.month) + 1).padStart(2, "0");
    prices.push({
      crop: crop.name,
      monthKey: `${row.year}-${monthNumber}`, // "2026-06", easy to sort
      month: `${row.month} ${row.year}`, // "June 2026", easy to read
      pricePerKg: row.price,
    });
  }
  return prices;
}
