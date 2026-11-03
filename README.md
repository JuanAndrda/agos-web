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

1. **Install the packages** in both folders:
   ```
   cd server
   npm install
   cd ../client
   npm install
   ```
2. **Set up Firebase** at https://console.firebase.google.com:
   - Create a project, then add a **Web app** and keep its config open.
   - Build → **Authentication** → Get started → turn on **Email/Password**.
   - Build → **Firestore Database** → Create database.
   - Firestore → **Rules**: paste everything from [`firestore.rules`](firestore.rules) and click Publish.
3. **Add the keys:** in the `client` folder, copy `.env.example` to a new file named `.env` and paste your Firebase config values after each `=`. The `.env` file is in `.gitignore`, so it never goes to GitHub. Never paste the keys in chat.

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
