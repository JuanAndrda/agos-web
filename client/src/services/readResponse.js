// readResponse.js: reads the answer (the "response") that comes back from our Express server.
//
// Every response has a STATUS CODE: a number that says how the request went.
//   2xx = it worked          (200 OK, 201 Created)
//   4xx = OUR request had a problem (400, 401, 403, 404, 409)
//   5xx = the SERVER had a problem  (500, 502, 503)
// Our server always sends JSON. When something is wrong, the JSON has an "error" message in
// plain words, like { error: "Only 3 kg of Tomato is left." }, so we show that message.
// listingsService.js, ordersService.js and pricesService.js all use this function.

export async function readResponse(response) {
  // 1. Read the body of the response as JSON
  let data;
  try {
    data = await response.json();
  } catch {
    // It isn't JSON. This usually means our Express server is not running.
    throw new Error("Our server isn't answering right now. Please try again in a moment.");
  }

  // 2. Success: give the data back to the page
  if (response.status === 200) {
    return data; // 200 OK: the request worked (GET, PATCH and DELETE answer with 200)
  }
  if (response.status === 201) {
    return data; // 201 Created: a new item was saved in the database (POST answers with 201)
  }

  // 3. Something went wrong: throw an Error. The page catches it and shows the message.
  if (response.status === 400) {
    // 400 Bad Request: the data we sent is wrong, like a price of 0
    throw new Error(data.error || "Some of the information is wrong. Please check it.");
  }
  if (response.status === 401) {
    // 401 Unauthorized: we are not logged in, or the login has expired
    throw new Error(data.error || "Please log in first.");
  }
  if (response.status === 403) {
    // 403 Forbidden: we are logged in, but not allowed, like editing someone else's listing
    throw new Error(data.error || "You are not allowed to do this.");
  }
  if (response.status === 404) {
    // 404 Not Found: the thing we asked for doesn't exist, like a deleted listing
    throw new Error(data.error || "We couldn't find that. It may have been deleted.");
  }
  if (response.status === 409) {
    // 409 Conflict: the data changed in the meantime, like a crop that just sold out
    throw new Error(data.error || "This changed in the meantime. Please reload and try again.");
  }
  // 500 Internal Server Error (or 502, 503): a problem on the server side, not our fault
  throw new Error(data.error || "Something went wrong on the server. Please try again.");
}
