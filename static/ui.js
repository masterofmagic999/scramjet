const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		scramitize: false,
		cleanErrors: true,
		sourcemaps: false,
		interceptDownloads: true,
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

connection.setTransport(store.transport, [{ wisp: store.wispurl }]);

// ── Tab Cloaking ────────────────────────────────────────────────────────────
const CLOAK = {
	title: "Google",
	favicon: "https://www.google.com/favicon.ico",
};
const _realTitle = document.title;
const _realFavicon = document.getElementById("favicon")?.href ?? "favicon.webp";

document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		document.title = CLOAK.title;
		const fav = document.getElementById("favicon");
		if (fav) fav.href = CLOAK.favicon;
	} else {
		document.title = _realTitle;
		const fav = document.getElementById("favicon");
		if (fav) fav.href = _realFavicon;
	}
});

// ── Session Manager helpers ─────────────────────────────────────────────────
async function fetchCookies() {
	try {
		const res = await fetch("/api/cookies");
		return await res.json();
	} catch {
		return {};
	}
}

async function deleteCookie(domain, name) {
	await fetch(
		`/api/cookies/${encodeURIComponent(domain)}/${encodeURIComponent(name)}`,
		{ method: "DELETE" }
	);
}

async function clearAllCookies() {
	await fetch("/api/cookies", { method: "DELETE" });
}

// ── Panic / one-click clear ─────────────────────────────────────────────────
async function panic() {
	await clearAllCookies();
	localStorage.clear();
	sessionStorage.clear();
	if ("caches" in self) {
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	}
	const regs = await navigator.serviceWorker.getRegistrations();
	await Promise.all(regs.map((r) => r.unregister()));
	location.reload();
}

// ── Live clock helper ────────────────────────────────────────────────────────
// ── Settings dialog ──────────────────────────────────────────────────────────
function Config() {
	this.css = `
    :modal[open] { animation: fade 0.25s ease normal; }
    :modal::backdrop { backdrop-filter: blur(10px); background: rgba(0,0,0,0.45); }
    .section-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.35);
      margin-bottom: 0.4em;
      margin-top: 0.85em;
    }
    .section-label:first-child { margin-top: 0; }
    .transport-row { display: flex; gap: 0.45em; flex-wrap: wrap; margin-bottom: 0.25em; }
    .transport-btn {
      border: 1px solid rgba(76,139,245,0.45);
      background: rgba(76,139,245,0.08);
      backdrop-filter: blur(12px);
      border-radius: 0.6em;
      color: #93c5fd;
      padding: 0.35em 0.8em;
      cursor: pointer;
      font-size: 0.78rem;
      transition: background 0.15s;
    }
    .transport-btn:hover { background: rgba(76,139,245,0.22); }
    .field-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 0.6em;
      color: #fff;
      outline: none;
      padding: 0.4em 0.7em;
      width: 100%;
      font-size: 0.82rem;
      margin-bottom: 0.55em;
    }
    .field-input:focus { border-color: rgba(76,139,245,0.5); }
    .active-transport {
      font-size: 0.68rem;
      color: rgba(255,255,255,0.3);
      margin-top: 0.2em;
      margin-bottom: 0.5em;
    }
    .action-row { display: flex; gap: 0.5em; justify-content: flex-end; margin-top: 0.85em; }
    .btn-close {
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      border-radius: 0.6em;
      color: #fff;
      padding: 0.4em 1em;
      cursor: pointer;
      font-size: 0.82rem;
    }
    .btn-close:hover { background: rgba(255,255,255,0.12); }
    .btn-panic {
      border: 1px solid rgba(220,50,50,0.4);
      background: rgba(220,50,50,0.1);
      border-radius: 0.6em;
      color: #f87171;
      padding: 0.4em 1em;
      cursor: pointer;
      font-size: 0.82rem;
    }
    .btn-panic:hover { background: rgba(220,50,50,0.22); }
  `;

	function handleModalClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 200);
	}

	return html`
    <dialog style="background:rgba(14,14,26,0.92);backdrop-filter:blur(24px);color:#fff;border-radius:14px;border:1px solid rgba(255,255,255,0.1);padding:1.5em;min-width:330px;max-width:420px;width:90vw;">
      <div style="display:flex;align-items:center;gap:0.5em;margin-bottom:1em;">
        <span style="font-size:1rem;font-weight:700;letter-spacing:-0.01em;">⚙ Settings</span>
      </div>

      <div class="section-label">Transport</div>
      <div class="transport-row">
        <button class="transport-btn" on:click=${() => {
					connection.setTransport("/libcurl/index.mjs", [{ wisp: store.wispurl }]);
					store.transport = "/libcurl/index.mjs";
				}}>libcurl.js</button>
        <button class="transport-btn" on:click=${() => {
					connection.setTransport("/epoxy/index.mjs", [{ wisp: store.wispurl }]);
					store.transport = "/epoxy/index.mjs";
				}}>epoxy</button>
        <button class="transport-btn" on:click=${() => {
					connection.setTransport("/baremod/index.mjs", [store.bareurl]);
					store.transport = "/baremod/index.mjs";
				}}>bare server 3</button>
      </div>
      <div class="active-transport">${use(store.transport)}</div>

      <div class="section-label">Wisp URL</div>
      <input class="field-input" bind:value=${use(store.wispurl)} spellcheck="false" />

      <div class="section-label">Bare URL</div>
      <input class="field-input" bind:value=${use(store.bareurl)} spellcheck="false" />

      <div class="action-row">
        <button class="btn-panic" on:click=${panic}>🗑 Panic</button>
        <button class="btn-close" on:click=${() => handleModalClose(this.root)}>Close</button>
      </div>
    </dialog>
  `;
}

