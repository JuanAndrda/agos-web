// seed.js: fills the database with DEMO data, so we can test pagination with a realistic
// amount of listings and orders. Run it from the server folder:
//
//     npm run demo:seed -- yourDemoPassword
//
// It makes:
//   - 6 demo farmers and 3 demo buyers (login accounts + "users" profiles)
//   - 66 demo listings (11 different crops per farmer: 63 for sale, 3 already sold)
//   - 45 demo orders with every status (waiting, accepted, completed, declined, cancelled)
//
// SAFE BY DESIGN:
//   - every record it writes has  demo: true , and the names end with "(Demo)"
//   - the demo emails end with "@agosugnayan.test" (".test" can never be a real email)
//   - the website shows a "Demo" badge on demo listings and orders
//   - it never reads, changes or deletes anything a real person made
//   - "npm run demo:reset" deletes ALL demo data (and only demo data)
// The demo password is typed when you run it, so it is never saved in our code or on GitHub.
// The data is the same every time (no random numbers), so a test can say "page 3 shows Okra".
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { findCrop } from "../crops.js";

import { DEMO_FARMERS, DEMO_BUYERS, demoEmail } from "./people.js";

// ---- What each farmer grows: 11 different crops each, and a reference price per kg ----
// The prices are near PSA's Iloilo farmgate prices (June 2026), a little higher or lower,
// like real farmers who set their own price.
const FARMS = {
  farmer1: [["Tomato", 42], ["Eggplant", 40], ["Ampalaya", 45], ["Okra", 48], ["Sitao", 46], ["Squash", 25], ["Pechay", 62], ["Kangkong", 18], ["Cucumber", 27], ["Siling labuyo", 95], ["Calamansi", 36]],
  farmer2: [["Cabbage", 32], ["Carrots", 42], ["Pechay Baguio", 31], ["Lettuce", 240], ["Cauliflower", 118], ["Bell pepper", 88], ["Spring onion", 175], ["Radish", 23], ["Chayote", 44], ["Snap beans", 30], ["Patola (Baguio)", 17]],
  farmer3: [["Onion", 52], ["Shallot", 50], ["Garlic", 68], ["Ginger (native)", 98], ["Finger pepper", 53], ["Tomato", 39], ["Eggplant (native round)", 68], ["Upo", 15], ["Patola (native)", 26], ["Malunggay", 42], ["Alugbati", 40]],
  farmer4: [["Banana (Saba)", 15], ["Banana (Lakatan)", 41], ["Banana (Latundan)", 19], ["Papaya (Solo)", 34], ["Papaya (native)", 22], ["Green papaya", 16], ["Young jackfruit", 12], ["Banana blossom", 21], ["Camote", 33], ["Cassava", 19], ["Gabi (Cebu)", 21]],
  farmer5: [["Mango (Carabao)", 65], ["Mango (Piko)", 60], ["Mango (Indian)", 24], ["Pineapple (native)", 17], ["Pomelo", 32], ["Rambutan", 40], ["Avocado", 45], ["Atis", 62], ["Guyabano", 24], ["Chico", 30], ["Santol", 26]],
  farmer6: [["Kadios", 90], ["Mongo (green, labo)", 70], ["Mongo (green, shiny)", 61], ["Peanut (dry)", 45], ["Sigarilyas", 44], ["Ubi", 26], ["Gabi (Tagalog)", 10], ["Camote tops", 28], ["Saluyot", 34], ["Squash tops", 20], ["Watermelon", 48]],
};

const NOTES = [
  "Freshly harvested this week.",
  "Sorted by size. Pickup at the farm.",
  "Grown without chemical pesticides.",
  "Can deliver within the town for big orders.",
  "Good for carinderias and markets.",
  "",
];

