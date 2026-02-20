<h1 align="center">Scramjet</h1>
<div align="center">
  <img src="assets/scramjet.png" height="200" />
</div>

<div align="center">
  <a href="https://www.npmjs.com/package/@mercuryworkshop/scramjet"><img src="https://img.shields.io/npm/v/@mercuryworkshop/scramjet.svg?maxAge=3600" alt="npm version" /></a>
  <img src="https://img.shields.io/github/issues/MercuryWorkshop/scramjet?style=flat&color=orange" />
  <img src="https://img.shields.io/github/stars/MercuryWorkshop/scramjet?style=flat&color=orange" />
</div>

---

Scramjet is an interception-based web proxy designed to bypass arbitrary web browser restrictions, support a wide range of sites, and act as middleware for open-source projects. It prioritizes security, developer friendliness, and performance.

## Supported Sites

Scramjet has CAPTCHA support! Some of the popular websites that Scramjet supports include:

- [Google](https://google.com)
- [Twitter](https://twitter.com)
- [Instagram](https://instagram.com)
- [Youtube](https://youtube.com)
- [Spotify](https://spotify.com)
- [Discord](https://discord.com)
- [Reddit](https://reddit.com)
- [GeForce NOW](https://play.geforcenow.com/)

Ensure you are not hosting on a datacenter IP for CAPTCHAs to work reliably along with YouTube. Heavy amounts of traffic will make some sites NOT work on a single IP. Consider rotating IPs or routing through Wireguard using a project like <a href="https://github.com/whyvl/wireproxy">wireproxy</a>.

An easy to deploy version of Scramjet can be found at [Scramjet-App](https://github.com/MercuryWorkshop/scramjet-app).

## 🚀 Quick Start — GitHub Codespaces (No Install Required)

> **Non-technical users:** You can run Scramjet for free in your browser using GitHub Codespaces — no local install needed.

1. **Fork this repository** – click the **Fork** button at the top right of this page.
2. **Open a Codespace** – on your fork, click **Code → Codespaces → Create codespace on main**.  
   [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/masterofmagic999/scramjet)
3. **Wait for the build** – the Codespace will automatically install all dependencies and build Scramjet. This takes **10–20 minutes** on first run (mostly Rust/WASM compilation). You will see terminal output while it works.
4. **Open the proxy** – once the build finishes, the dev server starts on port **1337**. GitHub will show a notification; click **Open in Browser**, or go to the **Ports** tab and click the link next to port `1337`. If the notification doesn't appear, open the **Ports** panel (bottom of VS Code) and click the globe icon next to port `1337`.
5. **Browse freely** – type any URL in the address bar and press **Enter**. Use the **🎮 Games** tab for instant access to popular browser games.

> **Tip:** The Codespace keeps itself alive via a built-in heartbeat. If you stop the Codespace, just restart it — the server starts automatically and the build is skipped (already cached).

## Development

### Dependencies

- Recent versions of `node.js` and `pnpm`
- `rustup`
- `wasm-bindgen`
- [Binaryen's `wasm-opt`](https://github.com/WebAssembly/binaryen)
- [this `wasm-snip` fork](https://github.com/r58Playz/wasm-snip)

#### Building

- Clone the repository with `git clone --recursive https://github.com/MercuryWorkshop/scramjet`
- Install the dependencies with `pnpm i`
- Build the rewriter with `pnpm rewriter:build`
- Build Scramjet with `pnpm build`

### Running Scramjet Locally

You can run the Scramjet dev server with the command

```sh
pnpm dev
```

Scramjet should now be running at <http://localhost:1337> and should rebuild upon a file being changed (excluding the rewriter).

### Set up everything (automated)

Run the all-in-one setup script (installs Rust/WASM toolchain, builds everything, starts the server):

```sh
bash codespace-basic-setup.sh
pnpm dev
```

### Setting up Typedoc

The official Scramjet Typedoc gets deployed via GitHub Actions along with the demo site [here](https://scramjet.mercurywork.shop/typedoc).

You can run it locally with:

```
pnpm run docs
pnpm docs:dev
pnpm docs:serve
```

### Set up everything

Do you want to run the Scramjet demo and Typedoc together like what is served on GitHub Pages by the Action?

You can do this by running the serve script:

```sh
chmod +x scripts/serve-static.sh
./scripts/serve-static.sh
```

This essentially simulates the CI pipeline, but in a shell script.

## GitHub Codespaces

A `.devcontainer/devcontainer.json` is included for one-click Codespace setup.

| Feature | Detail |
|---|---|
| Auto-install & build | `codespace-basic-setup.sh` installs the full toolchain (Rust, WASM tools) and builds Scramjet on container creation |
| Auto-start | `pnpm dev` starts the proxy server automatically on every container start |
| Keep-alive | `scripts/heartbeat.js` pings the server every 4 min to prevent idle suspension |
| **Less memory usage** | `NODE_OPTIONS=--max-old-space-size=512` is set in the devcontainer to cap V8 heap usage, keeping the Codespace responsive on low-RAM (2-core) instances |
| Port | `1337` is forwarded automatically and opens in browser on start |

> **New to Codespaces?** See the [step-by-step Codespaces & Appwrite setup guide](docs/user/codespaces-guide.md) for non-technical users.

To start the heartbeat manually: `node scripts/heartbeat.js`

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose |
|---|---|
| `PORT` | Port for the dev server (default: `1337`) |
| `STORE_KEY` | Encryption key for the server-side cookie store (AES-256-GCM, file mode only). Leave unset to store cookies as plain JSON. |
| `COOKIE_STORE_PATH` | Path to the cookie store file (default: `.cookies.json`, file mode only) |
| `NODE_OPTIONS` | Set to `--max-old-space-size=512` to limit V8 heap for low-RAM environments |
| `APPWRITE_ENDPOINT` | Appwrite API endpoint (default: `https://cloud.appwrite.io/v1`) |
| `APPWRITE_PROJECT_ID` | Appwrite project ID — enables cloud-backed cookie storage |
| `APPWRITE_API_KEY` | Appwrite server-side API key — never exposed to the browser |

### Appwrite backend

When `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY` are set, cookies are stored in Appwrite instead of a local JSON file.  This provides:

- **Persistent sessions** – cookies survive Codespace restarts and rebuilds.
- **Flat memory usage** – no cookie data is held in the Node.js heap between requests, so the server stays within the 512 MB cap indefinitely.

Required Appwrite database / collection (create once in your Appwrite project):

| Setting | Value |
|---|---|
| Database ID | `6998bda1003d071c37b6` |
| Collection ID | `parastar` |
| Attribute `user_id` | String, required, size 36 |
| Attribute `cookies` | String, required, size 1000000 |
| Attribute `updated_at` | DateTime, required |

See [docs/user/codespaces-guide.md](docs/user/codespaces-guide.md) for a step-by-step walkthrough.

## Resources

- [TN Docs](https://docs.titaniumnetwork.org/proxies/scramjet) - There's a page on TN's docs for Scramjet, which is structured more like a guide if you are an interested proxy site developer.
- [Scramjet Typedocs](https://scramjet.mercurywork.shop/typedoc) - Contains documentation for Scramjet APIs. This is useful for any proxy site developer.
- [Scramjet-App](https://github.com/MercuryWorkshop/scramjet-app) - A simple example of a proxy site, which uses Scramjet in a mass-deployable manner. This is based on [Ultraviolet-App](https://github.com/titaniumnetwork-dev/ultraviolet-app) for familiarity.
