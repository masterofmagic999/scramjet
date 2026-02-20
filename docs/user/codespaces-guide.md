# Scramjet – Complete Codespaces Startup Guide

Everything a non-technical user needs to know, from opening a Codespace for
the first time to enabling Appwrite cloud sync so your sessions survive
restarts.  No prior coding experience required.

---

## Table of contents

1. [What is a Codespace?](#1-what-is-a-codespace)
2. [Step 1 – Fork & open your Codespace](#2-step-1--fork--open-your-codespace)
3. [Step 2 – Wait for the build](#3-step-2--wait-for-the-build)
4. [Step 3 – Open the proxy in your browser](#4-step-3--open-the-proxy-in-your-browser)
5. [Step 4 – Browse the web](#5-step-4--browse-the-web)
6. [Step 5 – (Optional) Enable Appwrite cloud sync](#6-step-5--optional-enable-appwrite-cloud-sync)
   - [6a – Create a free Appwrite project](#6a--create-a-free-appwrite-project)
   - [6b – Create the database and collection](#6b--create-the-database-and-collection)
   - [6c – Create an API key](#6c--create-an-api-key)
   - [6d – Add the keys to Scramjet](#6d--add-the-keys-to-scramjet)
   - [6e – Verify cloud sync is active](#6e--verify-cloud-sync-is-active)
7. [Keeping your Codespace alive](#7-keeping-your-codespace-alive)
   - [Heartbeat keep-alive script](#heartbeat-keep-alive-script)
   - [Memory limits](#memory-limits)
   - [Usage limits and staying within the free tier](#usage-limits-and-staying-within-the-free-tier)
8. [Stopping and restarting](#8-stopping-and-restarting)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What is a Codespace?

A **GitHub Codespace** is a cloud computer that runs inside your browser —
no software to install on your own machine.  Scramjet runs on that cloud
computer and proxies websites for you.  Because it runs in GitHub's
infrastructure (not on a school or work network) it can reach sites that
might otherwise be blocked.

**What you need:**

- A free GitHub account — <https://github.com/signup>
- Nothing else (no Appwrite account required to get started)

---

## 2. Step 1 – Fork & open your Codespace

### Fork the repository

A *fork* is your own personal copy of the Scramjet repository.  You need
it so you can create a Codespace under your own account (Codespace minutes
are charged to whoever owns the repo).

1. Go to the Scramjet repository page on GitHub.
2. Click **Fork** (top-right corner).
3. Leave all settings as-is and click **Create fork**.

### Open a Codespace on your fork

1. On **your fork**, click the green **Code** button.
2. Click the **Codespaces** tab.
3. Click **Create codespace on main**.

GitHub will open a loading screen while it sets up the container.
A VS Code editor will appear in your browser once it is ready — this is
your Codespace.

> **Tip:** You can also click the badge below from your fork page:
> [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/masterofmagic999/scramjet)

---

## 3. Step 2 – Wait for the build

The **first time** you open a Codespace, it automatically runs
`codespace-basic-setup.sh` in the background.  This script:

- Installs the Rust toolchain (required for the WASM rewriter)
- Installs `wasm-bindgen`, `wasm-opt`, and `wasm-snip`
- Installs Node.js dependencies (`pnpm i`)
- Compiles the WASM rewriter (`pnpm rewriter:build`)
- Builds Scramjet (`pnpm build`)

**This takes 10–20 minutes on first run** (mostly Rust compilation).
You will see terminal output like:

```
+ cargo install wasm-bindgen-cli --version 0.2.100
   Compiling ...
```

You can watch progress in the **Terminal** panel at the bottom of the
editor.  Open it with `` Ctrl+` `` if it is hidden.

Once the build finishes the dev server starts automatically and port
`1337` is forwarded to your browser.

> **On subsequent starts** the build cache is already present, so the
> server starts in seconds — no waiting.

---

## 4. Step 3 – Open the proxy in your browser

When the server is running you will see a pop-up notification in the
bottom-right corner of VS Code: **"Your application running on port 1337
is available."**  Click **Open in Browser**.

If the notification disappears before you click it:

1. Click the **Ports** tab in the bottom panel (next to Terminal).
2. Find port `1337` in the list.
3. Click the globe icon 🌐 to open it in a new browser tab.

Scramjet should now be running in that tab.

---

## 5. Step 4 – Browse the web

- Type any URL (e.g. `https://google.com`) in the address bar at the top
  of the Scramjet interface and press **Enter**.
- Click the **🎮 Games** tab for a curated list of browser games that work
  well through the proxy.
- The **☁️ Cloud Sync** tab (top-right) shows whether Appwrite sync is
  active (green dot) or you are using local storage (grey dot).

---

## 6. Step 5 – (Optional) Enable Appwrite cloud sync

Without cloud sync your browsing cookies (saved logins) are stored in a
file inside the Codespace.  **That file is lost when the Codespace is
deleted or rebuilt.**

With Appwrite cloud sync your cookies are saved to the Appwrite database
so you can delete and recreate Codespaces without losing your logins.

> **Is this required?**  No.  If you never delete your Codespace and just
> stop/restart it, your cookies persist fine in local mode.  Cloud sync
> is only necessary if you want to switch Codespaces or you worry about
> data loss.

---

### 6a. – Create a free Appwrite project

1. Go to <https://cloud.appwrite.io> and sign up for a free account.
2. Click **Create project**.
3. Give it any name (e.g. `scramjet`).
4. Click **Create**.

You will land on the project dashboard.

---

### 6b. – Create the database and collection

Scramjet needs a specific database and collection in your Appwrite project.
Follow these steps exactly — the IDs must match.

#### Create the database

1. In the left sidebar click **Databases**.
2. Click **Create database**.
3. In the **Database ID** field, **clear the auto-generated value** and
   type exactly:
   ```
   6998bda1003d071c37b6
   ```
4. Give it any name (e.g. `scramjet-db`) and click **Create**.

#### Create the collection

1. Inside the new database, click **Create collection**.
2. In the **Collection ID** field, **clear the auto-generated value** and
   type exactly:
   ```
   parastar
   ```
3. Give it any name (e.g. `cookie-store`) and click **Create**.

#### Add the required attributes

Inside the new collection, click the **Attributes** tab and add these
three attributes one at a time:

| Attribute key | Type     | Size      | Required |
|---------------|----------|-----------|----------|
| `user_id`     | String   | `36`      | ✅ Yes   |
| `cookies`     | String   | `1000000` | ✅ Yes   |
| `updated_at`  | DateTime | —         | ✅ Yes   |

For each attribute:
1. Click **Create attribute**.
2. Choose the type from the table above.
3. Set the **Attribute ID** to the exact key name (e.g. `user_id`).
4. Set the **Size** where shown.
5. Toggle **Required** on.
6. Click **Create**.

#### Set permissions

1. Still inside the collection, click the **Settings** tab.
2. Scroll down to **Permissions**.
3. Click **Add role** → select **Any**.
4. Tick **Create**, **Read**, **Update**, **Delete**.
5. Click **Update**.

> **Why?**  The server uses your private API key to read and write
> documents, not end-user sessions.  The "Any" permission is scoped to
> your API key only — it does not make the data public.

---

### 6c. – Create an API key

1. In the left sidebar click **Settings** → **API Keys**.
2. Click **Create API Key**.
3. Give it a name (e.g. `scramjet-server`).
4. Set an expiry if you want (or leave it as **Never**).
5. Under **Scopes**, grant at least:
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `documents.read`
   - `documents.write`
   - `documents.delete`
6. Click **Create**.
7. **Copy the secret key now** — it is only shown once.

---

### 6d. – Add the keys to Scramjet

Back in your **Codespace terminal** (open it with `` Ctrl+` `` if hidden):

```sh
cp .env.example .env
```

Then open `.env` in the editor (you can click the file in the Explorer
sidebar on the left) and fill in the three values:

```
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<the-secret-key-you-copied>
```

Replace `<your-project-id>` with the ID shown in **Settings → General**
of your Appwrite project.

Save the file (`Ctrl+S`) then restart the server:

```sh
# Press Ctrl+C in the terminal to stop the running server, then:
pnpm dev
```

---

### 6e. – Verify cloud sync is active

1. Reload the Scramjet tab in your browser.
2. Click the **☁️ Cloud Sync** button in the toolbar.
3. You should see a **green ● Appwrite sync enabled** badge.

If you see the grey badge instead, double-check that `.env` was saved and
the server was restarted.

---

## 7. Keeping your Codespace alive

### Heartbeat keep-alive script

GitHub Codespaces pauses automatically after **30 minutes of browser
inactivity**.  A keep-alive script is already included and starts
automatically with the server (configured in `.devcontainer/devcontainer.json`):

```sh
node scripts/heartbeat.js
```

This script pings the local server every **4 minutes** so the Codespace
does not go idle while you are using it.  It also prints heap memory
usage at each ping so you can monitor memory on low-RAM instances.

To start it manually (e.g. after you stopped it):

```sh
node scripts/heartbeat.js &
```

> **Tip:** You can raise GitHub's idle timeout to up to **4 hours**:
> _GitHub Settings → Codespaces → Default idle timeout_

---

### Memory limits

The devcontainer is pre-configured with:

```
NODE_OPTIONS=--max-old-space-size=512 --expose-gc
```

This caps the V8 JavaScript heap at **512 MB**, which keeps Scramjet
responsive on the smallest (2-core / 8 GB) Codespace tier.

When Appwrite cloud sync is enabled, cookie data lives in the remote
database rather than in the Node.js heap, so memory usage stays flat
even after weeks of uptime.

---

### Usage limits and staying within the free tier

| Plan | Free core-hours / month | 2-core runtime / month |
|------|------------------------|------------------------|
| Free | 120 core-hours         | ≈ 60 hours             |
| Pro  | 180 core-hours         | ≈ 90 hours             |

Running a 2-core Codespace **24 × 7** for two months requires roughly
**2,880 core-hours**, which far exceeds the free tier.  To run
cost-effectively:

1. **Use the heartbeat only while you are actively browsing** — it keeps
   the Codespace alive while you need it, but you should still stop the
   Codespace when you are done for the day.
2. **Stop the Codespace when you finish** — in the GitHub Codespaces
   dashboard click **Stop codespace**.  A stopped Codespace uses no
   compute hours.
3. **Enable paid usage if needed** — GitHub lets you set a monthly
   spending cap.  Even a few dollars covers many hours of additional
   runtime.
4. **Enable Appwrite cloud sync** — because your sessions are stored in
   Appwrite you can freely stop, delete, and recreate Codespaces without
   losing your logins.

---

## 8. Stopping and restarting

### Stop the server (but keep the Codespace running)

Press `Ctrl+C` in the terminal where `pnpm dev` is running.

### Restart the server

```sh
pnpm dev
```

### Stop the entire Codespace

1. Go to <https://github.com/codespaces>.
2. Find your Codespace in the list.
3. Click the `…` menu → **Stop codespace**.

### Resume a stopped Codespace

1. Go to <https://github.com/codespaces>.
2. Click your Codespace name (or the `…` menu → **Open in browser**).
3. The server starts automatically (no rebuild needed — the build cache
   is already in place).

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| "Appwrite sync enabled" badge is grey after adding keys | Make sure you saved `.env` and ran `pnpm dev` again to restart the server. |
| Cookies are lost after creating a new Codespace | Enable Appwrite cloud sync (Step 5) so cookies are stored remotely. |
| Server not responding / blank page | Run `pnpm dev` in the terminal. Check the **Ports** tab for the correct forwarded URL. |
| Build errors on first start | The postCreateCommand is still running. Wait for it to finish (watch the terminal). |
| "Cannot find module 'node-appwrite'" | Run `pnpm i` in the terminal to reinstall dependencies. |
| Port 1337 not showing in browser | In the Ports tab, right-click port 1337 and choose **Open in Browser**. |
| Codespace pauses too quickly | Raise the idle timeout in GitHub Settings → Codespaces, and confirm `heartbeat.js` is running. |
| Forgot the forwarded URL | Codespaces tab in VS Code → Ports → click the globe icon next to port 1337. |