// ---- The orders: [buyer, farmer, crop number (0-10), kilos, status, days ago] ----
// 45 different orders. Farmer 1 (Maria) and buyer 1 (Ana) have the most, so their Orders
// pages have several pages to click through.
const ORDERS = [
  ["buyer1", "farmer1", 0, 20, "pending", 0], ["buyer1", "farmer1", 1, 15, "pending", 1],
  ["buyer1", "farmer1", 2, 10, "accepted", 1], ["buyer1", "farmer1", 3, 8, "completed", 2],
  ["buyer1", "farmer1", 4, 12, "completed", 3], ["buyer1", "farmer1", 5, 25, "declined", 3],
  ["buyer1", "farmer1", 6, 6, "pending", 4], ["buyer1", "farmer1", 7, 30, "accepted", 5],
  ["buyer1", "farmer1", 8, 18, "completed", 6], ["buyer1", "farmer1", 9, 2, "cancelled", 6],
  ["buyer1", "farmer2", 0, 40, "pending", 0], ["buyer1", "farmer2", 1, 25, "accepted", 2],
  ["buyer1", "farmer2", 3, 3, "completed", 4], ["buyer1", "farmer3", 0, 30, "pending", 1],
  ["buyer1", "farmer3", 2, 10, "completed", 5], ["buyer1", "farmer4", 0, 50, "pending", 2],
  ["buyer1", "farmer4", 8, 20, "accepted", 3], ["buyer1", "farmer5", 0, 15, "pending", 1],
  ["buyer1", "farmer5", 6, 10, "completed", 7], ["buyer1", "farmer6", 1, 5, "declined", 8],
  ["buyer1", "farmer6", 3, 8, "pending", 2],
  ["buyer2", "farmer1", 0, 35, "accepted", 2], ["buyer2", "farmer1", 1, 20, "completed", 4],
  ["buyer2", "farmer1", 5, 40, "pending", 1], ["buyer2", "farmer1", 7, 25, "pending", 3],
  ["buyer2", "farmer1", 10, 10, "completed", 9], ["buyer2", "farmer2", 0, 60, "completed", 6],
  ["buyer2", "farmer2", 9, 15, "pending", 1], ["buyer2", "farmer3", 0, 25, "accepted", 2],
  ["buyer2", "farmer3", 4, 6, "cancelled", 3], ["buyer2", "farmer4", 1, 30, "pending", 0],
  ["buyer2", "farmer5", 1, 12, "completed", 10], ["buyer2", "farmer6", 0, 4, "pending", 2],
  ["buyer3", "farmer1", 0, 3, "completed", 5], ["buyer3", "farmer1", 3, 2, "pending", 0],
  ["buyer3", "farmer1", 8, 4, "cancelled", 2], ["buyer3", "farmer1", 10, 2, "accepted", 1],
  ["buyer3", "farmer2", 2, 2, "pending", 1], ["buyer3", "farmer3", 9, 3, "completed", 6],
  ["buyer3", "farmer4", 4, 5, "pending", 0], ["buyer3", "farmer4", 9, 6, "declined", 4],
  ["buyer3", "farmer5", 2, 5, "accepted", 3], ["buyer3", "farmer5", 7, 3, "pending", 1],
  ["buyer3", "farmer5", 9, 4, "completed", 8], ["buyer3", "farmer6", 10, 8, "pending", 0],
];

// A Firestore time "days" days and "hours" hours ago
function timeAgo(days, hours) {
  return Timestamp.fromMillis(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);
}

// "2026-11-17": a harvest date a few days ago
function dateAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// Makes the login account (or reuses it if it is already there) and the "users" profile
async function makeAccount(key, name, role, password) {
  const email = demoEmail(key);
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(user.uid, { password: password, displayName: name });
  } catch {
    user = await adminAuth.createUser({ email: email, password: password, displayName: name });
  }
  await adminDb.collection("users").doc(user.uid).set({ name: name, email: email, role: role, demo: true });
  return user.uid;
}

