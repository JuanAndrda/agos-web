# AgosUgnayan Web, explained file by file

This guide explains every file in our project in simple words: what it does, how it connects to the other files, and which API or database it uses. Each member should read the whole "big picture" part, then their own files closely.

---

## 1. The big picture

Our app has three parts that talk to each other. In Unit 2 terms, it is a **3-tier client-server app**:

| Tier | In our app | Where the code is |
|---|---|---|
| Client (what the user sees) | The React app in the browser | `client/` |
| Middle layer (application server) | Our Express server | `server/` |
| Data | Firestore (our database) and PSA's database | Firebase Console, PSA OpenSTAT |

Since Nov 15, **every listing request goes through our Express server**. React never touches the `listings` collection directly anymore. Only login and the `users` profiles still go straight from React to Firebase.

```
                    ┌──────────────────────────────────┐
                    │  React app (client/)             │
                    │  pages → services → APIs         │
                    └──┬───────────────┬────────────┬──┘
     login, profiles   │     prices,   │            │  photos
                       │     listings  │            │
                       ▼               ▼            ▼
          ┌─────────────────┐    ┌─────────┐   ┌───────────┐
          │ Firebase Auth + │    │ Express │   │ Wikipedia │
          │ Firestore users │    │ server  │   │ API       │
          └─────────────────┘    └──┬───┬──┘   └───────────┘
                          prices    │   │   listings (Firebase Admin)
                                    ▼   ▼
                   ┌──────────────┐   ┌────────────────────┐
                   │ PSA OpenSTAT │   │ Firestore listings │
                   └──────────────┘   └────────────────────┘
```
**The one rule that keeps it simple:** pages never call an API directly. A page calls a function from `services/`, and the service talks to Firebase, our server or Wikipedia. If Ma'am asks "where do you call the API?", the answer is always the `services` folder.

### Three things that happen in the app, step by step

**A. Someone logs in**
1. `pages/Login.js` checks the form, then calls `login(email, password)` from `services/authService.js`.
2. The service asks **Firebase Authentication** to check the password.
3. Firebase "rings the doorbell" in `context/AuthContext.js` (`onAuthStateChanged`). The context reads the person's name and role from the `users` collection in **Firestore**.
4. Every page can now read the person with `useAuth()`. The Login page sees `user` and moves to `/prices`.

**B. A farmer opens Market Prices**
1. `pages/MarketPrices.js` opens, and `useEffect` calls `getPrices("")` from `services/pricesService.js`.
2. The service sends `GET /api/prices` to **our Express server** (the `proxy` line in `client/package.json` forwards it to port 5000).
3. `server/index.js` checks its cache. If the prices are older than 1 hour, `server/psa.js` asks **PSA OpenSTAT** again.
4. The server keeps the newest price of each crop and sends back JSON.
5. The page saves it with `setPrices(...)` and React redraws the table. If anything fails, the page shows the error and a **Try again** button.

**C. A farmer posts a crop**
1. `pages/MyListings.js` shows `components/ListingForm.js`. The form checks every field first.
2. My Listings calls `addListing(form)` from `services/listingsService.js`.
3. The service asks Firebase for the person's **login token** (`getIdToken()`), a long code that proves who they are. It sends `POST /api/listings` to **our Express server**, with the form as JSON and the token in the `Authorization` header.
4. On the server, `requireLogin` (`server/auth.js`) checks the token with Firebase Admin and reads the person's role. `requireFarmer` stops buyers with **403**.
5. `server/listings.js` checks every field again, because anyone could send a request without our form. Wrong data gets **400** with the problems in plain words.
6. The server saves the listing in **Firestore**. It fills in `ownerId`, `ownerName` and `createdAt` itself, so nobody can post in someone else's name. It answers **201 Created** with the saved listing.
7. The page shows "Your Tomato listing is posted."

---

## 2. How each API and database was added

### Firebase (Authentication + Firestore)
- **Added by:** creating a project at console.firebase.google.com, turning on Email/Password login and Firestore, then running `npm install firebase` in `client/`.
- **Keys:** Firebase gives a small config (apiKey, projectId...). We put it in `client/.env`, never in our code. Create React App only reads names that start with `REACT_APP_`.
- **Used in code:** `firebase.js` connects once. `authService.js` uses it for login and the `users` profiles, and `listingsService.js` uses it only to get the login token.
- **Our data (Firestore):** two collections. A collection is like a folder, and each document inside is like an index card with JSON.
  - `users/{uid}`: `{ name, email, role }`, where role is `"farmer"` or `"buyer"`. The document ID is the same as the login ID.
  - `listings/{auto id}`: `{ crop, quantityKg, pricePerKg, town, harvestDate, contactNumber, notes, status, ownerId, ownerName, createdAt }`, where status is `"available"` or `"sold"` and `contactNumber` is the farmer's mobile number, saved as digits only (like `"09171234567"`). Only our server reads and writes this collection.

### Firebase Admin (on our server)
- **Added by:** `npm install firebase-admin` in `server/`, plus a secret key file from the Firebase Console (Project settings → Service accounts → **Generate new private key**), saved as `server/serviceAccountKey.json`. The key is in `.gitignore`.
- **Why the server needs its own key:** the React keys in `client/.env` only let the browser act as the person who is logged in, and the security rules limit what they can do. The server's key gives **full access**: it can check anyone's login token and read or write any listing. That's why the server does its own checks first, and why the key must stay secret.
- **Used in code:** `server/firebaseAdmin.js` connects once. `server/auth.js` checks login tokens. `server/listings.js` reads and writes the `listings` collection.

