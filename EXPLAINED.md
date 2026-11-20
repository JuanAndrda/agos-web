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
3. Firebase "rings the doorbell" in `App.js` (`onAuthStateChanged`). App.js reads the person's name and role from the `users` collection in **Firestore** and saves them with `setUser(...)`.
4. App.js passes `user` to the pages as a **prop**, like `<Login user={user} />`. The Login page sees `user` and moves to `/prices`.

**B. A farmer opens Market Prices**
1. `pages/MarketPrices.js` opens, and `useEffect` calls `getPrices("")` from `services/pricesService.js`.
2. The service sends `GET /api/prices` to **our Express server** (the `proxy` line in `client/package.json` forwards it to port 5000).
3. `server/index.js` checks its cache. If the prices are older than 1 hour, `server/psa.js` asks **PSA OpenSTAT** again.
4. The server keeps the newest price of each crop and sends back JSON.
5. The page saves it with `setPrices(...)` and React redraws the table. If anything fails, the page shows the error and a **Try again** button.

**C. A farmer posts a crop**
1. `pages/MyListings.js` shows `components/ListingForm.js`. The form checks every field first.
2. My Listings calls `addListing(form)` from `services/listingsService.js`.
3. The service asks Firebase for the person's **login token** (`getIdToken()`), a long code that proves who they are. It calls `fetch("/api/listings", { method: "POST", headers, body })` to **our Express server**, with the form as JSON in the body and the token in the `Authorization` header.
4. On the server, `requireLogin` (`server/auth.js`) checks the token with Firebase Admin and reads the person's role. `requireFarmer` stops buyers with **403**.
5. `server/listings.js` checks every field again, because anyone could send a request without our form. Wrong data gets **400** with the problems in plain words.
6. The server saves the listing in **Firestore**. It fills in `ownerId`, `ownerName` and `createdAt` itself, so nobody can post in someone else's name. It answers **201 Created** with the saved listing.
7. `readResponse()` (`services/readResponse.js`) sees status **201** and gives the listing back. The page shows "Your Tomato listing is posted." If the status was 400 or 403, `readResponse()` throws an Error with the server's message instead, and the form shows it.

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
- **The cache:** `getPrices()` only calls PSA if we have nothing yet or the prices are older than one hour. This makes pages fast and doesn't overload PSA. Since Nov 19 (section 16) it also loads the prices when the server starts, lets people who ask at the same moment share one trip to PSA, and sends the older prices with `stale: true` when PSA fails.
- **Endpoint 1, `GET /api/prices?search=tomato`:** the newest price of each crop. It checks the search text (more than 50 characters gives **400**), gets the prices, filters them, and sends `{ source, area, checkedAt, count, prices }`.
- **Endpoint 2, `GET /api/prices/:crop`:** every month's price of one crop, newest first, for the Crop Details page. An unknown crop gives **404**.
- If PSA fails and we have no prices at all, both endpoints answer **502** with a clear message instead of crashing. If we have older prices, they answer **200** with those prices and `stale: true`.
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
Read each endpoint top to bottom: check who it is → check the data → use the database → answer with a status code and JSON, written out every time: `res.status(201).json(...)`. Each endpoint has its own `try / catch`: if Firestore fails, the `catch` answers **500**.

| Method and address | What it does | Who can use it | Possible answers |
|---|---|---|---|
| `GET /api/listings?page=1&limit=12` | One PAGE of available listings, filtered and sorted on the server (Marketplace, see section 18) | Anyone logged in | 200, 400, 401 |
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
| `/cart` | Cart | Buyers only |
| `/orders` | Orders | Logged-in users |
| anything else | goes to `/` (Home) | |

If `client/.env` is missing, App.js shows "Firebase keys are missing" and how to fix it, instead of a blank page.

App.js also keeps the two things many pages need, with `useState`:
- `user`: who is logged in (`{ uid, email, name, role }`, or `null`). `onAuthStateChanged` in a `useEffect` is like a doorbell: Firebase rings it when someone logs in or out, and `loadUser()` reads their name and role from Firestore. `checkingLogin` is `true` until Firebase answers, so pages don't flash the login screen. `refreshUser()` reads the profile again; Register needs it because the name and role are saved a moment after Firebase logs the new person in.
- `cart`: the buyer's cart, a list like `[{ listing, quantityKg: 5 }]`. Since Nov 19 a copy is saved in the browser's `localStorage`, one cart per person, so a page reload keeps it. A different person logging in gets their own cart.

They go down to the pages as **props**: `<Marketplace user={user} cart={cart} setCart={setCart} />`. A page that needs to change the cart gets `setCart` too.

### `src/App.css`: the styles
All colors and fonts are saved as variables at the top (`--leaf`, `--leaf-dark`, `--harvest`...), so the look stays consistent and one change updates the whole app. The file is split into sections with titles, like `/* ---------- Navbar ---------- */`, in the same order as the screen: top bar, buttons, forms, page banner, Home, Log in, tables, listing cards. At the bottom, `@media (max-width: ...)` rules adjust the layout for tablets and phones (responsive design). See section 13 for the Nov 17 redesign.

### `src/firebase.js`: connects to Firebase
Reads the keys from `.env`, starts Firebase with `initializeApp`, and exports `auth` (login) and `db` (database). `firebaseReady` is `true` only when the keys are there.

### `src/constants.js`: fixed lists
`CROPS` (the same 10 crops as the server) and `TOWNS` (44 places in Iloilo). The forms use dropdowns from these lists, so nobody types "Tomatoes" or misspells a town. Every listing then links to a real crop page.