// ── Session Manager ─────────────────────────────────────────────────────────
function SessionManager() {
	this.cookies = {};
	this.loading = true;

	const refresh = async () => {
		this.loading = true;
		this.cookies = await fetchCookies();
		this.loading = false;
	};

	this.mount = refresh;

	const handleDelete = async (domain, name) => {
		await deleteCookie(domain, name);
		await refresh();
	};

	const handleClearAll = async () => {
		await clearAllCookies();
		await refresh();
	};

	this.css = `
    overflow-y: auto;
    height: 100%;
    padding: 1.25em;
    box-sizing: border-box;
    animation: slideUp 0.25s ease;
    .panel-header {
      display: flex;
      align-items: center;
      gap: 0.6em;
      margin-bottom: 0.85em;
    }
    .panel-title {
      font-size: 1rem;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    th {
      text-align: left;
      color: rgba(255,255,255,0.4);
      font-weight: 500;
      padding: 0.35em 0.5em;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    td {
      padding: 0.35em 0.5em;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      word-break: break-all;
    }
    .del-btn {
      background: rgba(220,50,50,0.12);
      border: 1px solid rgba(220,50,50,0.3);
      color: #f87171;
      border-radius: 0.4em;
      padding: 0.15em 0.55em;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .del-btn:hover { background: rgba(220,50,50,0.26); }
    .icon-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      border-radius: 0.5em;
      padding: 0.3em 0.7em;
      cursor: pointer;
      font-size: 0.78rem;
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.12); }
    .icon-btn.red { border-color: rgba(220,50,50,0.3); color: #f87171; background: rgba(220,50,50,0.08); }
    .icon-btn.red:hover { background: rgba(220,50,50,0.2); }
  `;

	return html`
    <div>
      <div class="panel-header">
        <span class="panel-title">🍪 Session Cookies</span>
        <button class="icon-btn" on:click=${refresh}>↻ Refresh</button>
        <button class="icon-btn red" on:click=${handleClearAll}>🗑 Clear All</button>
      </div>
      ${use(this.loading, (loading) =>
				loading
					? html`<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;padding:1em 0;">Loading…</div>`
					: html`<table>
              <thead><tr>
                <th>Domain</th><th>Name</th><th>Value</th><th>Path</th><th></th>
              </tr></thead>
              <tbody>
                ${use(this.cookies, (cookies) => {
									const rows = [];
									for (const [domain, names] of Object.entries(cookies)) {
										for (const [name, meta] of Object.entries(names)) {
											rows.push(
												html`<tr>
                          <td>${domain}</td>
                          <td>${name}</td>
                          <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${meta.value}</td>
                          <td>${meta.path ?? "/"}</td>
                          <td><button class="del-btn" on:click=${() => handleDelete(domain, name)}>✕</button></td>
                        </tr>`
											);
										}
									}
									return rows.length
										? rows
										: html`<tr><td colspan="5" style="color:rgba(255,255,255,0.25);text-align:center;padding:2em 0;">No cookies stored</td></tr>`;
								})}
              </tbody>
            </table>`
			)}
    </div>
  `;
}

// ── Games ────────────────────────────────────────────────────────────────────
const GAMES = [
	{ name: "1v1.lol", url: "https://1v1.lol", icon: "🎮" },
	{ name: "Slope", url: "https://slope.io", icon: "⛷" },
	{ name: "Retro Bowl", url: "https://retrobowl.me", icon: "🏈" },
	{ name: "Cookie Clicker", url: "https://orteil.dashnet.org/cookieclicker/", icon: "🍪" },
	{ name: "Krunker.io", url: "https://krunker.io", icon: "🎯" },
	{ name: "Shell Shockers", url: "https://shellshock.io", icon: "🥚" },
	{ name: "Bloxd.io", url: "https://bloxd.io", icon: "🧱" },
	{ name: "Paper.io 2", url: "https://paper-io.com", icon: "📄" },
	{ name: "Smash Karts", url: "https://smashkarts.io", icon: "🚗" },
	{ name: "Minecraft Classic", url: "https://classic.minecraft.net", icon: "⛏" },
	{ name: "Tetris", url: "https://tetris.com/play-tetris", icon: "🟦" },
	{ name: "2048", url: "https://play2048.co", icon: "🔢" },
	{ name: "Flappy Bird", url: "https://flappybird.io", icon: "🐦" },
	{ name: "Minesweeper", url: "https://minesweeper.online", icon: "💣" },
	{ name: "Agar.io", url: "https://agar.io", icon: "🫧" },
	{ name: "Slither.io", url: "https://slither.io", icon: "🐍" },
	{ name: "Wordle", url: "https://www.nytimes.com/games/wordle/index.html", icon: "🟩" },
	{ name: "Chess.com", url: "https://chess.com", icon: "♟" },
	{ name: "Skribbl.io", url: "https://skribbl.io", icon: "✏️" },
	{ name: "Geoguessr", url: "https://www.geoguessr.com", icon: "🌍" },
];

function Games({ onPlay }) {
	this.css = `
    padding: 1.25em;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
    animation: slideUp 0.25s ease;
    .panel-title {
      font-size: 1rem;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      margin-bottom: 1em;
    }
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 0.75em;
    }
    .game-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4em;
      padding: 1em 0.5em;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 1em;
      color: #fff;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s, transform 0.12s;
    }
    .game-card:hover {
      background: rgba(76,139,245,0.15);
      border-color: rgba(76,139,245,0.4);
      transform: translateY(-2px);
    }
    .game-icon { font-size: 1.75rem; line-height: 1; }
    .game-name {
      color: rgba(255,255,255,0.75);
      font-size: 0.76rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  `;

	return html`
    <div>
      <div class="panel-title">🎮 Games</div>
      <div class="games-grid">
        ${GAMES.map(
					(game) => html`
          <button class="game-card" on:click=${() => onPlay(game.url)}>
            <span class="game-icon">${game.icon}</span>
            <span class="game-name">${game.name}</span>
          </button>
        `
				)}
      </div>
    </div>
  `;
}

// ── Desktop Home Screen ─────────────────────────────────────────────────────
const QUICK_LINKS = [
	{ name: "Google", url: "https://google.com", icon: "🔍", color: "#4285f4" },
	{ name: "YouTube", url: "https://youtube.com", icon: "▶", color: "#ff0000" },
	{ name: "Discord", url: "https://discord.com", icon: "💬", color: "#5865f2" },
	{ name: "Reddit", url: "https://reddit.com", icon: "🤖", color: "#ff4500" },
	{ name: "Twitter / X", url: "https://x.com", icon: "𝕏", color: "#e7e7e7" },
	{ name: "Spotify", url: "https://spotify.com", icon: "🎵", color: "#1db954" },
];

function HomeScreen({ onNavigate }) {
	this.searchVal = "";

	const handleSearch = () => {
		const q = this.searchVal.trim();
		if (!q) return;
		const url = q.startsWith("http") ? q : "https://" + q;
		onNavigate(url);
	};

	this.css = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 0;
    padding-bottom: 4em;
    animation: slideUp 0.35s ease;

    .clock-block {
      text-align: center;
      margin-bottom: 2.5em;
    }
    .big-time {
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 200;
      letter-spacing: -0.02em;
      color: rgba(255,255,255,0.92);
      line-height: 1;
    }
    .big-date {
      font-size: clamp(0.85rem, 2vw, 1.05rem);
      color: rgba(255,255,255,0.4);
      margin-top: 0.35em;
      font-weight: 400;
    }

    .search-wrap {
      position: relative;
      width: clamp(280px, 50vw, 560px);
      margin-bottom: 2em;
    }
    .search-icon {
      position: absolute;
      left: 0.9em;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.95rem;
      color: rgba(255,255,255,0.4);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 2em;
      color: #fff;
      outline: none;
      padding: 0.7em 1em 0.7em 2.5em;
      font-size: 0.95rem;
      transition: border-color 0.15s, background 0.15s;
    }
    .search-input::placeholder { color: rgba(255,255,255,0.3); }
    .search-input:focus {
      border-color: rgba(76,139,245,0.6);
      background: rgba(255,255,255,0.1);
    }

    .quick-links {
      display: flex;
      gap: 0.85em;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 560px;
    }
    .quick-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35em;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.9em;
      padding: 0.7em 1em;
      cursor: pointer;
      min-width: 72px;
      transition: background 0.14s, transform 0.12s;
      color: #fff;
    }
    .quick-link:hover {
      background: rgba(255,255,255,0.1);
      transform: translateY(-2px);
    }
    .quick-link-icon { font-size: 1.3rem; line-height: 1; }
    .quick-link-name { font-size: 0.7rem; color: rgba(255,255,255,0.55); }
  `;

	this._time = "";
	this._date = "";

	this.mount = () => {
		const tick = () => {
			const now = new Date();
			this._time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			this._date = now.toLocaleDateString([], {
				weekday: "long",
				month: "long",
				day: "numeric",
			});
		};
		tick();
		const id = setInterval(tick, 1000);
		this.unmount = () => clearInterval(id);
	};

	return html`
    <div>
      <!-- Clock -->
      <div class="clock-block">
        <div class="big-time">${use(this._time)}</div>
        <div class="big-date">${use(this._date)}</div>
      </div>

      <!-- Search bar -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          placeholder="Search or enter a URL…"
          autocomplete="off" autocapitalize="off" autocorrect="off"
          bind:value=${use(this.searchVal)}
          on:input=${(e) => { this.searchVal = e.target.value; }}
          on:keyup=${(e) => e.key === "Enter" && handleSearch()}
        />
      </div>

      <!-- Quick links -->
      <div class="quick-links">
        ${QUICK_LINKS.map(
					(link) => html`
          <button class="quick-link" on:click=${() => onNavigate(link.url)}>
            <span class="quick-link-icon">${link.icon}</span>
            <span class="quick-link-name">${link.name}</span>
          </button>
        `
				)}
      </div>

      <!-- Version watermark -->
      <div style="margin-top:2.5em;font-size:0.65rem;color:rgba(255,255,255,0.18);text-align:center;">
        scramjet ${$scramjetVersion.version} ·
        <a href=${"https://github.com/MercuryWorkshop/scramjet/commit/" + $scramjetVersion.build}
           style="color:rgba(255,255,255,0.18);">${$scramjetVersion.build}</a>
      </div>
    </div>
  `;
}