### PSA OpenSTAT (through our Express server)
- **Added by:** `npm init -y` and `npm install express cors` in `server/`, plus `"type": "module"` in its package.json so we can write `import`. No key is needed, and Node 18+ already has `fetch`.
- **How PSA works:** PSA's database (PxWeb) gives every table its own web address. Step 1: **GET** the address to learn the codes for crops, places, years and months. Step 2: **POST** the codes we want, and PSA sends back the prices.
- **Our tables:** farmgate prices are in four PSA tables (`NFG/0032M4AFN02/04/05/06.px`). We copied the exact table names and crop names from our Agos import script, which already works with the real PSA.
- **Used in code:** `server/psa.js` talks to PSA. `server/index.js` gives React our own two endpoints. `client/src/services/pricesService.js` calls them.

### Wikipedia
- **Added by:** nothing to install and no key. It works like the Dog API in Ma'am's example.
- **Endpoint:** `GET https://en.wikipedia.org/api/rest_v1/page/summary/Tomato`
- **Used in code:** `client/src/services/wikipediaService.js`, shown on the Crop Details page with the credit "Photo and text: Wikipedia".

---

## 3. The server files (`server/`)

### `server/package.json`
The server's ID card: its name, its packages (`express`, `cors`, `firebase-admin`), `"type": "module"`, and two commands: `npm start` (run) and `npm run dev` (run and restart when a file changes).

### `server/psa.js`: talks to PSA
- `CROPS`: our 10 crops, each with PSA's exact name and its PSA table. Example: our "Ampalaya" is PSA's "Ampalaya fruit [Bitter gourd]".
- `clean(text)`: PSA writes "....Iloilo" with dots to show levels. This removes them.
- `wantedMonths(today)`: the last 24 months. We ask for 2 years because PSA publishes prices a few months late.
- `fetchTable(table, psaNames)`: the two-step PSA call for one table. It GETs the codes, picks Iloilo, our crops, the years and the months, POSTs them, and turns PSA's codes back into names. Months with no price ("." or "..") are skipped. Each call gives up after 30 seconds.
- `fetchPsaPrices()`: calls each table once (4 tables for 10 crops) at the same time with `Promise.all`, and returns a simple list:
  `[{ crop: "Tomato", monthKey: "2026-06", month: "June 2026", pricePerKg: 48.2 }, ...]`

### `server/index.js`: our API
- `app.use(cors())` lets a page from another port call our server.
- **The cache:** `getPrices()` only calls PSA if we have nothing yet or the prices are older than one hour. This makes pages fast and doesn't overload PSA.
- **Endpoint 1, `GET /api/prices?search=tomato`:** the newest price of each crop. It checks the search text (more than 50 characters gives **400**), gets the prices, filters them, and sends `{ source, area, checkedAt, count, prices }`.
- **Endpoint 2, `GET /api/prices/:crop`:** every month's price of one crop, newest first, for the Crop Details page. An unknown crop gives **404**.
- If PSA fails, both endpoints answer **502** with a clear message instead of crashing.
- `app.use(express.json())` lets the server read the JSON that React sends with POST and PATCH.
- `app.use("/api/listings", listingsRouter)` plugs in the 5 listings endpoints from `listings.js`.
- Any other address gives **404** JSON. If a route crashes, the last middleware answers **500**. If someone sends broken JSON, it answers **400** instead.
- `app.listen(5000)` starts the server, or explains why it couldn't (for example, port 5000 is busy).

### `server/firebaseAdmin.js`: connects the server to Firebase
The server's version of `client/src/firebase.js`. It reads `serviceAccountKey.json`, connects with `initializeApp({ credential: cert(...) })`, and shares two tools: `adminAuth` (checks login tokens) and `adminDb` (reads and writes Firestore). If the key file is missing or broken, the server still starts and the prices still work. The listings endpoints then answer **503** with a message that says what's missing.

### `server/auth.js`: who is asking? (middleware)
A **middleware** is a function that runs **before** the route. It either lets the request go on with `next()`, or stops it and answers with an error. Unit 2 calls software between the client and the server "middleware", and Express uses the same word.
- `requireLogin`: reads the token from the header `Authorization: Bearer <token>`. No token gives **401** "Please log in first." Then `adminAuth.verifyIdToken(token)` asks Firebase whether the token is real and not expired (a fake or old one gives **401**). Then it reads the person's `name` and `role` from `users` and saves them in `req.user` for the route.
- `requireFarmer`: if `req.user.role` isn't `"farmer"`, it answers **403** "Only farmers can do this."

### `server/listings.js`: our listings API
Read each endpoint top to bottom: check who it is → check the data → use the database → answer with a status code and JSON.

| Method and address | What it does | Who can use it | Possible answers |
|---|---|---|---|
| `GET /api/listings` | Every available listing, newest first (Marketplace) | Anyone logged in | 200, 401 |
| `GET /api/listings/mine` | My own listings, available and sold (My Listings) | Farmers | 200, 401, 403 |
| `POST /api/listings` | Post a new crop | Farmers | 201, 400, 401, 403 |
| `PATCH /api/listings/:id` | Edit a listing, or mark it sold | The owner only | 200, 400, 401, 403, 404 |
| `DELETE /api/listings/:id` | Remove a listing | The owner only | 200, 401, 403, 404 |

- `FIELDS` and `pickFields`: only these 8 fields are copied from what React sends: crop, quantityKg, pricePerKg, town, harvestDate, contactNumber, notes and status. Anything else, like a fake `ownerId`, is ignored. Quantity and price become real numbers.
- `findProblems`: the same checks as the form. The crop must be one of our 10, kilos between 0 and 100,000, price between ₱0 and ₱10,000, a town, a date like 2026-11-20 (or empty), a mobile number like 09171234567, notes up to 200 characters, and status "available" or "sold". It only checks the fields that were sent, so "Mark as sold" works on an older listing that has no contact number.
- `toJson`: puts the document's ID and data together, and turns Firestore's time into text like `"2026-11-15T12:30:00.000Z"`, which JSON can carry.
- **PATCH, not PUT:** PUT means "replace the whole listing", and PATCH means "change only what I send". Mark as sold sends only `{ "status": "sold" }`, so PATCH is the right method.
- **The owner check:** PATCH and DELETE first read the listing. If it doesn't exist, **404**. If `ownerId` isn't the person in the token, **403**.