It also has one small helper, `formatPeso(1500)`, which gives `"1,500.00"`: two decimals and a comma every 3 digits, the way people in the Philippines read prices. Market Prices, Crop Details and the listing cards all use it, so prices look the same everywhere.

### `src/services/`: every API call
| File | Talks to | Functions |
|---|---|---|
| `authService.js` | Firebase Auth + `users` collection | `register`, `login`, `logout`, `getProfile`, `friendlyAuthError` |
| `listingsService.js` | Our Express server | `getAvailableListings` → `GET /api/listings` and `getMyListings` → `GET /api/listings/mine` (Read), `addListing` → `POST` (Create), `updateListing` and `markSold` → `PATCH /api/listings/:id` (Update), `deleteListing` → `DELETE /api/listings/:id` (Delete) |
| `ordersService.js` | Our Express server | `placeOrders` → `POST /api/orders`, `getMyOrders` → `GET /api/orders/mine`, `getReceivedOrders` → `GET /api/orders/received`, `setOrderStatus` → `PATCH /api/orders/:id` |
| `readResponse.js` | (no API) | `readResponse(response)`: checks the status code of every answer from our server |
| `pricesService.js` | Our Express server | `getPrices(search)` → `GET /api/prices`, `getPriceHistory(crop)` → `GET /api/prices/:crop` |
| `wikipediaService.js` | Wikipedia | `getCropInfo(cropName)` → `{ title, description, photo, link }`, and `getCropPhotos(crops)`, which gets the photos one after another with a `for` loop (Home and Market Prices use it) |

Two details to point out:
- **Friendly errors:** Firebase sends codes like `auth/invalid-credential`. `friendlyAuthError` turns them into "Wrong email or password." Our own server already answers in plain words (like "Only farmers can do this."), so the pages simply show `err.message`.
- **Every request is a plain `fetch()`:** each function in `listingsService.js` and `ordersService.js` gets the token with `auth.currentUser.getIdToken()`, then calls `fetch()` with the **method** (GET, POST, PATCH, DELETE), the **headers** (`Authorization: Bearer <token>`, and `Content-Type: application/json` when there is a body) and the **body** (`JSON.stringify(...)`, only for POST and PATCH). Firebase renews the token by itself every hour. See section 15.
- **Reading the answer:** every function ends with `return readResponse(response)`. It reads the JSON, then checks `response.status` one code at a time: 200 and 201 give the data back; 400, 401, 403, 404, 409 and 500 throw an Error with the server's message. If the answer isn't JSON, our server isn't running, and it says so.
- **Wikipedia titles:** some crop names aren't Wikipedia page titles, so `WIKI_TITLES` says which page to use (Pechay → "Bok choy", Ampalaya → "Momordica charantia", Squash → "Calabaza", and so on). These are the same pages Agos uses.

### `src/layouts/MainLayout.js`
The frame every page sits in: `Navbar`, then the page (`children`), then `Footer`.

### `src/components/`: reusable pieces
| File | What it does |
|---|---|
| `Logo.js` | Our small leaf logo, drawn with SVG code instead of an image file. It uses `currentColor`, so it takes the color of the text around it. |
| `PriceChart.js` | The line chart on Crop Details, drawn with SVG, no chart library. It measures the box when the page opens and again on every window `resize` event, so the chart fills it. Each price becomes a point (`xOf` for left-right by month, `yOf` for up-down by price), and the line is an SVG `path` ("M" moves the pen, "L" draws to the next point). Each point is a button: click it, point at it, or Tab to it and press Enter, and the line above the chart shows that month's price and how it changed from the month before. |
| `AuthPanel.js` | The green welcome panel on the left of Log in and Register (the split screen). Both pages share it. |
| `Navbar.js` | The white top bar (green before Nov 17). When nobody is logged in it shows Log in and Create account. Uses `NavLink`, which highlights the page you're on. Shows My Listings only to farmers, plus the person's name, role and Log out. A long name is cut short with "…" so the bar stays tidy, and the full name shows when you point at it (the `title` attribute). Moving between pages doesn't reload the page, so our app is a single-page application (SPA). |
| `Footer.js` | Says where our data comes from (PSA, monthly, not real-time; Wikipedia). |
| `Loading.js` | A spinner and text while we wait for an API. |
| `ErrorMessage.js` | A red box with the problem and a "Try again" button. |
| `ProtectedRoute.js` | A guard. Not logged in → `/login`. A buyer opening My Listings → `/marketplace`. |
| `AddToCart.js` | The "kilos + Add to cart" box on each Marketplace card (buyers). Gets `cart` and `setCart` as props. |
| `SearchBar.js` | A labelled search box (the page gives it an `id`, which connects the label to the box). With `onSubmit` it has a Search button (Market Prices); without it, the page filters as you type (Marketplace). |
| `ListingCard.js` | One listing as a card: crop, price, kilos, town, harvest date, farmer, contact number, notes, and "Available" or "Sold" written in words (not color alone). The number is a `tel:` link, so on a phone one tap opens the phone app to call or text. `formatPhone` writes it as "0917 123 4567" so it's easy to read. My Listings adds its buttons as `children`, and hides the Farmer and Contact lines with `showFarmer={false}` (every listing there is your own). |
| `ListingForm.js` | The post and edit form. `checkForm` explains every wrong field ("Choose your town."). The Contact number must be a Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX); `cleanNumber` removes spaces and dashes first, so "0917-123 4567" is fine. The edit form also has a Status field, so a farmer can change "Sold" back to "Available". It scrolls into view when it opens. After a failed save, `handleSubmit` puts the cursor in the first wrong field, which helps keyboard and screen reader users. |

