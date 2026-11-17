# How to run AgosUgnayan Web on your laptop (for groupmates)

This is the short version. You do **not** make your own Firebase project: we all use the group's Firebase project, so we all see the same users and listings. The full details are in [README.md](README.md).

## 1. Install these first (once)

- **Node.js 18 or newer**: download the LTS version from https://nodejs.org. Check it in Command Prompt with `node -v`.
- **Git**: download from https://git-scm.com. Check with `git --version`.
- A **GitHub account**. Send your username to Juan so he can invite you to the private repo, then accept the invite in your email.

## 2. Get the code (once)

Open Command Prompt in the folder where you keep projects (for example `C:\dev`) and run:

```
git clone -b cart-orders https://github.com/JuanAndrda/agos-web.git
cd agos-web
```

`-b cart-orders` picks the newest version (with the new look, cart and orders). If Juan tells you a different branch, use that name instead. GitHub may ask you to sign in the first time.

## 3. Install the packages (once)

There is no `package.json` in the main `agos-web` folder, so run `npm install` **inside** `server` and **inside** `client`:

```
cd server
npm install
cd ..\client
npm install
cd ..
```

This downloads the `node_modules` folders. They are big and are never put on GitHub, so everyone installs their own.

## 4. Add the two secret files (once)

These files hold keys, so they are **not** on GitHub (they are listed in `.gitignore`). Never upload them, and never paste them in a group chat.

**a) `client/.env`: the Firebase web keys.** Juan sends you the four values privately.

```
cd client
copy .env.example .env
notepad .env
```

Paste each value after its `=` sign (no quotes, no spaces), save, close, then go back with `cd ..`.

**b) `server/serviceAccountKey.json`: the server's Firebase key.** This one gives full access to our database, so be careful with it.
- Best way: Juan adds your Google account to the Firebase project (Project settings → Users and permissions). Then in the Firebase Console go to the gear icon → **Project settings** → **Service accounts** → **Generate new private key**.
- Or Juan sends you the file privately (a direct message, not the group chat).

Put the file in the `server` folder and name it exactly `serviceAccountKey.json`. Windows often hides the `.json` ending, so if you type it you may get `serviceAccountKey.json.json`. Check with `dir server`.

You do **not** need to touch the Firebase Authentication settings or `firestore.rules`. Juan already turned on Email/Password login and publishes the rules in the Firebase Console once for the whole group.

## 5. Run it (every time)

Open **two** Command Prompt windows, both in the `agos-web` folder.

```
:: Window 1: our Express server (port 5000)
cd server
npm start
```

```
:: Window 2: the React app (port 3000)
cd client
npm start
```

Start the server first, then the React app. The browser opens http://localhost:3000 by itself (if not, open it yourself). Keep both windows open while you use the app. To stop, press **Ctrl + C** in each window.

## 6. Get the newest code later

When Juan pushes changes, run this in the `agos-web` folder:

```
git pull
```

If `package.json` changed, run `npm install` again in that folder.

## Quick fixes

| What you see | What to do |
|---|---|
| `npm` says it "could not read package.json" | You're in the wrong folder. `cd server` or `cd client` first. |
| "Firebase keys are missing" | `client/.env` is missing or empty (step 4a). Stop the React app with Ctrl + C and `npm start` again. |
| "server isn't answering" | Window 1 (the server) isn't running. Start it. |
| "our server has no Firebase key yet" | `server/serviceAccountKey.json` is missing or misnamed (step 4b). Restart the server. |
| "The server could not start on port 5000" | An old server window is still open. Close it and try again. |

More fixes are in the "If something goes wrong" table in [README.md](README.md).