async function main() {
  // 1. Checks before we write anything
  if (!adminDb || !adminAuth) {
    console.error("The server has no Firebase key (serviceAccountKey.json), so it can't reach the database.");
    process.exit(1);
  }
  const password = process.argv[2];
  if (!password || password.length < 6) {
    console.error("Type a demo password (6 characters or more) after the command, like:");
    console.error("    npm run demo:seed -- yourDemoPassword");
    process.exit(1);
  }
  const existing = await adminDb.collection("listings").where("demo", "==", true).limit(1).get();
  if (!existing.empty) {
    console.error("Demo data is already in the database. Run  npm run demo:reset  first, then seed again.");
    process.exit(1);
  }
  for (const list of Object.values(FARMS)) {
    for (const [crop] of list) {
      if (!findCrop(crop)) throw new Error(`"${crop}" is not in crops.js`);
    }
  }

  // 2. The accounts
  console.log("Making 9 demo accounts...");
  const uid = {};
  for (const f of DEMO_FARMERS) uid[f.key] = await makeAccount(f.key, f.name, "farmer", password);
  for (const b of DEMO_BUYERS) uid[b.key] = await makeAccount(b.key, b.name, "buyer", password);

  // 3. The listings. We first work out how many kilos the orders took, so the stock matches:
  //    a waiting, accepted or completed order took its kilos; a declined or cancelled one gave them back.
  const taken = {}; // like { "farmer1|0": 63 }
  for (const [, farmer, cropIndex, kg, status] of ORDERS) {
    if (status === "declined" || status === "cancelled") continue;
    const key = farmer + "|" + cropIndex;
    taken[key] = (taken[key] || 0) + kg;
  }

  console.log("Writing 66 demo listings...");
  const batch = adminDb.batch(); // a batch saves many writes in one trip (up to 500)
  const listingIds = {}; // like { "farmer1|0": "abc123" }
  const listingData = {};
  let n = 0;
  for (const farmer of DEMO_FARMERS) {
    FARMS[farmer.key].forEach(([crop, price], i) => {
      n++;
      const startKg = 60 + ((n * 37) % 9) * 45; // 60 to 420 kg, different for each listing
      const kgLeft = startKg - (taken[farmer.key + "|" + i] || 0);
      const listing = {
        crop: crop,
        quantityKg: kgLeft,
        pricePerKg: price,
        town: farmer.town,
        harvestDate: dateAgo(n % 6),
        contactNumber: farmer.phone,
        notes: NOTES[n % NOTES.length],
        status: i === 10 && n % 2 === 0 ? "sold" : "available", // a few are already sold
        ownerId: uid[farmer.key],
        ownerName: farmer.name,
        createdAt: timeAgo(n % 21, n % 24), // posted over the last 3 weeks
        demo: true,
      };
      const ref = adminDb.collection("listings").doc();
      batch.set(ref, listing);
      listingIds[farmer.key + "|" + i] = ref.id;
      listingData[farmer.key + "|" + i] = listing;
    });
  }

  // 4. The orders, copied from their listing like a real checkout does (server/orders.js)
  console.log(`Writing ${ORDERS.length} demo orders...`);
  const buyerName = {};
  for (const b of DEMO_BUYERS) buyerName[b.key] = b.name;
  ORDERS.forEach(([buyer, farmer, cropIndex, kg, status, daysAgo], i) => {
    const listing = listingData[farmer + "|" + cropIndex];
    batch.set(adminDb.collection("orders").doc(), {
      listingId: listingIds[farmer + "|" + cropIndex],
      crop: listing.crop,
      quantityKg: kg,
      pricePerKg: listing.pricePerKg,
      total: Math.round(kg * listing.pricePerKg * 100) / 100,
      town: listing.town,
      buyerId: uid[buyer],
      buyerName: buyerName[buyer],
      buyerEmail: demoEmail(buyer),
      farmerId: uid[farmer],
      farmerName: listing.ownerName,
      farmerContact: listing.contactNumber,
      status: status,
      createdAt: timeAgo(daysAgo, i % 24),
      demo: true,
    });
  });

  await batch.commit(); // everything is saved at once (or nothing, if it fails)
  console.log("Done. Log in with any demo email and the password you typed:");
  for (const f of DEMO_FARMERS) console.log(`  farmer: ${demoEmail(f.key)}  (${f.name})`);
  for (const b of DEMO_BUYERS) console.log(`  buyer:  ${demoEmail(b.key)}  (${b.name})`);
  console.log("To remove all demo data later:  npm run demo:reset");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Seeding stopped:", error.message);
    process.exit(1);
  }
);