### `src/pages/`: one file per screen
Every page that uses an API follows the same pattern, the same as `fetchDogs()` in our Firebase class activity. **State** for the data, loading and error → a plain **`async function loadSomething()`** with `try / catch / finally` → **`useEffect(() => { loadSomething(); }, [])`** runs it once when the page opens → show **loading, error, empty, or the data**. The "Try again" button calls the same function. Once you understand one page, the others read the same way.

(The line `// eslint-disable-next-line react-hooks/exhaustive-deps` above `}, []);` tells React's code checker "yes, we really want this to run only once". Without it, `npm run build` shows a warning.)

Every page also sets the name in the browser tab, like "Market Prices · AgosUgnayan Web", with one small `useEffect` that changes `document.title`.

- **`Home.js`** (Nov 17): the landing page at `/`. Anyone can open it. A big welcome box (the "hero"), one tile per crop with its newest PSA price (`GET /api/prices`, which needs no login) and its Wikipedia photo (`getCropInfo`, the same as Crop Details), and "How it works" in 3 steps. `getCropPhotos` (in `wikipediaService.js`) asks Wikipedia for the photos one after another; if one photo fails, that tile shows the crop's first letter instead.
- **`Login.js`**: email and password. Checks that both are filled, calls `login()`, and shows Firebase errors in plain words.
- **`Register.js`**: name, email, password (6+ characters) and a Farmer/Buyer choice. `checkForm()` finds every problem at once and shows each one under its own field, the same way as the listing form, then puts the cursor in the first one. Calls `register()`, then `refreshUser()`.
- **`MarketPrices.js`**: the newest PSA farmgate price of each crop, with search. Since Nov 17 each crop is a clickable card with its Wikipedia photo, price and month; clicking it opens Crop Details. Above the cards, 3 summary boxes show the lowest price, the highest price and how many crops are shown. They are worked out in React with `reduce()` from the same prices, so there is no extra API call. Always shows the source ("PSA OpenSTAT") and the month of each price. (Since Nov 20 the "PSA updates these prices once a month... Last checked" note is gone; see section 18.)
- **`CropDetails.js`**: uses two APIs at the same time. It finds the crop whatever the capital letters are, so `/crops/tomato` also works. The left card is Wikipedia (photo and description). The right card is our server (`GET /api/prices/Tomato`): since Nov 17 it shows 3 boxes (latest price, previous month, and the change up or down in pesos and %), then a line chart of the last 12 months (`PriceChart.js`). The table is still there behind "Show all months as a table" (a `<details>` element, which opens and closes without any JavaScript). Each card has its own loading and error, so if Wikipedia is down, the prices still show.
- **`Marketplace.js`**: (Since Nov 20 the server does the filtering and sends one page at a time; see section 18. The old way is described here.) It loaded every available listing once from our server (`GET /api/listings`), then searched, filtered (town, min and max price) and sorted (newest, price low→high, high→low) in React with `.filter()` and `.sort()`. Shows "Showing 2 of 5 listings" and a Clear filters button. If the max price is lower than the min price, it says so under the Max field instead of just showing "no listings". The filters stay in React, not on the server, so the results change instantly while you type, with no waiting.
- **`MyListings.js`**: the farmer's own listings with all of CRUD, each one a request to our server. **Post a crop** (Create, `POST`), the list (Read, `GET /mine`), **Edit** and **Mark as sold** (Update, `PATCH`), **Delete** (`DELETE`). Delete asks "This can't be undone" first. Every action shows a success or error message, and the buttons are disabled while it saves.

---

## 5. `firestore.rules`: the database's guard
Anyone can open the browser tools and try to change data directly, so Firestore checks every request against these rules **on Google's servers**. That makes them part of our server-side logic.
- `request.auth` is the person asking.
- **`users`:** logged-in people can read profiles (to show names). You can create only your own profile, once, as `farmer` or `buyer`, and you can never change your `role` after that (Nov 19). Before, a buyer could make themself a farmer by writing to Firestore directly.
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
6. **`refreshUser()`** in `App.js` (it was in AuthContext before Nov 19) makes sure a new account's role shows right away.
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
- **Check** them. If one fails, we `return { status: 409, error: "..." }` before any write, so **nothing** is saved, not even the other items in the cart. After the transaction, the route answers with that status.
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
| `App.js` (since Nov 19; was `context/CartContext.js`) | Keeps the cart in React state (`const [cart, setCart] = useState([])`) and passes it to pages as props. The cart empties when someone else logs in. Since Nov 19 (section 16) a copy is saved in `localStorage`, so a reload keeps it. |
| `components/AddToCart.js` | New. The "kilos + Add to cart" box on each Marketplace card. Checks: whole kilos, more than 0, and not more than what's left (it counts what's already in your cart). |
| `pages/Cart.js` | New. Change kilos, remove, the total (`reduce()`), and **Send order request** → `POST /api/orders`. If the server says no (for example someone else bought first), its message is shown and the cart stays. |
| `pages/Marketplace.js` | Buyers get `<AddToCart>` on each card. Farmers get no box, and their own listings say "This is your listing". |
| `components/Navbar.js` | A cart button with the number of items (buyers only), and an **Orders** link (everyone). |
| `App.js` | The routes `/cart` (`<ProtectedRoute role="buyer">`, so a farmer is sent to the Marketplace) and `/orders`. |