---

## 4. The client files (`client/`)

### Setup files
- **`package.json`**: React's packages (`react`, `react-router-dom`, `firebase`) and the line `"proxy": "http://localhost:5000"`. That line sends `/api/...` requests from React (port 3000) to our server (port 5000), so React can simply write `fetch("/api/prices")`.
- **`.env.example`**: the names of our 4 Firebase keys, with no values. Copy it to `.env` and fill it in. `.env` is never uploaded.
- **`public/index.html`**: the one HTML page. React puts the whole app inside `<div id="root">`. It also loads our two fonts, the same as Agos.
- **`public/manifest.json`**: the app's name and colors if someone adds it to a phone's home screen.

### `src/index.js`: the starting point
Puts `<App />` into `<div id="root">`.

### `src/App.js`: the routes
Decides which page shows for each URL, with `BrowserRouter`, `Routes` and `Route` like the React lesson.

| URL | Page | Who can open it |
|---|---|---|
| `/` | Home (the landing page) | Everyone |
| `/login`, `/register` | Login, Register | Everyone |
| `/prices` | Market Prices | Logged-in users |
| `/crops/:cropName` | Crop Details (`:cropName` is read from the URL) | Logged-in users |
| `/marketplace` | Marketplace | Logged-in users |
| `/my-listings` | My Listings | Farmers only |
| anything else | goes to `/` (Home) | |

If `client/.env` is missing, App.js shows "Firebase keys are missing" and how to fix it, instead of a blank page.

### `src/App.css`: the styles
All colors and fonts are saved as variables at the top (`--leaf`, `--leaf-dark`, `--harvest`...), so the look stays consistent and one change updates the whole app. The file is split into sections with titles, like `/* ---------- Navbar ---------- */`, in the same order as the screen: top bar, buttons, forms, page banner, Home, Log in, tables, listing cards. At the bottom, `@media (max-width: ...)` rules adjust the layout for tablets and phones (responsive design). See section 13 for the Nov 17 redesign.

### `src/firebase.js`: connects to Firebase
Reads the keys from `.env`, starts Firebase with `initializeApp`, and exports `auth` (login) and `db` (database). `firebaseReady` is `true` only when the keys are there.

### `src/constants.js`: fixed lists
`CROPS` (the same 10 crops as the server) and `TOWNS` (44 places in Iloilo). The forms use dropdowns from these lists, so nobody types "Tomatoes" or misspells a town. Every listing then links to a real crop page.

It also has one small helper, `formatPeso(1500)`, which gives `"1,500.00"`: two decimals and a comma every 3 digits, the way people in the Philippines read prices. Market Prices, Crop Details and the listing cards all use it, so prices look the same everywhere.

### `src/context/AuthContext.js`: who is logged in
- **What a context is:** data that many pages need, shared without passing it from page to page.
- `onAuthStateChanged` is like a doorbell: Firebase rings it when someone logs in or out. We then read their profile (`name`, `role`) from Firestore.
- `loading` is `true` until Firebase answers, so pages don't flash the login screen.
- `refreshUser()` reads the profile again. Register needs it because the name and role are saved a moment after Firebase logs the new person in.
- Any page uses it with `const { user } = useAuth();`.

### `src/services/`: every API call
| File | Talks to | Functions |
|---|---|---|
| `authService.js` | Firebase Auth + `users` collection | `register`, `login`, `logout`, `getProfile`, `friendlyAuthError` |
| `listingsService.js` | Our Express server | `getAvailableListings` → `GET /api/listings` and `getMyListings` → `GET /api/listings/mine` (Read), `addListing` → `POST` (Create), `updateListing` and `markSold` → `PATCH /api/listings/:id` (Update), `deleteListing` → `DELETE /api/listings/:id` (Delete), `friendlyListingError` |
| `pricesService.js` | Our Express server | `getPrices(search)` → `GET /api/prices`, `getPriceHistory(crop)` → `GET /api/prices/:crop` |
| `wikipediaService.js` | Wikipedia | `getCropInfo(cropName)` → `{ title, description, photo, link }`, and `getCropPhotos(crops)`, which gets many photos at the same time with `Promise.all` (Home and Market Prices use it) |

Two details to point out:
- **Friendly errors:** Firebase sends codes like `auth/invalid-credential`. `friendlyAuthError` turns them into "Wrong email or password." Our own server already answers in plain words (like "Only farmers can do this."), so `friendlyListingError` simply shows that message.
- **The login token:** `listingsService.js` has one helper, `callServer`, that every listings function uses. It gets the token with `auth.currentUser.getIdToken()` and sends it as `Authorization: Bearer <token>`. Firebase renews the token by itself every hour. It also turns "server not running" and "no internet" into clear messages, the same way `pricesService.js` does.
- **Wikipedia titles:** some crop names aren't Wikipedia page titles, so `WIKI_TITLES` says which page to use (Pechay → "Bok choy", Ampalaya → "Momordica charantia", Squash → "Calabaza", and so on). These are the same pages Agos uses.

### `src/layouts/MainLayout.js`
The frame every page sits in: `Navbar`, then the page (`children`), then `Footer`.

