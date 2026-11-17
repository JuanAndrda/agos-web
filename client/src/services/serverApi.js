// serverApi.js: sends one request to OUR Express server with the login token, and returns the
// JSON answer. listingsService.js and ordersService.js both use it, so this code is written once.
// "/api/..." works without "http://localhost:5000" because of the "proxy" line in client/package.json.
import { auth } from "../firebase";

export async function callServer(path, method = "GET", body) {
  let response;
  try {
    // The token is a long code from Firebase that proves who is logged in. Our server checks it.
    const token = await auth.currentUser.getIdToken();
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("We can't reach our server. Check your internet connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    // Not JSON: usually our Express server is not running
    throw new Error("Our server isn't answering right now. Please try again in a moment.");
  }

  if (!response.ok) {
    // Our server always explains the problem in "error", like "Only 3 kg of Tomato is left."
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
