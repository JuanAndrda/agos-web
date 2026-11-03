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

```
                    ┌──────────────────────────────┐
                    │  React app (client/)         │
                    │  pages → services → APIs     │
                    └──┬──────────┬─────────┬──────┘
          login, listings│   prices │   photos│
                         ▼          ▼         ▼
            ┌─────────────────┐ ┌─────────┐ ┌───────────┐
            │ Firebase Auth + │ │ Express │ │ Wikipedia │
            │ Firestore       │ │ server  │ │ API       │
            └─────────────────┘ └────┬────┘ └───────────┘
                                     ▼
                              ┌──────────────┐
                              │ PSA OpenSTAT │
                              └──────────────┘
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
2. My Listings calls `addListing(form, user)` from `services/listingsService.js`.
3. The service saves a new document in the `listings` collection in **Firestore**.
4. **Firestore's security rules** (`firestore.rules`) check on Google's servers that the person is a farmer and posts as themselves. Then the page shows "Your Tomato listing is posted."

---

## 2. How each API and database was added

### Firebase (Authentication + Firestore)
- **Added by:** creating a project at console.firebase.google.com, turning on Email/Password login and Firestore, then running `npm install firebase` in `client/`.
- **Keys:** Firebase gives a small config (apiKey, projectId...). We put it in `client/.env`, never in our code. Create React App only reads names that start with `REACT_APP_`.
- **Used in code:** `firebase.js` connects once. `authService.js` and `listingsService.js` use it.
- **Our data (Firestore):** two collections. A collection is like a folder, and each document inside is like an index card with JSON.
  - `users/{uid}`: `{ name, email, role }`, where role is `"farmer"` or `"buyer"`. The document ID is the same as the login ID.
  - `listings/{auto id}`: `{ crop, quantityKg, pricePerKg, town, harvestDate, notes, status, ownerId, ownerName, createdAt }`, where status is `"available"` or `"sold"`.

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
The server's ID card: its name, its packages (`express`, `cors`), `"type": "module"`, and two commands: `npm start` (run) and `npm run dev` (run and restart when a file changes).

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
- Any other address gives **404** JSON. If a route crashes, the last middleware answers **500**.
- `app.listen(5000)` starts the server, or explains why it couldn't (for example, port 5000 is busy).

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
| `/login`, `/register` | Login, Register | Everyone |
| `/` | goes to `/prices` | |
| `/prices` | Market Prices | Logged-in users |
| `/crops/:cropName` | Crop Details (`:cropName` is read from the URL) | Logged-in users |
| `/marketplace` | Marketplace | Logged-in users |
| `/my-listings` | My Listings | Farmers only |
| anything else | goes to `/prices` | |

If `client/.env` is missing, App.js shows "Firebase keys are missing" and how to fix it, instead of a blank page.

### `src/App.css`: the styles
All colors are saved as variables at the top (`--brand`, `--gdark`...), the same colors as Agos, so the look stays consistent. At the bottom, `@media (max-width: 600px)` adjusts the layout for phones (responsive design).

### `src/firebase.js`: connects to Firebase
Reads the keys from `.env`, starts Firebase with `initializeApp`, and exports `auth` (login) and `db` (database). `firebaseReady` is `true` only when the keys are there.

### `src/constants.js`: fixed lists
`CROPS` (the same 10 crops as the server) and `TOWNS` (44 places in Iloilo). The forms use dropdowns from these lists, so nobody types "Tomatoes" or misspells a town. Every listing then links to a real crop page.

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
| `listingsService.js` | `listings` collection | `getAvailableListings`, `getMyListings` (Read), `addListing` (Create), `updateListing`, `markSold` (Update), `deleteListing` (Delete), `friendlyListingError` |
| `pricesService.js` | Our Express server | `getPrices(search)` → `GET /api/prices`, `getPriceHistory(crop)` → `GET /api/prices/:crop` |
| `wikipediaService.js` | Wikipedia | `getCropInfo(cropName)` → `{ title, description, photo, link }` |

Two details to point out:
- **Friendly errors:** Firebase sends codes like `auth/invalid-credential`. `friendlyAuthError` turns them into "Wrong email or password." `friendlyListingError` turns `permission-denied` into "You can't change this listing."
- **Wikipedia titles:** some crop names aren't Wikipedia page titles, so `WIKI_TITLES` says which page to use (Pechay → "Bok choy", Ampalaya → "Momordica charantia", Squash → "Calabaza", and so on). These are the same pages Agos uses.

### `src/layouts/MainLayout.js`
The frame every page sits in: `Navbar`, then the page (`children`), then `Footer`.

### `src/components/`: reusable pieces
| File | What it does |
|---|---|
| `Navbar.js` | The green top bar. Uses `NavLink`, which highlights the page you're on. Shows My Listings only to farmers, plus the person's name, role and Log out. Moving between pages doesn't reload the page, so our app is a single-page application (SPA). |
| `Footer.js` | Says where our data comes from (PSA, monthly, not real-time; Wikipedia). |
| `Loading.js` | A spinner and text while we wait for an API. |
| `ErrorMessage.js` | A red box with the problem and a "Try again" button. |
| `ProtectedRoute.js` | A guard. Not logged in → `/login`. A buyer opening My Listings → `/marketplace`. |
| `SearchBar.js` | A labelled search box. With `onSubmit` it has a Search button (Market Prices); without it, the page filters as you type (Marketplace). |
| `ListingCard.js` | One listing as a card: crop, price, kilos, town, harvest date, farmer, notes, and "Available" or "Sold" written in words (not color alone). My Listings adds its buttons as `children`. |
| `ListingForm.js` | The post and edit form. `checkForm` explains every wrong field ("Choose your town."). The edit form also has a Status field, so a farmer can change "Sold" back to "Available". It scrolls into view when it opens. |

### `src/pages/`: one file per screen
Every page that uses an API follows the same pattern. **State** for the data, loading and error → **`useEffect`** to load when the page opens → call a **service** → show **loading, error, empty, or the data**. Once you understand one page, the others read the same way.

- **`Login.js`**: email and password. Checks that both are filled, calls `login()`, and shows Firebase errors in plain words.
- **`Register.js`**: name, email, password (6+ characters) and a Farmer/Buyer choice. Calls `register()`, then `refreshUser()`.
- **`MarketPrices.js`**: the newest PSA farmgate price of each crop, with search. Always shows the source ("PSA OpenSTAT"), the month of each price, and when our server last checked PSA. `useCallback` keeps `loadPrices` the same between redraws, so `useEffect` runs only once.
- **`CropDetails.js`**: uses two APIs at the same time. The left card is Wikipedia (photo and description). The right card is our server (`GET /api/prices/Tomato`): the newest price and the last 12 months. Each card has its own loading and error, so if Wikipedia is down, the prices still show.
- **`Marketplace.js`**: loads every available listing once, then searches, filters (town, min and max price) and sorts (newest, price low→high, high→low) in React with `.filter()` and `.sort()`. Shows "Showing 2 of 5 listings" and a Clear filters button.
- **`MyListings.js`**: the farmer's own listings with all of CRUD. **Post a crop** (Create), the list (Read), **Edit** and **Mark as sold** (Update), **Delete**. Delete asks "This can't be undone" first. Every action shows a success or error message, and the buttons are disabled while it saves.

---

## 5. `firestore.rules`: the database's guard
Anyone can open the browser tools and try to change data directly, so Firestore checks every request against these rules **on Google's servers**. That makes them part of our server-side logic.
- `request.auth` is the person asking, `resource.data` is the listing now, and `request.resource.data` is what they want it to become.
- Only logged-in people can read. Only farmers can post, only as themselves, with quantity and price above 0. Only the owner can edit or delete, and nobody can give a listing to someone else. People can only write their own profile.

---

## 6. HTTP methods and status codes in our code

| Method | Where |
|---|---|
| GET | `GET /api/prices`, `GET /api/prices/:crop` (React → our server), GET the PSA table codes (server → PSA), `GET /page/summary/...` (React → Wikipedia), `getDocs`/`getDoc` (Firestore) |
| POST | Server → PSA (sends the query), Firebase login and register, `addDoc` (new listing) |
| PATCH-style update | `updateDoc` (edit, mark sold) sends only the fields that change |
| DELETE | `deleteDoc` (delete a listing) |

| Code | When our app sends or gets it |
|---|---|
| 200 OK | Prices loaded |
| 400 Bad Request | Search text longer than 50 characters |
| 403-style "permission denied" | A buyer tries to change a farmer's listing (Firestore rules) |
| 404 Not Found | `/api/prices/Banana` (crop we don't track), or Wikipedia has no page |
| 500 Server Error | Something crashed inside our server |
| 502 Bad Gateway | PSA didn't answer our server |

The Week 4 upgrade (listings through our own Express API with POST, PUT and DELETE) is in the study guide and isn't built yet.

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

---

## 9. What was tested, and what wasn't
Tested on a computer without the real services, using stand-ins:
- **Server:** with a fake PSA that answers in PSA's real format. All endpoints, the search check (400), unknown crop (404), PSA down (502), the 1-hour cache (4 requests, PSA called only once per table) and the busy-port message.
- **The whole app in a browser,** with Firebase's official local test tools (emulators): register, login, wrong password, every page, search, filters, sort, all CRUD actions, buyer vs farmer access, error screens, and phone size (no sideways scrolling).
- **Security rules:** 13 checks, for example "a buyer can't delete a farmer's listing" and "a farmer can't post 0 kg".

**Not tested yet:** the real PSA website and Wikipedia (our test computer couldn't reach them), and a real Firebase project. Once you add your `.env`, open http://localhost:5000/api/prices first to confirm PSA works.

---

## 10. Undoing a change
The project uses Git, with one commit per part:
```
git log --oneline          # see the saved steps
git diff                   # see what changed since the last save
git checkout -- <file>     # throw away unsaved changes to one file
git revert <commit-id>     # undo one saved step, keeping everything after it
```