**Why check in React AND on the server?** React checks first so the buyer gets a quick message. The server checks again because the stock can change after the page loaded, and because anyone can send a request without our page.

### Part 4: the Orders page (`pages/Orders.js`)
The page shows one list, depending on your role (`isFarmer` in the code):
- **Buyer → My orders:** each order with its status in words (Waiting for the farmer, Accepted, Declined, Cancelled) and a **Cancel order** button while it's waiting.
- **Farmer → Orders received:** the buyer's name and email, with **Accept** and **Decline** buttons while it's waiting.
- Each button calls `setOrderStatus()` in `services/ordersService.js` → `PATCH /api/orders/:id`, then loads the list again.

### Other small changes
- (Nov 17 only: `services/serverApi.js` sent every listings and orders request. It was removed on Nov 19, see section 15.)
- `server/index.js` plugs in the orders routes: `app.use("/api/orders", ordersRouter)`.
- `firestore.rules` locks the new `orders` collection, like listings.
- On a phone the page links are a little smaller, so a farmer's 4 links fit in one row.
- The top bar stays on one row on a laptop. The right side (`.nav-user`) has `flex: 1 1 0` and `min-width: 0`, so when space is short the long name gets shorter with "…" instead of the whole right side dropping to a second row. Below 1080 pixels wide (was 980) the page links move to their own row.

**What Juan does once:** paste the new `firestore.rules` into the Firebase Console and click Publish. The app works without this step (our server uses Firebase Admin, which skips the rules), but publishing it stops anyone from reading orders straight from the browser.

**Tested** on the Firebase emulators: 45 API checks (every status code above, farmers blocked from ordering, the all-or-nothing cart, two buyers racing for the same kilos, decline and cancel putting kilos back) and 33 browser checks on a laptop and a phone size, with stand-in PSA prices. `npm run build` has no warnings.

---

## 15. Simpler code, closer to our class activities (Nov 19)

**Why:** so every group member can explain the code. The focus is how we use APIs: the HTTP **methods**, the **response**, and the **status codes**. Nothing the user sees changed, and every endpoint and its URL is the same.

**What changed in React (`client/src`):**
| Before | Now | Like which class activity |
|---|---|---|
| One hidden helper `services/serverApi.js` (`callServer`) sent every request | Each function in `listingsService.js` and `ordersService.js` writes its own `fetch(url, { method, headers, body })` | Dog API app (`fetch(...)`) and Activity 8 (choosing GET, POST, PATCH, DELETE in Insomnia) |
| Only "ok or not ok" | New `services/readResponse.js` checks `response.status`: 200, 201, 400, 401, 403, 404, 409, 500, each with a comment saying what it means | The status box in Insomnia (Activity 8) |
| `useCallback(async () => {...}, [])` on 6 pages | A plain `async function loadListings() { try / catch / finally }`, called from `useEffect(..., [])` | `fetchDogs()` in the Firebase activity |
| `context/AuthContext.js` and `context/CartContext.js`, with the custom hooks `useAuth()` and `useCart()` | `user` and `cart` live in `App.js` with `useState` and go down to pages as **props** | Layouts and components with props (React lesson) |
| `useRef`, `useId`, `ResizeObserver` | `document.getElementById(...)`, an `id` prop, and a window `resize` event | Plain JavaScript |
| `data.thumbnail?.source`, `...(editing && { status })`, `Promise.all` | Plain `if` statements and a `for` loop | Plain JavaScript |

**What changed on the server (`server/`):**
- Every route answers with `res.status(...).json(...)`, so the status code is always written out, even 200.
- Every route that uses Firestore has its own `try / catch`; the `catch` answers **500** with a clear message.
- `orders.js` no longer uses `problem()` and `sendProblem()` (a function that throws an Error with a status). The transaction now **returns** `{ status: 409, error: "..." }`, and the route answers with it. Easier to follow.
- `auth.js`: comments explain the difference between **401** (we don't know who you are) and **403** (we know who you are, but you're not allowed).
- `psa.js` did not change. Its logic is tested against the real PSA and easy to break.

**How a request and its status code travel (example: a buyer orders 11 kg, but only 10 kg are left):**
1. `Cart.js` calls `placeOrders(cart)`.
2. `ordersService.js` sends `fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer <token>" }, body: JSON.stringify({ items }) })`.
3. `server/auth.js`: the token is real (else **401**) and the person is a buyer (else **403**).
4. `server/orders.js`: the transaction reads the listing, sees only 10 kg, and returns `{ status: 409, error: "Only 10 kg of Tomato from Ana Reyes is left. Lower the quantity." }`. Nothing is saved.
5. The route answers `res.status(409).json({ error: "..." })`.
6. `readResponse()` in React sees `response.status === 409` and throws an Error with that message.
7. `Cart.js` catches it (`catch (err) { setError(err.message) }`) and shows it in the red box.

