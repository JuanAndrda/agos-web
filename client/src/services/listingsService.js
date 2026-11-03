// listingsService.js: every call to the "listings" collection in Firestore lives here.
// These six functions are the whole Create, Read, Update, Delete (CRUD) of our app.
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const listingsRef = collection(db, "listings");

// Firestore gives each document's data and ID separately. We put them together.
function toList(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// READ: every listing that is still available (Marketplace page)
export async function getAvailableListings() {
  const snapshot = await getDocs(query(listingsRef, where("status", "==", "available")));
  return toList(snapshot);
}

// READ: only my listings, available and sold (My Listings page)
export async function getMyListings(uid) {
  const snapshot = await getDocs(query(listingsRef, where("ownerId", "==", uid)));
  return toList(snapshot);
}

// CREATE: post a new crop
export function addListing(form, user) {
  return addDoc(listingsRef, {
    ...form,
    status: "available",
    ownerId: user.uid,
    ownerName: user.name,
    createdAt: serverTimestamp(), // Firebase fills in the date and time
  });
}

// UPDATE: edit a listing, or mark it sold
export function updateListing(id, changes) {
  return updateDoc(doc(db, "listings", id), changes);
}

export function markSold(id) {
  return updateListing(id, { status: "sold" });
}

// DELETE: remove a listing
export function deleteListing(id) {
  return deleteDoc(doc(db, "listings", id));
}

// Firestore error codes in plain words
export function friendlyListingError(error) {
  if (error.code === "permission-denied") {
    return "You can't change this listing. Only the farmer who posted it can.";
  }
  if (error.code === "unavailable") {
    return "No internet connection. Check your connection and try again.";
  }
  return "Something went wrong with the listings. Please try again.";
}