### `src/components/`: reusable pieces
| File | What it does |
|---|---|
| `Logo.js` | Our small leaf logo, drawn with SVG code instead of an image file. It uses `currentColor`, so it takes the color of the text around it. |
| `PriceChart.js` | The line chart on Crop Details, drawn with SVG, no chart library. A `ResizeObserver` measures the box so the chart fills it. Each price becomes a point (`xOf` for left-right by month, `yOf` for up-down by price), and the line is an SVG `path` ("M" moves the pen, "L" draws to the next point). Each point is a button: click it, point at it, or Tab to it and press Enter, and the line above the chart shows that month's price and how it changed from the month before. |
| `AuthPanel.js` | The green welcome panel on the left of Log in and Register (the split screen). Both pages share it. |
| `Navbar.js` | The white top bar (green before Nov 17). When nobody is logged in it shows Log in and Create account. Uses `NavLink`, which highlights the page you're on. Shows My Listings only to farmers, plus the person's name, role and Log out. A long name is cut short with "…" so the bar stays tidy, and the full name shows when you point at it (the `title` attribute). Moving between pages doesn't reload the page, so our app is a single-page application (SPA). |
| `Footer.js` | Says where our data comes from (PSA, monthly, not real-time; Wikipedia). |
| `Loading.js` | A spinner and text while we wait for an API. |
| `ErrorMessage.js` | A red box with the problem and a "Try again" button. |
| `ProtectedRoute.js` | A guard. Not logged in → `/login`. A buyer opening My Listings → `/marketplace`. |
| `SearchBar.js` | A labelled search box. With `onSubmit` it has a Search button (Market Prices); without it, the page filters as you type (Marketplace). |
| `ListingCard.js` | One listing as a card: crop, price, kilos, town, harvest date, farmer, contact number, notes, and "Available" or "Sold" written in words (not color alone). The number is a `tel:` link, so on a phone one tap opens the phone app to call or text. `formatPhone` writes it as "0917 123 4567" so it's easy to read. My Listings adds its buttons as `children`, and hides the Farmer and Contact lines with `showFarmer={false}` (every listing there is your own). |
| `ListingForm.js` | The post and edit form. `checkForm` explains every wrong field ("Choose your town."). The Contact number must be a Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX); `cleanNumber` removes spaces and dashes first, so "0917-123 4567" is fine. The edit form also has a Status field, so a farmer can change "Sold" back to "Available". It scrolls into view when it opens. After a failed save, a `useEffect` puts the cursor in the first wrong field, which helps keyboard and screen reader users. |

### `src/pages/`: one file per screen
Every page that uses an API follows the same pattern. **State** for the data, loading and error → **`useEffect`** to load when the page opens → call a **service** → show **loading, error, empty, or the data**. Once you understand one page, the others read the same way.

Every page also sets the name in the browser tab, like "Market Prices · AgosUgnayan Web", with one small `useEffect` that changes `document.title`.

- **`Home.js`** (Nov 17): the landing page at `/`. Anyone can open it. A big welcome box (the "hero"), one tile per crop with its newest PSA price (`GET /api/prices`, which needs no login) and its Wikipedia photo (`getCropInfo`, the same as Crop Details), and "How it works" in 3 steps. `getCropPhotos` (in `wikipediaService.js`) asks Wikipedia for all the photos at the same time with `Promise.all`; if one photo fails, that tile shows the crop's first letter instead.
- **`Login.js`**: email and password. Checks that both are filled, calls `login()`, and shows Firebase errors in plain words.
- **`Register.js`**: name, email, password (6+ characters) and a Farmer/Buyer choice. `checkForm()` finds every problem at once and shows each one under its own field, the same way as the listing form, then puts the cursor in the first one. Calls `register()`, then `refreshUser()`.
- **`MarketPrices.js`**: the newest PSA farmgate price of each crop, with search. Since Nov 17 each crop is a clickable card with its Wikipedia photo, price and month; clicking it opens Crop Details. Above the cards, 3 summary boxes show the lowest price, the highest price and how many crops are shown. They are worked out in React with `reduce()` from the same prices, so there is no extra API call. Always shows the source ("PSA OpenSTAT"), the month of each price, and when our server last checked PSA, written as "Nov 5, 2026, 2:14 AM" so nobody mixes up the day and the month. `useCallback` keeps `loadPrices` the same between redraws, so `useEffect` runs only once.
- **`CropDetails.js`**: uses two APIs at the same time. It finds the crop whatever the capital letters are, so `/crops/tomato` also works. The left card is Wikipedia (photo and description). The right card is our server (`GET /api/prices/Tomato`): since Nov 17 it shows 3 boxes (latest price, previous month, and the change up or down in pesos and %), then a line chart of the last 12 months (`PriceChart.js`). The table is still there behind "Show all months as a table" (a `<details>` element, which opens and closes without any JavaScript). Each card has its own loading and error, so if Wikipedia is down, the prices still show.
- **`Marketplace.js`**: loads every available listing once from our server (`GET /api/listings`), then searches, filters (town, min and max price) and sorts (newest, price low→high, high→low) in React with `.filter()` and `.sort()`. Shows "Showing 2 of 5 listings" and a Clear filters button. If the max price is lower than the min price, it says so under the Max field instead of just showing "no listings". The filters stay in React, not on the server, so the results change instantly while you type, with no waiting.
- **`MyListings.js`**: the farmer's own listings with all of CRUD, each one a request to our server. **Post a crop** (Create, `POST`), the list (Read, `GET /mine`), **Edit** and **Mark as sold** (Update, `PATCH`), **Delete** (`DELETE`). Delete asks "This can't be undone" first. Every action shows a success or error message, and the buttons are disabled while it saves.

---

## 5. `firestore.rules`: the database's guard
Anyone can open the browser tools and try to change data directly, so Firestore checks every request against these rules **on Google's servers**. That makes them part of our server-side logic.
- `request.auth` is the person asking.
- **`users`:** logged-in people can read profiles (to show names), and people can only write their own profile.
- **`orders` (Nov 17): `allow read, write: if false`**, the same as listings. Only `server/orders.js` uses orders.
- **`listings`: `allow read, write: if false`**, which means nobody, from any browser. Since Nov 15 only our server uses listings, and Firebase Admin skips the rules. Blocking everyone else means nobody can skip our server's checks by calling Firestore directly. The checks that used to be here (farmers only, your own listings only, numbers above 0) now live in `server/auth.js` and `server/listings.js`.