**Insomnia, like Activity 8:** `insomnia/agos-web-api.json` has every endpoint of our server, ready to import (Insomnia → Import → choose the file). Fill in `firebase_api_key` (from `client/.env`) once, and the email and password of a farmer and a buyer account in the **Farmer** and **Buyer** environments. Then pick Farmer or Buyer at the top right. You never copy the token or the ids by hand: `token` is filled from **0. Login → Get a login token** (Firebase's own login API, sent again before every request), `listing_id` from the last **POST a new listing**, and `order_id` from the last **POST an order** (Insomnia "response" tags). After importing, click each of the 3 tags in Base Environment once and choose its request again in the Request list, because Insomnia gives imported requests new IDs. Each request's description says which status codes to try, for example remove the `Authorization` header to see **401**, or send the same DELETE twice to see **404**.

**Tested** on the Firebase emulators: 39 API checks (every status code above, including the all-or-nothing cart and kilos going back after a cancel) and 28 browser checks (register, log in, prices, crop details, post, edit, mark sold, delete, add to cart, checkout, accept, cancel, log out), with stand-in PSA prices and Wikipedia photos. `npm run build` has no warnings.

### Crop photos on the listings (Nov 19)
Juan's idea: farmers never upload a photo, because we already have a photo of every crop from the **Wikipedia API** (the same one Crop Details and Market Prices use).
- `components/ListingCard.js`: a new `photo` prop. If the page gives one, the card shows it at the top.
- `pages/Marketplace.js` and `pages/MyListings.js`: after the listings load (`GET /api/listings`), `loadPhotos()` makes a list of the **different** crops (so 5 Tomato listings ask Wikipedia only once), calls `getCropPhotos(crops)`, and saves them in `photos` state, like `{ Tomato: "https://upload.wikimedia.org/..." }`. Each card gets `photo={photos[listing.crop]}`. The cards show first; the photos appear a moment later.
- `components/ListingForm.js`: a `useEffect` with `[form.crop]` runs every time the farmer chooses a crop. It calls `getCropInfo(form.crop)` (`GET https://en.wikipedia.org/api/rest_v1/page/summary/...`) and shows a small preview under the Crop box: "Buyers will see this photo of Tomato. No upload needed."
- If Wikipedia is down or has no photo, the card or preview simply has no picture. Nothing breaks.
- Nothing new is saved in Firestore: the photo is looked up from the crop name every time.

### Order rules: protecting the buyer (Nov 19)
Juan's rule: once a buyer sends an order request, and especially once the farmer accepts it, the farmer can't change the deal or delete the listing.

**An order is "open" while it is `pending` (waiting) or `accepted`.** While a listing has open orders, it is **locked**:
| What the farmer tries | Allowed? | Server answer |
|---|---|---|
| Delete the listing | No | **409 Conflict** "You can't delete this listing yet: it has 1 order waiting and 1 accepted..." |
| Change the crop, price or town | No | **409 Conflict** "...its crop, price and town are locked." |
| Change kilos, harvest date, contact number, notes, or mark as sold | Yes | 200 OK |

**The order's steps (`PATCH /api/orders/:id`):**
- `pending` → `accepted` or `declined` (the farmer), or `cancelled` (the buyer). Declined and cancelled give the kilos back.
- `accepted` → `completed` (the farmer, after pickup and payment). **New.** This ends the deal and unlocks the listing.
- An `accepted` order can't be declined or cancelled anymore (**409**). Both sides must honor it.

**How it's built:**
- `server/listings.js`: `countOpenOrders()` counts the pending and accepted orders of a listing. PATCH and DELETE now run in a **transaction** (like the orders): they read the listing **and** its orders, check the lock, then write. So a buyer can't order at the same moment the farmer changes the price. `LOCKED_FIELDS` = crop, pricePerKg, town. A locked field that is sent **unchanged** is fine, so the edit form still works.
- `GET /api/listings/mine` now adds `pendingOrders` and `acceptedOrders` to each listing, so the website can show the lock.
- `server/orders.js`: the new `completed` status, with its own 409 checks.
- `pages/MyListings.js`: a 🔒 note on locked cards ("1 order waiting. 1 accepted..."), and the Delete button is turned off. `components/ListingForm.js` gets `locked`, which turns off the Crop, Town and Price boxes and the "Use this price" button.
- `pages/Orders.js`: a **Mark as completed** button on accepted orders (farmer), and the status "Completed".
- **Old orders are safe even after a delete:** every order keeps its own copy of the crop, kilos, price, total, town and farmer contact, so it still shows correctly.

---

## 16. Fixes after the full audit (Nov 19)

We tested the whole app (114 checks at phone and laptop size) and fixed what the tests found. Juan approved groups A and B of the audit report. Nothing new was added; every change is a fix or small polish.

| # | What was wrong | What we changed | File |
|---|---|---|---|
| A1 | A red error stayed under a field after you fixed it, and the PSA "Use this price" box hid behind the old price error. | `handleChange` (ListingForm) and `clearError` (Register) copy the `errors` object, `delete` that field's message, and save the copy. The PSA suggestion now shows even when the price box has an error. | `components/ListingForm.js`, `pages/Register.js` |
| A2 | A buyer could change their own `role` to farmer by writing to Firestore directly. | The rules split `write` into `create` (only your own profile, role must be farmer or buyer) and `update` (the role must stay the same). There is no `delete`. **Publish the new rules in the Firebase Console.** | `firestore.rules` |
| A3 | When PSA failed after the 1-hour cache ran out, the price pages showed an error even though the server still had older prices. | `getPrices()` sends the older prices with `stale: true`, and waits 5 minutes before trying PSA again, so nobody waits 30 seconds for a dead PSA. Market Prices and Crop Details show a yellow note: "PSA isn't answering right now...". | `server/index.js`, `pages/MarketPrices.js`, `pages/CropDetails.js`, `App.css` (`.warning-box`) |
| A4 | An old comment in Login.js still said "AuthContext". | Fixed the comment. | `pages/Login.js` |
| B1 | The cart emptied on a page reload. | `App.js` saves the cart in `localStorage` with a `useEffect` that runs when `[cart, user]` change, under the key `agos-cart-<uid>`. On login, `loadSavedCart(uid)` reads it back with `JSON.parse`. The server still checks the stock at checkout, so an old cart can't buy kilos that are gone (409). | `App.js` |
| B2 | The first price page waited for PSA, and 3 people at once made 3 trips to PSA. | The server calls `getPrices()` right after it starts. `psaTrip` holds the trip that is on its way, so everyone who asks at the same moment waits for that one trip. | `server/index.js` |
| B3 | After logging in you always landed on Market Prices, even if you had opened a crop's page. | `ProtectedRoute` sends the page you wanted to Login with `<Navigate ... state={{ from: location.pathname }} />`. Login reads it with `useLocation()` and goes back there. | `components/ProtectedRoute.js`, `pages/Login.js` |
| B4 | On a phone the 5 Marketplace filters filled the whole first screen; on a laptop the Delete button wrapped onto its own line. | Phone: filters in 2 columns ([Town, Sort by], [Min, Max]) with CSS `order`. Laptop: listing cards are at least 280px wide. CSS only. | `App.css` |
| B5 | Home still said "call the farmer directly", from before the cart. | New words: check the price, find a crop and order, the farmer accepts. | `pages/Home.js`, `components/AuthPanel.js` |

**New words to know:**
- **`localStorage`**: a small storage box in the browser for text. It stays after a reload. `setItem(key, text)` saves, `getItem(key)` reads. We turn the cart into text with `JSON.stringify` and back with `JSON.parse`.
- **`location.state`**: extra information sent along when React Router changes the page. We use it to remember the page you wanted.
- **Stale data**: older data shown on purpose when the fresh source is down. The page says so, so nobody is fooled.

**Tested:** 65 API checks (including the new rules), 5 PSA cache checks (start-up load, one shared trip, stale fallback, 5-minute pause) and 54 browser checks at 390px and 1366px, all passing, on Firebase emulators with a fake PSA and Wikipedia. The real PSA and Wikipedia were checked separately from Juan's laptop browser.

## 17. 104 crops and the searchable crop picker (Nov 20)

Juan asked to grow the app from 10 crops to the vegetables and fruits that PSA has Iloilo prices for. We added **104 crops in 6 categories**. A list that long doesn't fit in a normal drop-down, so the listing form got a **crop picker you can search**.

**Why 104 crops?** It is every Iloilo vegetable and fruit PSA tracks, minus "Other mango" and "Other banana" (catch-all groups, not real crops), "Cassava for industrial use" (sold to factories) and Broccoli (no Iloilo price since June 2024). 103 of the 104 have a PSA price from the last 12 months.

### Part 1: one crop catalog for the whole app (`server/crops.js`)

Before, the 10 crops were written in **two** places: `server/psa.js` and `client/src/constants.js`. With 104 crops, two lists would soon stop matching. Now there is **one list**, on the server:

```js
export const CROPS = [
  { name: "Tomato", category: "Fruit vegetables", psaName: "Tomato", popular: true },
  { name: "Banana (Saba)", category: "Fruits", psaName: "Banana Saba, green" },
  ...
];
```

- `name` is what people see. The first 10 names (Tomato, Carrots, Eggplant, ...) did not change, so old listings in Firestore still match.
- `psaName` is PSA's own name, copied exactly from PSA OpenSTAT, or the price won't be found.
- `category` decides the group in the picker, and also which PSA table to ask, because each category is one PSA table (`CATEGORIES` at the top: Fruit vegetables = table 05, Leafy = 06, Root crops = 02, Condiments = 04, Beans = 03, Fruits = 07).
- `popular: true` marks the 10 crops shown on the Home page.

**To add a crop later:** add one line in the right category and restart the server. Nothing in React needs to change.

`psa.js` now imports this list. It still asks each PSA table only once, so 104 crops are still only **6 trips to PSA**, sent at the same time with `Promise.all`. `listings.js` checks every new listing against the catalog with `findCrop()`, so nobody can post a crop that isn't on the list (400 Bad Request: "Choose a crop from our crop list.").

### Part 2: a new endpoint, `GET /api/crops` (`server/index.js`)

It sends the whole catalog, each crop joined with its newest PSA price:

```json
{ "categories": ["Fruit vegetables", "Leafy vegetables", ...],
  "pricesWorking": true,
  "crops": [
    { "name": "Tomato", "category": "Fruit vegetables", "popular": true,
      "latest": { "pricePerKg": 38.81, "month": "June 2026", "monthKey": "2026-06", "older": false } },
    { "name": "Durian", "category": "Fruits", "popular": false,
      "latest": { "pricePerKg": 50, "month": "December 2025", "monthKey": "2025-12", "older": true } }
  ] }
```

- It **always answers 200 OK**. If PSA is down, the crops still come back with `"latest": null`, so farmers can still choose any crop and type their own price.
- `older: true` means PSA has no price for that crop in its newest month (June 2026), so this is the last month it had one. The app always shows the month next to the price, and says "older price" for these, so nobody thinks December 2025's price is this month's.
- `GET /api/prices` also got `category` and `older` on every price, and its search finds categories too (`?search=beans`).
- In React it is called by `services/cropsService.js` → `getCrops()`. Insomnia has a new request: "GET the crop catalog".

### Part 3: the crop picker (`components/CropPicker.js`)

A search box with a drop-down list under it:

1. You **type** part of a name ("mang") and the list keeps only the crops whose name or category has that text: `crops.filter(...)` with `.toLowerCase().includes(text)`.
2. The matches are **grouped** by category with `groupByCategory()` (in `cropsService.js`), with the category name as a heading that stays at the top while you scroll (`position: sticky`).
3. The list has a **fixed height** (`max-height: min(320px, 55vh)` with `overflow-y: auto`), so it scrolls by itself and the form never gets longer.
4. Each crop shows its **PSA price and month**, or "No PSA price yet". Older months are in gold with "older".
5. After you choose, the box shows the crop, and a green line under it says "✓ Durian · Fruits".
6. **Keyboard:** ↓ and ↑ move, Enter chooses, Escape closes. **Mouse/touch:** tap a crop, or the ▾ button. Clicking outside closes the list and keeps your choice.

How it works in React (only `useState` and `useEffect`, like our class activities):
- `open` (is the list showing?), `query` (what you typed) and `activeIndex` (which row the arrow keys are on) are 3 `useState`s.
- The form gives the picker the crops and gets the chosen name back through a prop: `<CropPicker ... value={form.crop} onChange={handleCropChange} />`. This is "lifting state up": the form owns the value, the picker only shows it.
- `onMouseDown={(e) => e.preventDefault()}` on the list stops the click from taking the cursor out of the search box first, or the list would close before the click counts.
- `onBlur` on the whole picker closes the list when the cursor leaves it (`event.currentTarget.contains(event.relatedTarget)` checks if it moved somewhere still inside the picker).
- ARIA words (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`) tell screen readers it's a searchable list.

It is **reusable**: a future "Add Demand" form for buyers can use the same picker with one line. (Juan decided on Nov 20 not to build Add Demand for now.)

### Part 4: the other pages

| Page | What changed |
|---|---|
| `ListingForm.js` | Uses `CropPicker` and `getCrops()` instead of a `<select>` and `getPrices()`. The PSA suggestion shows the month and, for older prices, "This is an older price... check today's market". A crop with no PSA price can still be posted with the farmer's own price. |
| `MarketPrices.js` | Cards are grouped by category, with category buttons at the top (All 104, Fruit vegetables 14, ...). On a phone the buttons are one row you swipe. Cards say "older price" when needed. |
| `CropDetails.js` | Checks the crop name in the catalog first (`getCrops()`), so `/crops/banana (saba)` works with any capital letters. Shows the category. "Latest available price" says when it's an older price. |
| `Home.js` | Shows the 10 `popular` crops as tiles (104 tiles would be too many) and "104 crops". |
| `Marketplace.js` | New **Category** filter, using each crop's category from `getCrops()`. |
| `wikipediaService.js` | Wikipedia page titles for the new crops (checked on Nov 20). `getCropPhotos()` now asks each page only once and sends the requests **at the same time** with `Promise.all`, so 104 photos load in about 2 seconds instead of one by one. |
| `constants.js` | The crop list is gone (it lives in `server/crops.js`). New helper `cropLink(name)` makes safe page addresses: `"Banana (Saba)"` → `/crops/Banana%20(Saba)`. |

**New words to know:**
- **Catalog**: one master list that everything else reads from, so names never disagree.
- **Combobox**: a text box joined to a list of choices; you can type or pick.
- **`Promise.all`**: starts many requests at once and waits until all of them are back.
- **`encodeURIComponent`**: turns spaces and symbols into safe URL text (`" "` → `%20`).

**Tested:** 25 API checks (all 104 crops' prices and months match PSA exactly, posting new and old crop names, 7 wrong crop names rejected with 400, history for "Banana (Saba)" and "leeks", PSA down → `/api/crops` still 200 with no prices) and 68 browser checks at 390px (phone) and 1366px (laptop): 104 cards in 6 groups, category buttons, picker search, keyboard, fixed list height, form doesn't grow, older-price notes, saving a listing, Category filter, Home tiles, no sideways scrolling and no console errors. Run on Firebase emulators with a fake PSA that sends the real Iloilo prices read on Nov 20. The real PSA names and the Wikipedia titles were checked from Juan's laptop browser.

## 18. Pages of listings and orders, and demo data (Nov 20)

Juan asked for three things: remove the PSA note, add sample data to test moving between pages, and check whether the app really supports pages.

### Part 1: the PSA note is gone

Market Prices used to say "PSA updates these prices once a month, a few months late... Last checked from PSA ...". That paragraph (and the `checkedAt` state that filled it) was removed from `MarketPrices.js`. **Nothing about the prices changed:** every crop still shows its PSA price and its month, older months still say "older", and Crop Details still shows the "Latest available price" with its month. (The server still sends `checkedAt` in `GET /api/prices`; React just doesn't show it. The footer line "Prices: PSA OpenSTAT" is a source credit and stays.)

### Part 2: what we found

There were **no pages** anywhere. `GET /api/listings`, `GET /api/orders/mine` and `GET /api/orders/received` sent the WHOLE list every time, and Marketplace filtered it in React. With 6 listings that is fine. With 600 the phone downloads all 600 just to show 12.

We had three choices:

| Choice | How | Why we did / didn't pick it |
|---|---|---|
| Hide items in React | Load everything, show 12 | Still downloads everything. Juan said not to just hide items. |
| Firestore cursors (`startAfter`) | Firestore reads only 12 | Needs an index for every filter combination, can't jump to "page 5", and is much harder to explain. |
| **Pages on our Express server** ✓ | The server filters, sorts, then cuts one page with `slice()` | The phone gets only one page. Easy to explain: it is the query parameters from our Insomnia activities. Page numbers and "Page 3 of 6" work. |

We picked the **server**. (The server still reads all available listings from Firestore each time. For a class project with hundreds of listings that is fast. A real app with 100,000 listings would switch to Firestore cursors.)

### Part 3: query parameters (`server/paginate.js`)

React asks for a page by adding **query parameters** to the address (the part after `?`):

```
GET /api/listings?page=2&limit=12&category=Fruits&sort=price-low
GET /api/orders/received?page=1&limit=6&status=pending
```

`paginate.js` has two small functions used by both listings and orders:

- `readPageQuery(req.query, 12)` checks `page` (a whole number, 1 or more) and `limit` (6, 12 or 24). A wrong value gives **400 Bad Request**, like `?limit=100` → "limit must be one of 6, 12, 24."
- `paginate(items, page, limit)` cuts one page out of the list with `items.slice(start, start + limit)`, where `start = (page - 1) * limit`. Page 1 starts at 0, page 2 at 12. If you ask for a page past the end (say the last listing on page 6 was just bought), you get the **last page** instead of an empty one.

**Listings** (`listings.js`, `GET /`): it reads the available listings, keeps the ones that match every filter (`search`, `category`, `town`, `minPrice`, `maxPrice`), sorts the WHOLE list (`newest`, `price-low`, `price-high`), and only then cuts the page, so page 2 always continues page 1. The answer:

```json
{ "listings": [ ...12 listings... ], "page": 2, "limit": 12, "total": 63, "totalPages": 6, "totalAvailable": 63 }
```

`total` is how many match the filters; `totalAvailable` is how many are for sale at all (for "17 of 63 listings match").

**Orders** (`orders.js`, `sendOrderPage`): the same idea, 6 per page, newest first, with an optional `?status=pending`. It also sends `counts` (like `{ pending: 8, accepted: 4 }`) for the status buttons, and `totalAll`.

### Part 4: React (`components/Pagination.js`)

`Pagination.js` is one reusable component, used by Marketplace and Orders. It shows "Showing 13–24 of 63 listings", the buttons "← Previous 1 … 4 [5] 6 … 10 Next →", and a **Per page** box (6, 12, 24). On a phone the number buttons are hidden and it says "Page 2 of 6" instead. It doesn't load anything itself; the page gives it the numbers and two functions.

In `Marketplace.js` and `Orders.js`:

- `page`, `limit` and every filter are **state**. The `useEffect` that loads the list has them all in its `[ ]` list, so changing any of them loads again.
- Changing a filter or the page size goes back to **page 1** (`changeFilter`, `changeLimit`), because page 5 of the old results may not exist.
- Typing waits **300 ms** (`setTimeout`), so typing "mango" sends one request, not five. A `stale` flag makes sure an old, slow answer never replaces a newer one.
- While the next page loads, the old page stays on screen, faded (`.results-loading`), so the page doesn't jump. The "Showing ..." numbers come from the server's answer (`shownPage`, `shownLimit`), so they always match the cards on screen.
- After Accept, Decline, Cancel or Mark as completed, Orders loads the same page again (`reloadCount + 1`), so the counts on the status buttons update.

### Part 5: demo data (`server/demo/`)

To test pages you need many listings and orders. Typing 60 listings by hand is slow, so there are two scripts:

```
cd server
npm run demo:seed -- yourDemoPassword   (adds the demo data; the password is for the demo accounts)
npm run demo:reset                      (removes ALL demo data, and only demo data)
```

What the seed adds:

- **6 demo farmers** in different towns (Maria Santos (Demo) in Pototan, Jose Dela Cruz (Demo) in Janiuay, ...) and **3 demo buyers**. Emails are `demo.farmer1@agosugnayan.test` ... `demo.buyer3@agosugnayan.test`; `.test` addresses can never receive real email. Phone numbers are fake (0900 000 0001).
- **66 listings**: each farmer has 11 different crops (no copies), with realistic prices and amounts, spread over 3 weeks. 3 are sold out.
- **45 orders** in every status (waiting, accepted, completed, declined, cancelled). Stock already takes away the kilos of the open and completed orders, like a real checkout.

How it stays apart from real data:

- Every demo record has `demo: true`, and every demo name ends in "(Demo)". Listing cards and order rows show a yellow **DEMO** badge.
- The seed refuses to run twice ("Demo data is already in the database").
- `demo:reset` deletes only records with `demo: true` (plus any order on a demo listing, and the 9 demo accounts). Real users, listings and orders are never touched. We tested this: a real listing and a real order were still there after the reset.

**Careful:** the live site uses the same Firestore database. Seeding the real database makes the demo listings appear on the live site too. Remove them with `npm run demo:reset` before the presentation if you don't want them there.

### Part 6: what was tested

On the Firebase emulators with the 66 listings and 45 orders: 29 API checks (every page once with no repeats, page 99 → last page, `limit=7` → 400, each filter and sort, status filter and counts) and 49 browser checks at phone (390 px) and laptop (1366 px) width: moving between pages, Per page, a filter on page 2 going back to page 1, search across pages, no matches, Accept updating the counts, adding/editing/deleting a listing changing the totals, no sideways scrolling, no console errors.

