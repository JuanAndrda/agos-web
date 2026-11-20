// reset.js: deletes ALL demo data that seed.js made, and nothing else. Run it from the server folder:
//
//     npm run demo:reset
//
// It deletes:
//   - every listing, order and user profile with  demo: true
//   - every order on a demo listing (for example, a test order YOU placed on a demo listing)
//   - the 9 demo login accounts (the emails that end with "@agosugnayan.test")
// Real listings, real orders and real accounts are never touched: we only ever look for
// demo: true, demo listing ids, and the demo emails.
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { DEMO_FARMERS, DEMO_BUYERS, demoEmail } from "./people.js";

// Deletes a list of documents, 400 at a time (a batch can hold up to 500 writes)
async function deleteAll(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = adminDb.batch();
    for (const doc of docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
}

async function main() {
  if (!adminDb || !adminAuth) {
    console.error("The server has no Firebase key (serviceAccountKey.json), so it can't reach the database.");
    process.exit(1);
  }

  // 1. Find the demo listings and orders
  const listings = await adminDb.collection("listings").where("demo", "==", true).get();
  const demoListingIds = listings.docs.map((doc) => doc.id);
  const orders = await adminDb.collection("orders").where("demo", "==", true).get();

  // 2. Orders that are not marked demo but are ON a demo listing (in groups of 30, Firestore's "in" limit)
  const extraOrders = [];
  for (let i = 0; i < demoListingIds.length; i += 30) {
    const group = demoListingIds.slice(i, i + 30);
    const snapshot = await adminDb.collection("orders").where("listingId", "in", group).get();
    for (const doc of snapshot.docs) {
      if (doc.data().demo !== true) extraOrders.push(doc);
    }
  }

  const users = await adminDb.collection("users").where("demo", "==", true).get();

  // 3. Delete them
  await deleteAll(orders.docs);
  await deleteAll(extraOrders);
  await deleteAll(listings.docs);
  await deleteAll(users.docs);

  // 4. Delete the demo login accounts
  let accounts = 0;
  for (const person of [...DEMO_FARMERS, ...DEMO_BUYERS]) {
    try {
      const user = await adminAuth.getUserByEmail(demoEmail(person.key));
      await adminAuth.deleteUser(user.uid);
      accounts++;
    } catch {
      // this demo account doesn't exist (already deleted), nothing to do
    }
  }

  console.log(
    `Deleted ${listings.size} demo listings, ${orders.size + extraOrders.length} demo orders, ` +
      `${users.size} demo profiles and ${accounts} demo accounts. Real data was not touched.`
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Reset stopped:", error.message);
    process.exit(1);
  }
);
