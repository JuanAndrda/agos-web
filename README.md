# AgosUgnayan Web

Our CIT 210 project: a React web app where Iloilo farmers post crops for sale and buyers find them, with real farmgate prices from the PSA.

It uses four services:

| Service | What it does in our app | How React reaches it |
|---|---|---|
| **Firebase Authentication** | Log in and register (Farmer or Buyer) | Directly, with the `firebase` library |
| **Firestore** | Our database: `users` and `listings` | `users`: directly, with the `firebase` library. `listings`: only through our Express server |
| **Our Express server** (`server/`) | 1. Gets Iloilo prices from **PSA OpenSTAT**, cleans them, keeps them for 1 hour. 2. Our listings API and 3. our orders API: checks who is asking and checks the data, then reads or writes Firestore | `fetch("/api/prices")`, `fetch("/api/listings")` and `fetch("/api/orders")` |
| **Wikipedia API** | Crop photo and short description | `fetch(...)` straight from the browser |

Read **[EXPLAINED.md](EXPLAINED.md)** for a plain-English explanation of every file.

**New to the project?** Follow **[HOW-TO-RUN.md](HOW-TO-RUN.md)** to run it on your laptop in a few steps.

## What you need

- Node.js 18 or newer (check with `node -v`)
- A Firebase project (free)

## Setup (once)

Important: there is no `package.json` in the main `agos-web` folder. Run `npm` commands inside `server` or `client`. If `npm` says it "could not read package.json", you are in the wrong folder.

1. **Install the packages** in both folders:
   ```
   cd server
   npm install
   cd ../client
   npm install
   ```
2. **Set up Firebase** (about 10 minutes):
   1. **Create the project:** go to https://console.firebase.google.com and sign in with Google. Click **Create a project**, name it `agos-web`, turn **Google Analytics off** (we don't need it), and click **Create project**.
   2. **Get the keys:** on the project's home page, click the **`</>`** (Web) icon. Type the nickname `agos-web`, leave "Firebase Hosting" unticked, and click **Register app**. Firebase shows code like `const firebaseConfig = { apiKey: "...", ... }`. Keep that page open for step 3.
   3. **Turn on login:** in the left menu, go to **Build → Authentication → Get started**. Click **Email/Password**, switch on the first **Enable** toggle, and click **Save**.
   4. **Create the database:** go to **Build → Firestore Database → Create database**. If it asks for an edition, pick **Standard**. Choose the location **asia-southeast1 (Singapore)**, the closest to Iloilo. Choose **Start in production mode** and click **Create**.
   5. **Paste the security rules:** in Firestore, open the **Rules** tab and delete what's there. Open [`firestore.rules`](firestore.rules) from this folder (for example `notepad firestore.rules`), copy everything in it, paste it into the Rules tab, and click **Publish**.
3. **Add the keys:** in Command Prompt, go into the `client` folder and run:
   ```
   copy .env.example .env
   notepad .env
   ```
   Copy each value from the Firebase page (step 2.2) into the matching line, with no quotes, spaces or commas:
   ```
   REACT_APP_FIREBASE_API_KEY=      ← apiKey
   REACT_APP_FIREBASE_AUTH_DOMAIN=  ← authDomain
   REACT_APP_FIREBASE_PROJECT_ID=   ← projectId
   REACT_APP_FIREBASE_APP_ID=       ← appId
   ```
   Save and close. The `.env` file is in `.gitignore`, so it never goes to GitHub. Never paste the keys in chat.
4. **Give our server its key.** Listings go through our Express server, so the server needs its own Firebase key:
   1. In the Firebase Console, click the **gear icon** next to "Project Overview", then **Project settings**, then the **Service accounts** tab.
   2. Click **Generate new private key**, then **Generate key**. A `.json` file downloads.
   3. Move that file into the `server` folder and rename it to exactly `serviceAccountKey.json`. Windows often hides the `.json` ending. If it does, type only `serviceAccountKey`, or the file becomes `serviceAccountKey.json.json`. Check with `dir server`.

   This key gives **full access to our database**. It is in `.gitignore`, so it never goes to GitHub. Never paste it in chat or send it in a group chat. If a groupmate needs to run the server, add them to the Firebase project (Project settings → Users and permissions) so they can download their own key.
5. **Restart the React app and the server** if they were running: press **Ctrl + C**, type **Y**, then run `npm start` again. React only reads `.env` when it starts, and the server only reads its key when it starts.
6. **Try it:** on the page that opens, click **Create one** and register as a Farmer.

## Run it (every time)

Open two terminals:

```
# Terminal 1: our Express server (port 5000)
cd server
npm start

# Terminal 2: the React app (port 3000)
cd client
npm start
```

Then open http://localhost:3000.

Quick server checks:
- Open http://localhost:5000/api/prices. You should see JSON with prices. If you see an error about PSA, the PSA website may be down or slow; try again later.
- Open http://localhost:5000/api/listings. You should see `{"error":"Please log in first."}`. That's correct: the browser's address bar sends no login token. If it says the server "has no Firebase key yet", do setup step 4.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Firebase keys are missing" | `client/.env` is missing or empty. Do setup step 3, then stop `npm start` (Ctrl + C) and start it again. |
| "Our price server isn't answering" or "Our listings server isn't answering" | The Express server isn't running. Start it in Terminal 1. |
| "The listings are off because our server has no Firebase key yet" | `server/serviceAccountKey.json` is missing or has the wrong name. Do setup step 4, then restart the server. |
| "Your login has expired" | Log out and log in again. |
| "The server could not start on port 5000" | Something else is using port 5000, maybe an old server window. Close it and try again. |
| "We couldn't get prices from PSA right now" | Our server works, but PSA didn't answer. Wait and press Try again. |
| "Only farmers can do this." when posting | You're logged in as a Buyer. Log in with a Farmer account. |
| `npm start` in client fails with `options.allowedHosts[0] should be a non-empty string` | This Create React App bug appears when the computer has no local network address, for example when offline. Connect to Wi-Fi and try again. If it still fails, add `DANGEROUSLY_DISABLE_HOST_CHECK=true` to `client/.env`. Use this only on your own computer while developing. |

## Folder structure

```
agos-web/
├── server/              ← our backend (Express + PSA + Firebase Admin)
│   ├── index.js         ← starts the server: the price endpoints, and plugs in listings.js
│   ├── psa.js           ← talks to the PSA OpenSTAT API
│   ├── firebaseAdmin.js ← connects the server to Firebase with its secret key
│   ├── auth.js          ← middleware: is this person logged in? are they a farmer?
│   ├── listings.js      ← the listings API: GET, POST, PATCH and DELETE /api/listings
│   ├── orders.js        ← the orders API: POST, GET and PATCH /api/orders (cart checkout)
│   └── serviceAccountKey.json  ← the secret key (you add it; never on GitHub)
├── client/              ← our React app (Create React App)
│   ├── .env.example     ← the names of the Firebase keys (copy to .env)
│   ├── public/index.html
│   └── src/
│       ├── index.js, App.js, App.css
│       ├── firebase.js       ← connects to Firebase
│       ├── constants.js      ← the crop and town lists
│       ├── context/          ← who is logged in, and the cart
│       ├── services/         ← EVERY API call lives here
│       ├── layouts/          ← Navbar + page + Footer
│       ├── components/       ← reusable pieces
│       └── pages/            ← one file per screen
├── firestore.rules      ← the database's security rules
├── README.md            ← this file
└── EXPLAINED.md         ← every file explained
```
