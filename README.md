# AgosUgnayan Web

Our CIT 210 project: a React web app where Iloilo farmers post crops for sale and buyers find them, with real farmgate prices from the PSA.

It uses four services:

| Service | What it does in our app | How React reaches it |
|---|---|---|
| **Firebase Authentication** | Log in and register (Farmer or Buyer) | Directly, with the `firebase` library |
| **Firestore** | Our database: `users` and `listings` | Directly, with the `firebase` library |
| **Our Express server** (`server/`) | Gets Iloilo prices from **PSA OpenSTAT**, cleans them, keeps them for 1 hour | `fetch("/api/prices")` |
| **Wikipedia API** | Crop photo and short description | `fetch(...)` straight from the browser |

Read **[EXPLAINED.md](EXPLAINED.md)** for a plain-English explanation of every file.

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
4. **Restart the React app** if it was running: press **Ctrl + C**, type **Y**, then run `npm start` again. React only reads `.env` when it starts.
5. **Try it:** on the page that opens, click **Create one** and register as a Farmer.

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

Quick server check: open http://localhost:5000/api/prices. You should see JSON with prices. If you see an error about PSA, the PSA website may be down or slow; try again later.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Firebase keys are missing" | `client/.env` is missing or empty. Do setup step 3, then stop `npm start` (Ctrl + C) and start it again. |
| "Our price server isn't answering" | The Express server isn't running. Start it in Terminal 1. |
| "The server could not start on port 5000" | Something else is using port 5000, maybe an old server window. Close it and try again. |
| "We couldn't get prices from PSA right now" | Our server works, but PSA didn't answer. Wait and press Try again. |
| "You can't change this listing" when posting | The Firestore rules weren't published, or the account is a Buyer. Check setup step 2. |
| `npm start` in client fails with `options.allowedHosts[0] should be a non-empty string` | This Create React App bug appears when the computer has no local network address, for example when offline. Connect to Wi-Fi and try again. If it still fails, add `DANGEROUSLY_DISABLE_HOST_CHECK=true` to `client/.env`. Use this only on your own computer while developing. |

## Folder structure

```
agos-web/
├── server/              ← our backend (Express + PSA)
│   ├── index.js         ← the endpoints: GET /api/prices and GET /api/prices/:crop
│   └── psa.js           ← talks to the PSA OpenSTAT API
├── client/              ← our React app (Create React App)
│   ├── .env.example     ← the names of the Firebase keys (copy to .env)
│   ├── public/index.html
│   └── src/
│       ├── index.js, App.js, App.css
│       ├── firebase.js       ← connects to Firebase
│       ├── constants.js      ← the crop and town lists
│       ├── context/          ← who is logged in
│       ├── services/         ← EVERY API call lives here
│       ├── layouts/          ← Navbar + page + Footer
│       ├── components/       ← reusable pieces
│       └── pages/            ← one file per screen
├── firestore.rules      ← the database's security rules
├── README.md            ← this file
└── EXPLAINED.md         ← every file explained
```