// ── Bottom Dock (macOS-style floating glass pill) ────────────────────────────
function Dock({ activeView, onSelect, onSettings }) {
	const DOCK_ITEMS = [
		{ id: "home",     label: "Home",     icon: "⌂" },
		{ id: "browser",  label: "Browser",  icon: "🌐" },
		{ id: "games",    label: "Games",    icon: "🎮" },
		{ id: "sessions", label: "Sessions", icon: "🍪" },
	];

	this.css = `
    /* Transparent row that reserves vertical space for the floating pill */
    position: relative;
    height: 80px;
    flex-shrink: 0;
    pointer-events: none;

    .dock-pill {
      pointer-events: all;
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: flex-end;
      gap: 4px;
      padding: 8px 12px 6px;
      background: rgba(18, 18, 34, 0.55);
      backdrop-filter: saturate(180%) blur(24px);
      -webkit-backdrop-filter: saturate(180%) blur(24px);
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 22px;
      box-shadow:
        0 12px 40px rgba(0,0,0,0.55),
        0 3px 10px rgba(0,0,0,0.35),
        inset 0 1px 0 rgba(255,255,255,0.08);
      white-space: nowrap;
    }

    /* Individual icon button – macOS grow-from-bottom on hover */
    .di {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: none;
      border: none;
      padding: 0 2px;
      cursor: pointer;
      transform-origin: bottom center;
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .di:hover { transform: translateY(-12px) scale(1.35); }

    /* Rounded-square icon face */
    .di-face {
      width: 46px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.55rem;
      border-radius: 13px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.09);
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      transition: background 0.15s, border-color 0.15s;
    }
    .di.active .di-face {
      background: rgba(76,139,245,0.22);
      border-color: rgba(76,139,245,0.5);
      box-shadow: 0 0 0 1px rgba(76,139,245,0.3), 0 2px 8px rgba(76,139,245,0.2);
    }

    /* Active dot below icon */
    .di-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      margin-top: 3px;
      background: rgba(255,255,255,0.6);
    }
    .di-dot-empty { height: 7px; }

    /* Hover label tooltip */
    .di-label {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: rgba(15,15,28,0.88);
      backdrop-filter: blur(8px);
      color: rgba(255,255,255,0.9);
      font-size: 0.68rem;
      font-weight: 500;
      padding: 3px 9px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.1);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s, transform 0.12s;
    }
    .di:hover .di-label {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Separator */
    .dock-sep {
      width: 1px;
      height: 34px;
      background: rgba(255,255,255,0.12);
      align-self: center;
      margin: 0 5px;
    }

    /* Settings icon button */
    .di-settings {
      position: relative;
      display: flex;
      align-items: center;
      background: none;
      border: none;
      padding: 0 2px;
      cursor: pointer;
      transform-origin: bottom center;
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .di-settings:hover { transform: translateY(-12px) scale(1.35); }
    .di-settings .di-face {
      width: 46px;
      height: 46px;
      font-size: 1.2rem;
      border-radius: 13px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .di-settings:hover .di-face { background: rgba(255,255,255,0.1); }
    .di-settings .di-label {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: rgba(15,15,28,0.88);
      backdrop-filter: blur(8px);
      color: rgba(255,255,255,0.9);
      font-size: 0.68rem;
      font-weight: 500;
      padding: 3px 9px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.1);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s, transform 0.12s;
    }
    .di-settings:hover .di-label {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;

	return html`
    <div>
      <div class="dock-pill">
        ${DOCK_ITEMS.map(
					(item) => html`
          <button
            class=${use(activeView, (v) => "di" + (v === item.id ? " active" : ""))}
            on:click=${() => onSelect(item.id)}
          >
            <span class="di-label">${item.label}</span>
            <div class="di-face">${item.icon}</div>
            ${use(activeView, (v) =>
							v === item.id
								? html`<div class="di-dot"></div>`
								: html`<div class="di-dot-empty"></div>`
						)}
          </button>
        `
				)}

        <div class="dock-sep"></div>

        <button class="di-settings" on:click=${onSettings}>
          <span class="di-label">Settings</span>
          <div class="di-face">⚙</div>
        </button>
      </div>
    </div>
  `;
}

// ── Browser navbar ───────────────────────────────────────────────────────────
function BrowserNav({ url, onBack, onForward, onReload, onNavigate, onNewTab }) {
	this.inputUrl = url;

	const handleSubmit = () => {
		let u = this.inputUrl.trim();
		if (!u) return;
		if (!u.startsWith("http")) u = "https://" + u;
		onNavigate(u);
	};

	this.css = `
    display: flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.4em 0.6em;
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    z-index: 10;

    .nav-btn {
      color: rgba(255,255,255,0.65);
      border: none;
      border-radius: 0.35em;
      background: transparent;
      padding: 0.25em 0.45em;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.12s, color 0.12s;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

    .url-bar {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.5em;
      color: #fff;
      outline: none;
      padding: 0.3em 0.65em;
      font-size: 0.85rem;
      min-width: 0;
      transition: border-color 0.15s, background 0.15s;
    }
    .url-bar:focus {
      border-color: rgba(76,139,245,0.5);
      background: rgba(255,255,255,0.09);
    }
  `;

	return html`
    <div>
      <button class="nav-btn" on:click=${onBack} title="Back">‹</button>
      <button class="nav-btn" on:click=${onForward} title="Forward">›</button>
      <button class="nav-btn" on:click=${onReload} title="Reload">↻</button>

      <input
        class="url-bar"
        autocomplete="off" autocapitalize="off" autocorrect="off"
        bind:value=${use(url)}
        on:input=${(e) => { this.inputUrl = e.target.value; }}
        on:keyup=${(e) => {
					if (e.key === "Enter") {
						this.inputUrl = e.target.value;
						onNavigate(this.inputUrl);
					}
				}}
      />

      <button class="nav-btn" on:click=${() => onNewTab()} title="Open in new tab">↗</button>
    </div>
  `;
}

// ── Main OS App ─────────────────────────────────────────────────────────────
function OSApp() {
	// "home" | "browser" | "games" | "sessions"
	this.activeView = "home";
	this.browserUrl = store.url || "https://google.com";

	this.css = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    color: #e0def4;

    .main-area {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .panel {
      flex: 1;
      overflow: hidden;
      background: rgba(255,255,255,0.02);
    }

    iframe {
      border: none;
      width: 100%;
      height: 100%;
      display: block;
      background: #fff;
    }
  `;

	const frame = scramjet.createFrame();

	this.mount = () => {
		// Show a nice welcome screen inside the frame
		const body = btoa(
			`<body style="background:#050510;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;opacity:0.45;">
          <div style="font-size:2.5rem;font-weight:200;margin-bottom:0.5rem;">🌐</div>
          <div style="font-size:0.9rem;">Open the browser from the dock below</div>
        </div>
      </body>`
		);
		frame.go(`data:text/html;base64,${body}`);
	};

	frame.addEventListener("urlchange", (e) => {
		if (!e.url) return;
		this.browserUrl = e.url;
		store.url = e.url;
	});

	const navigateTo = (url) => {
		let u = url.trim();
		if (!u.startsWith("http")) u = "https://" + u;
		this.browserUrl = u;
		store.url = u;
		this.activeView = "browser";
		frame.go(u);
	};

	const cfg = h(Config);
	document.body.appendChild(cfg);

	return html`
    <div>
      <!-- Main content area -->
      <div class="main-area">
        ${use(this.activeView, (view) => {
					if (view === "home") {
						return html`${h(HomeScreen, { onNavigate: navigateTo })}`;
					}

					if (view === "browser") {
						return html`
              <div style="display:flex;flex-direction:column;height:100%;">
                ${h(BrowserNav, {
									url: use(this.browserUrl),
									onBack: () => frame.back(),
									onForward: () => frame.forward(),
									onReload: () => frame.reload(),
									onNavigate: navigateTo,
									onNewTab: () => window.open(scramjet.encodeUrl(this.browserUrl)),
								})}
                <div style="flex:1;overflow:hidden;">${frame.frame}</div>
              </div>
            `;
					}

					if (view === "games") {
						return html`
              <div class="panel">
                ${h(Games, { onPlay: (url) => navigateTo(url) })}
              </div>
            `;
					}

					if (view === "sessions") {
						return html`
              <div class="panel">
                ${h(SessionManager)}
              </div>
            `;
					}
				})}
      </div>

      <!-- Floating macOS-style dock -->
      ${h(Dock, {
				activeView: use(this.activeView),
				onSelect: (id) => { this.activeView = id; },
				onSettings: () => cfg.showModal(),
			})}
    </div>
  `;
}

window.addEventListener("load", async () => {
	const root = document.getElementById("app");
	try {
		root.replaceWith(h(OSApp));
	} catch (e) {
		root.replaceWith(document.createTextNode("" + e));
		throw e;
	}
	function b64(buffer) {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}
	const arraybuffer = await (await fetch("/assets/scramjet.png")).arrayBuffer();
	console.log(
		"%cb",
		`
      background-image: url(data:image/png;base64,${b64(arraybuffer)});
      color: transparent;
      padding-left: 200px;
      padding-bottom: 100px;
      background-size: contain;
      background-position: center center;
      background-repeat: no-repeat;
  `
	);
});