---

## 6. HTTP methods and status codes in our code

| Method | Where |
|---|---|
| GET | `GET /api/prices`, `GET /api/prices/:crop`, `GET /api/listings`, `GET /api/listings/mine`, `GET /api/orders/mine`, `GET /api/orders/received` (React → our server), GET the PSA table codes (server → PSA), `GET /page/summary/...` (React → Wikipedia), `getDoc` (profiles in Firestore) |
| POST | `POST /api/listings` (new listing, React → our server), `POST /api/orders` (checkout), server → PSA (sends the query), Firebase login and register |
| PATCH | `PATCH /api/listings/:id` (edit, mark sold): only the fields we send change. `PATCH /api/orders/:id` (accept, decline, cancel) |
| DELETE | `DELETE /api/listings/:id` (delete a listing) |

| Code | When our app sends or gets it |
|---|---|
| 200 OK | Prices or listings loaded, a listing changed or deleted |
| 201 Created | A new listing was saved, or the cart was sent as orders |
| 400 Bad Request | Search text longer than 50 characters, a listing with wrong data (like price 0), nothing to change, or broken JSON |
| 401 Unauthorized | No login token, or a fake or expired one |
| 403 Forbidden | A buyer tries to post, someone tries to change or delete another farmer's listing, a farmer tries to place an order ("Only buyers can place orders."), or someone accepts, declines or cancels an order that isn't theirs |
| 404 Not Found | `/api/prices/Banana` (crop we don't track), a listing or order that doesn't exist, or Wikipedia has no page |
| 409 Conflict | An order asks for more kilos than are left ("Only 2 kg of Tomato is left"), the listing is sold out, or the order was already accepted, declined or cancelled |
| 500 Server Error | Something crashed inside our server |
| 502 Bad Gateway | PSA didn't answer our server |
| 503 Service Unavailable | Our server has no Firebase key yet, so the listings are off |

---

## 7. Starter files we removed
Create React App makes some example files we don't use, so we deleted them to keep the project easy to read: `App.test.js` (a sample test for the React logo page), `setupTests.js` (test setup), `logo.svg` (the spinning React logo), `reportWebVitals.js` (speed measuring), `index.css` (we keep all styles in `App.css`) and the starter `README.md`.

---

## 8. Small differences from the study guide
The code follows the study guide. These are the places where it differs:
1. **PSA:** the guide had a placeholder table. The real code uses the exact tables and names from Agos, and the GET-then-POST steps.
2. **A second endpoint, `GET /api/prices/:crop`,** gives Crop Details the price month by month. `/api/prices` now gives the newest price per crop (10 rows), not every month.
3. **The 404 and 500 handlers** are in the server already (the guide had them in Week 4).
4. **`constants.js`** is a new file with the crop and town lists for the dropdowns.
5. **`firebaseReady`** shows a help message when `.env` is missing, instead of a blank page.
6. **`refreshUser()`** in AuthContext makes sure a new account's role shows right away.
7. **`NavLink`** instead of `Link` in the Navbar, so the open page is highlighted.
8. **The edit form has a Status field**, so "Mark as sold" can be undone.
9. **Wikipedia titles:** 6 crops are mapped (the guide had 3), the same as Agos.
10. **Week 4 upgrade: PATCH instead of PUT.** The guide used PUT but sent only the changed fields. That is what PATCH means, so the code uses PATCH.
11. **Week 4 upgrade: Marketplace filters stay in React.** The guide filtered on the server (`?town=Leon&maxPrice=60`). Filtering in React keeps the results instant while you type, and the server still does the checking and saving.
12. **Week 4 upgrade: more checks on the server.** The server checks the same things as the form, including the crop list, the contact number and the 200-character notes. It only checks the fields that were sent, so "Mark as sold" works on older listings.
13. **Week 4 upgrade: no crash without the key.** If `serviceAccountKey.json` is missing, the prices still work and the listings say what's missing (**503**).
14. **Week 4 upgrade: newer Firebase Admin imports,** `import { initializeApp, cert } from "firebase-admin/app"`, which look like the ones in `client/src/firebase.js`.

---

## 9. Usability fixes after the heuristic check (Nov 10)
On Nov 5 we checked every page against Nielsen's 10 usability heuristics and found 13 problems (the full report is the "AgosUgnayan Web: Heuristic Check" doc). Juan approved fixing problems 2 to 11. These are the changes. None of them adds a feature or changes the database.

| # | The problem | What we changed | File |
|---|---|---|---|
| 2 | On a phone the top bar took a quarter of the screen, and a long name pushed My Listings to a new row | A long name is cut with "…". On phones the bar has 3 short rows: [AgosUgnayan, Log out], [name, badge], [the 3 links on one row]. Below 980 pixels wide, the links get their own row instead of wrapping. On a phone the bar went from 222 to 134 pixels tall. | `Navbar.js`, `App.css` |
| 3 | Some links were too small to tap (20 to 40 pixels tall) | The navbar links, Log out, the crop names in the price table and "Back to Market Prices" are now at least 44 pixels tall to tap. They look the same. | `App.css` |
| 4 | After a failed "Post listing", the cursor stayed on the button | The cursor moves to the first wrong field. | `ListingForm.js` |
| 5 | Min price above max price only said "No listings match" | It says "Max price can't be lower than min price." under the Max field. | `Marketplace.js` |
| 6 | Register showed one problem at a time, at the top | Every problem shows under its own field, like the listing form. | `Register.js` |
| 7 | The browser tab always said "AgosUgnayan Web" | Each page has its own tab name. | the 6 files in `pages/` |
| 8 | "11/5/2026" can mean Nov 5 or May 11 | It now says "Nov 5, 2026, 2:14 AM". | `MarketPrices.js` |
| 9 | Big prices had no comma ("₱1500.00") | "₱1,500.00" and "2,500 kg", using `formatPeso`. | `constants.js`, `MarketPrices.js`, `CropDetails.js`, `ListingCard.js` |
| 10 | Every card on My Listings said "Farmer: your own name" | The Farmer line is hidden on My Listings only. | `ListingCard.js`, `MyListings.js` |
| 11 | `/crops/tomato` said the crop didn't exist | Capital letters don't matter anymore. | `CropDetails.js` |

**Tested:** 49 checks in a browser with the local test tools: every fix above, plus register, login, search, Crop Details, post, edit, mark as sold, filters and Clear filters still working. Laptop sizes 1280, 1024 and 900 pixels wide, a tablet (768) and phones (390, 360 and 320). There was no sideways scrolling, no JavaScript errors, and the build has no warnings.

**To undo all of these fixes with Git:** `git revert` the commit named "Usability fixes from the heuristic check". The version before the fixes is also saved with the tag `v1-before-usability-fixes`.

---

### The Contact number (Nov 15)
The heuristic check's biggest problem (number 1) was that **a buyer had no way to contact the farmer**: they could find pechay in Pototan, but couldn't take the next step and buy it. Juan approved adding a contact number.

- **What changed for farmers:** the Post and Edit form has a new required field, **Contact number**. The help text under it says who will see it: "Logged-in buyers will see it, so they can call or text you." A wrong number gets a clear message ("Enter your mobile number, like 0917 123 4567.") and the cursor moves to the field.
- **What changed for buyers:** each Marketplace card shows **Contact: 0917 123 4567**. On a phone, tapping it opens the phone app (that's what a `tel:` link does).
- **The database:** listings have one more field, `contactNumber`. Firestore doesn't need any setup for a new field: the next listing saved simply has it. **The security rules didn't change**, and only logged-in users can read listings, so the number isn't public on the internet.
- **Older listings** (posted before Nov 15) have no number. Their card just doesn't show a Contact line. When the farmer opens Edit, the form asks for the number before it saves.
- **Files:** `ListingForm.js` (the field, `cleanNumber` and the check), `ListingCard.js` (`formatPhone` and the `tel:` link), `App.css` (`.contact-link`, a 44-pixel tap area that stays on one line).
- **Tested:** 59 browser checks, including all 49 earlier ones. The new ones cover: the number is required, a wrong number is caught, spaces and dashes are allowed, the card shows "0917 123 4567" with a `tel:` link, +63 numbers, an older listing without a number, editing an older listing, no Contact line on My Listings, and tapping the number on a phone.
- **To undo just this change with Git:** `git revert` the commit named "Listings: contact number so buyers can reach the farmer". The version before it is saved with the tag `v2-before-contact-number`.

---

## 10. Listings through our own Express API (Nov 15)
This is the "Week 4 upgrade" from the study guide, which Juan approved on Nov 3 and started on Nov 15. Before, React wrote listings straight into Firestore, and the security rules did the checking. Now every listing request goes to **our Express server**, which checks who is asking and checks the data, and only then uses Firestore.

**Why:** our server now does real work for listings, not only prices. It has its own endpoints with all four methods (GET, POST, PATCH, DELETE), checks the login token, checks the data, and answers with proper status codes. That is what the rubric means by server-side logic and a custom API.

**What changed:**

| File | Change |
|---|---|
| `server/firebaseAdmin.js` | New. Connects the server to Firebase with the secret key. |
| `server/auth.js` | New. The `requireLogin` and `requireFarmer` middleware. |
| `server/listings.js` | New. The 5 listings endpoints and their checks. |
| `server/index.js` | Reads JSON (`express.json()`), plugs in the listings routes, answers 400 for broken JSON. |
| `server/package.json` | Adds `firebase-admin`. |
| `client/src/services/listingsService.js` | Rewritten: sends requests to our server with the login token, instead of using Firestore. The function names are the same. |
| `client/src/pages/Marketplace.js`, `MyListings.js` | Small changes: the time now arrives as text (`Date.parse`), and errors show the server's message. |
| `firestore.rules` | `listings` is locked (`if false`), so only our server can use it. |
| `README.md` | New setup step 4 (the server's key) and new troubleshooting rows. |

**What Juan does once on his laptop:** run `npm install` in `server`, download the key (README step 4), restart the server, check that everything works, and then paste the new `firestore.rules` into the Firebase Console and click Publish. Publish the rules **last**: the old code reads listings directly, so it stops working once the rules are locked.

**Existing listings keep working.** The data in Firestore didn't change shape. The server sends `createdAt` as text, and the pages read it with `Date.parse`.

**To undo just this change with Git:** `git revert` the commit named "Listings through our own Express API". The version before it is saved with the tag `v3-before-express-listings`. If you already published the locked rules, paste the old rules back too (they're in that tag's `firestore.rules`).

---

## 11. What was tested, and what wasn't
Tested on a computer without the real services, using stand-ins:
- **Server:** with a fake PSA that answers in PSA's real format. All endpoints, the search check (400), unknown crop (404), PSA down (502), the 1-hour cache (4 requests, PSA called only once per table) and the busy-port message.
- **The listings API (Nov 15), 36 checks** with the real server and Firebase's emulators: no token and a fake token (401), a buyer posting or opening `/mine` (403), every wrong field (400 with the problems), broken JSON (400), a fake `ownerId` being ignored, new listings starting as available, another farmer's PATCH and DELETE (403), unknown listings (404), Mark as sold on an older listing without a number, sold listings leaving the Marketplace, the locked rules blocking the browser, and the prices still working. Without the key file, the listings answer 503 and the prices still work.
- **The whole app in a browser,** with Firebase's official local test tools (emulators): register, login, wrong password, every page, search, filters, sort, all CRUD actions, buyer vs farmer access, error screens, and phone size (no sideways scrolling). After the Nov 15 change, all 59 earlier browser checks still pass, plus 12 new ones: the pages send GET, POST, PATCH and DELETE to `/api/listings` with the token, the browser no longer reads Firestore listings, and clear messages show when the server is stopped or has no key.
- **Security rules:** 13 checks before Nov 15, for example "a buyer can't delete a farmer's listing". Since Nov 15 the listings rules are locked, and the tests check that the browser can't read or write listings directly.

**Tested on Juan's laptop with the real services (Nov 3 and 4):** the real PSA (all 10 crops), a real Firebase project (register, log in, post, edit, mark as sold), and Crop Details with Wikipedia. Our test computer can't reach PSA or Wikipedia, so those were only checked on Juan's laptop. If prices ever stop loading, open http://localhost:5000/api/prices first to see whether PSA is answering.

**Not tested yet:** the Nov 15 listings change with the **real** Firebase project and a real key. That needs Juan's laptop (README step 4).

---

## 12. Undoing a change
The project uses Git, with one commit per part:
```
git log --oneline          # see the saved steps
git diff                   # see what changed since the last save
git checkout -- <file>     # throw away unsaved changes to one file
git revert <commit-id>     # undo one saved step, keeping everything after it
```

---

## 13. The redesign (Nov 17)
The look changed to a modern "fresh market" style. **No feature changed**: the same pages, buttons, checks, messages and API calls. The one new page is Home.

| What you see | How it's done | Files |
|---|---|---|
| New colors: leaf green, deep green, soft green, and one warm "harvest gold" for small highlights | The variables at the top of `App.css` got new names and values | `App.css` |
| New heading font, Plus Jakarta Sans (Inter stays for normal text) | One Google Fonts link | `public/index.html`, `App.css` (`--display`) |
| White top bar with a leaf logo, the page links in one round "pill", and a round avatar with your initials | `initials("Ana Reyes")` gives "AR". `position: sticky` keeps the bar at the top while you scroll | `Navbar.js`, `Logo.js`, `App.css` |
| A green banner at the top of Market Prices, Crop Details, Marketplace and My Listings | A `<div className="page-banner">` around each page's title. On the Marketplace, `page-banner-tall` plus a negative margin makes the filter box overlap the banner | the 4 pages, `App.css` |
| Listings look like product cards: a colored top with the crop name and status, then the price, facts, and "Sold by ... ☎ number" at the bottom | `ListingCard.js` has the same data in a new order. `.listing-card:hover` lifts the card a little | `ListingCard.js`, `App.css` |
| Market Prices as clickable cards with photos (5 in a row on a laptop, 2 on a phone), the search inside the green banner, and 3 summary boxes: lowest price, highest price, crops shown | The table became a grid of `<Link className="price-card">`, so the whole card is clickable. `getCropPhotos(CROPS)` loads the 10 photos once. `reduce()` finds the lowest and highest price. The lowest and highest boxes are links to that crop too | `MarketPrices.js`, `wikipediaService.js`, `App.css` |
| Log in and Register as a split screen | `.auth-page` is a CSS grid with 2 columns: `AuthPanel` and the form. On a phone it becomes 1 column | `Login.js`, `Register.js`, `AuthPanel.js`, `App.css` |
| A line chart of the price history on Crop Details, with Latest price, Previous month and Change boxes. Click a point to see that month's price | `PriceChart.js` draws it with SVG. The change is `latest - previous`, and the % is `change / previous × 100`. Up or down is shown with ▲/▼ and the words "Up"/"Down", not color alone | `CropDetails.js`, `PriceChart.js`, `App.css` |
| A Home page | See `Home.js` above. The drawing is `public/basket.svg` | `Home.js`, `App.js`, `public/basket.svg` |
| Log out now goes to Home instead of Log in | `navigate("/")` | `Navbar.js` |

**The usability fixes from section 9 are kept:** buttons and links at least 44 pixels tall, the orange keyboard focus ring, long names cut with "…", errors written in words under each field, "Available" and "Sold" in words, the 3-row top bar on phones, and no sideways scrolling. New on phones: "Create account" hides from the top bar to save room (Home and Log in still link to it), and the Home drawing hides so the text comes first.

**Tested** with the same emulator setup as section 11, on a laptop size (1280 pixels) and a phone size (390 pixels), with stand-in prices, listings and photos. `npm run build` has no warnings.

---

## 14. Suggested price, cart and orders (Nov 17)
Three new features, built on top of the redesign. Juan approved them on Nov 17, and later that day decided that farmers only sell and buyers only buy.

### Part 1: the PSA suggested price
**What you see:** on the "Post a crop" form, choose a crop and a green box shows *"PSA farmgate price for Tomato: ₱48.20/kg (June 2026)"* with a **Use this price** button. The button copies the price into the price box. The farmer can still type any price.

**How it works (file: `client/src/components/ListingForm.js`):**
1. When the form opens, a `useEffect` calls `getPrices()` once. That is our own `GET /api/prices` (server/index.js), which gets the prices from PSA.
2. We turn the list into an object by crop name, like `{ Tomato: { pricePerKg: 48.2, month: "June 2026" } }`, and keep it in state (`psaPrices`).
3. `psaPrices[form.crop]` is the suggestion for the crop that is chosen. No new API was needed.
4. `applySuggestedPrice()` does `setForm({ ...form, pricePerKg: ... })`, the same way typing does.
5. If PSA is down, the form still works: it just says the PSA price isn't available.

### Part 2: the orders API (server)
**New file `server/orders.js`, 4 endpoints:**

| Endpoint | Who | What it does |
|---|---|---|
| `POST /api/orders` | buyers only | Checkout. React sends `{ items: [{ listingId, quantityKg }] }`. Makes one order per listing and lowers each listing's stock. |
| `GET /api/orders/mine` | buyers only | The orders I sent ("My orders") |
| `GET /api/orders/received` | farmers only | The orders on my listings ("Orders received") |
| `PATCH /api/orders/:id` | the buyer or the farmer of that order | `{ status: "accepted" }` or `"declined"` (the farmer), `"cancelled"` (the buyer) |

**Farmers sell, buyers buy.** The roles are checked by middleware in `server/auth.js`, the same way `requireFarmer` already protects posting a listing. The new `requireBuyer` answers **403 "Only buyers can place orders."** to anyone who isn't a buyer. The role comes from the person's `users` document in Firestore, not from React, so nobody can fake it.

**The checks in `POST /api/orders`, in order:**
0. You are logged in (`requireLogin`, else **401**) and you are a buyer (`requireBuyer`, else **403**).
1. The cart is not empty, has at most 20 listings, and no listing twice → else **400**.
2. Each quantity is a whole number of kilos, more than 0 → else **400**.
3. The listing still exists → else **404**.
4. It isn't your own listing → else **403**. (Buyers have no listings, so this is only extra safety.)
5. It isn't sold out → else **409**.
6. You don't want more than is left → else **409** "Only 2 kg of Tomato from Ana Reyes is left."

**The Firestore transaction (the important part).** Two buyers could order the last 5 kg at the same moment. Without a transaction both would read "5 kg left", both would pass the check, and we would sell 10 kg. `adminDb.runTransaction()` fixes this:
- **Read** all the listings first (`transaction.getAll`).
- **Check** them. If one fails, we `throw`, and **nothing** is saved, not even the other items in the cart.
- **Write** everything together: lower each stock (`transaction.update`) and save each order (`transaction.set`).
- If someone else changed a listing between our read and our write, Firestore runs our code again with the new numbers. So only one buyer gets the last kilos and the other gets a 409. (We tested this with two buyers at once.)

**Sold out:** when the stock reaches 0 kg, the server sets the listing's `status` to `"sold"`, so it leaves the Marketplace. The card says **Sold out** (in `ListingCard.js`) instead of "Sold", so the farmer can tell it apart from "Mark as sold".

**What an order looks like in Firestore (`orders` collection):**
`{ listingId, crop, quantityKg, pricePerKg, total, town, buyerId, buyerName, buyerEmail, farmerId, farmerName, farmerContact, status: "pending", createdAt }`. We copy the price and names into the order, so the order still makes sense if the farmer later edits or deletes the listing.

**`PATCH /api/orders/:id`:** only a `"pending"` order can change (else **409**). Decline and Cancel put the kilos back on the listing, in a transaction too. If the listing was sold out because of orders, it becomes available again. If the farmer deleted the listing, the order still changes.

**There is no payment.** An order is a request. After the farmer accepts, they agree on payment and pickup by phone (the buyer sees the farmer's number, the farmer sees the buyer's email).

### Part 3: the cart (React)
| File | What it does |
|---|---|
| `context/CartContext.js` | New. Keeps the cart in React state, like `AuthContext.js` keeps the user. `addToCart`, `changeQuantity`, `removeFromCart`, `clearCart`. The cart empties when someone else logs in. It isn't saved anywhere, so a page reload empties it too. |
| `components/AddToCart.js` | New. The "kilos + Add to cart" box on each Marketplace card. Checks: whole kilos, more than 0, and not more than what's left (it counts what's already in your cart). |
| `pages/Cart.js` | New. Change kilos, remove, the total (`reduce()`), and **Send order request** → `POST /api/orders`. If the server says no (for example someone else bought first), its message is shown and the cart stays. |
| `pages/Marketplace.js` | Buyers get `<AddToCart>` on each card. Farmers get no box, and their own listings say "This is your listing". |
| `components/Navbar.js` | A cart button with the number of items (buyers only), and an **Orders** link (everyone). |
| `App.js` | `<CartProvider>` around the app, and the routes `/cart` (`<ProtectedRoute role="buyer">`, so a farmer is sent to the Marketplace) and `/orders`. |

**Why check in React AND on the server?** React checks first so the buyer gets a quick message. The server checks again because the stock can change after the page loaded, and because anyone can send a request without our page.

### Part 4: the Orders page (`pages/Orders.js`)
The page shows one list, depending on your role (`isFarmer` in the code):
- **Buyer → My orders:** each order with its status in words (Waiting for the farmer, Accepted, Declined, Cancelled) and a **Cancel order** button while it's waiting.
- **Farmer → Orders received:** the buyer's name and email, with **Accept** and **Decline** buttons while it's waiting.
- Each button calls `setOrderStatus()` in `services/ordersService.js` → `PATCH /api/orders/:id`, then loads the list again.

### Other small changes
- `services/serverApi.js` is new: the "send a request with the login token" code that `listingsService.js` had. Now listings and orders both use it, so it's written once.
- `server/index.js` plugs in the orders routes: `app.use("/api/orders", ordersRouter)`.
- `firestore.rules` locks the new `orders` collection, like listings.
- On a phone the page links are a little smaller, so a farmer's 4 links fit in one row.
- The top bar stays on one row on a laptop. The right side (`.nav-user`) has `flex: 1 1 0` and `min-width: 0`, so when space is short the long name gets shorter with "…" instead of the whole right side dropping to a second row. Below 1080 pixels wide (was 980) the page links move to their own row.

**What Juan does once:** paste the new `firestore.rules` into the Firebase Console and click Publish. The app works without this step (our server uses Firebase Admin, which skips the rules), but publishing it stops anyone from reading orders straight from the browser.

**Tested** on the Firebase emulators: 45 API checks (every status code above, farmers blocked from ordering, the all-or-nothing cart, two buyers racing for the same kilos, decline and cancel putting kilos back) and 33 browser checks on a laptop and a phone size, with stand-in PSA prices. `npm run build` has no warnings.

