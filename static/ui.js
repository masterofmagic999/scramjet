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
		sourcemaps: true,
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const flex = css`
	display: flex;
`;
const col = css`
	flex-direction: column;
`;

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

/** True when the server has Appwrite cloud sync enabled. */
let _cloudEnabled = null; // null = not yet checked

async function checkCloudStatus() {
	if (_cloudEnabled !== null) return _cloudEnabled;
	try {
		const res = await fetch("/api/cloud-status");
		const data = await res.json();
		_cloudEnabled = !!data.appwrite;
	} catch {
		_cloudEnabled = false;
	}
	return _cloudEnabled;
}

async function fetchCookies() {
	try {
		const res = await fetch("/api/cookies");
		return await res.json();
	} catch {
		return {};
	}
}

async function deleteCookie(domain, name) {
	await fetch(`/api/cookies/${encodeURIComponent(domain)}/${encodeURIComponent(name)}`, {
		method: "DELETE",
	});
}

async function clearAllCookies() {
	await fetch("/api/cookies", { method: "DELETE" });
}

// ── Panic / one-click clear ─────────────────────────────────────────────────
async function panic() {
	await clearAllCookies();
	// Clear browser-side storage too
	localStorage.clear();
	sessionStorage.clear();
	if ("caches" in self) {
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	}
	// Unregister service worker so state is truly fresh
	const regs = await navigator.serviceWorker.getRegistrations();
	await Promise.all(regs.map((r) => r.unregister()));
	location.reload();
}

// ── Cloud Sync panel ─────────────────────────────────────────────────────────
function AccountPanel() {
	this.cloudEnabled = null; // null = checking, true = on, false = off

	this.mount = async () => {
		this.cloudEnabled = await checkCloudStatus();
	};

	this.css = `
    overflow-y: auto;
    height: 100%;
    padding: 1.25em;
    box-sizing: border-box;
    .acct-card {
      max-width: 380px;
      margin: 2em auto;
      background: rgba(14, 9, 30, 0.7);
      border: 1px solid rgba(139,92,246,0.22);
      border-radius: 18px;
      padding: 1.75em;
      backdrop-filter: saturate(180%) blur(28px);
      -webkit-backdrop-filter: saturate(180%) blur(28px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.35),
                  inset 0 1px 0 rgba(255,255,255,0.07);
    }
    .acct-title {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 1.1em;
      background: linear-gradient(90deg, #c4b5fd, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.01em;
    }
    .acct-info {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.45);
      word-break: break-all;
      margin-bottom: 0.9em;
      line-height: 1.5;
    }
    .acct-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 2em;
      padding: 0.35em 0.9em;
      margin-bottom: 1em;
    }
    .acct-badge.on {
      background: rgba(34,197,94,0.15);
      border: 1px solid rgba(34,197,94,0.35);
      color: #4ade80;
    }
    .acct-badge.off {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.4);
    }
    .acct-code {
      font-family: monospace;
      font-size: 0.78rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.45em;
      padding: 0.65em 0.9em;
      color: rgba(196,181,253,0.8);
      margin-bottom: 0.6em;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `;

	return html`
    <div>
      <div class="acct-card">
        <div class="acct-title">☁️ Cloud Sync</div>
        ${use(this.cloudEnabled, (enabled) => {
					if (enabled === null) {
						return html`<div class="acct-info">Checking…</div>`;
					}
					if (enabled) {
						return html`
              <div>
                <div class="acct-badge on">● Appwrite sync enabled</div>
                <div class="acct-info">
                  Your cookies are saved to Appwrite and will survive Codespace restarts.
                  No action needed — sync happens automatically in the background.
                </div>
              </div>
            `;
					}
					return html`
            <div>
              <div class="acct-badge off">○ Local storage only</div>
              <div class="acct-info">
                Cookies are stored in a local file inside the Codespace. They may be
                lost when the Codespace is deleted or rebuilt.
              </div>
              <div class="acct-info">
                To enable Appwrite cloud sync, add these to your <strong>.env</strong> file
                and restart the server:
              </div>
              <div class="acct-code">APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=&lt;your-project-id&gt;
APPWRITE_API_KEY=&lt;your-api-key&gt;</div>
              <div class="acct-info" style="font-size:0.76rem;">
                See the Codespaces guide in the repository for step-by-step instructions.
              </div>
            </div>
          `;
				})}
      </div>
    </div>
  `;
}

// ── Config dialog ────────────────────────────────────────────────────────────
function Config() {
	this.css = `
    transition: opacity 0.4s ease;
    :modal[open] {
        animation: fade 0.4s ease normal;
    }
    :modal::backdrop {
     backdrop-filter: blur(8px);
    }
    .buttons {
      gap: 0.5em;
    }
    .buttons button {
      border: 1px solid rgba(76,139,245,0.5);
      background: rgba(255,255,255,0.07);
      backdrop-filter: blur(12px);
      border-radius: 0.75em;
      color: #fff;
      padding: 0.45em 0.9em;
      cursor: pointer;
    }
    .buttons button:hover {
      background: rgba(76,139,245,0.18);
    }
    .input_row input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 0.75em;
      color: #fff;
      outline: none;
      padding: 0.45em 0.7em;
      width: 100%;
      box-sizing: border-box;
    }
    .input_row {
      margin-bottom: 0.5em;
      margin-top: 0.5em;
    }
    .centered {
      justify-content: center;
      align-items: center;
    }
  `;

	function handleModalClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 250);
	}

	return html`
      <dialog class="cfg" style="background: rgba(18,18,28,0.85); backdrop-filter: blur(20px); color: white; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); padding: 1.5em; min-width: 320px;">
        <div style="align-self: end">
          <div class=${[flex, "buttons"]}>
            <button on:click=${() => {
							connection.setTransport("/baremod/index.mjs", [store.bareurl]);
							store.transport = "/baremod/index.mjs";
						}}>bare server 3</button>
            <button on:click=${() => {
							connection.setTransport("/libcurl/index.mjs", [
								{ wisp: store.wispurl },
							]);
							store.transport = "/libcurl/index.mjs";
						}}>libcurl.js</button>
            <button on:click=${() => {
								connection.setTransport("/epoxy/index.mjs", [
									{ wisp: store.wispurl },
								]);
								store.transport = "/epoxy/index.mjs";
							}}>epoxy</button>
          </div>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="wisp_url_input" style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.25em;">Wisp URL</label>
          <input id="wisp_url_input" bind:value=${use(store.wispurl)} spellcheck="false"></input>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="bare_url_input" style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.25em;">Bare URL</label>
          <input id="bare_url_input" bind:value=${use(store.bareurl)} spellcheck="false"></input>
        </div>
        <div style="font-size:0.7rem;color:rgba(255,255,255,0.35);margin-top:0.3em;">${use(store.transport)}</div>
        <div class=${[flex, "buttons", "centered"]} style="margin-top:1em;">
          <button on:click=${() => handleModalClose(this.root)}>close</button>
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
    padding: 1.25em 1.5em;
    box-sizing: border-box;
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      background: rgba(255,255,255,0.02);
      border-radius: 10px;
      overflow: hidden;
    }
    th {
      text-align: left;
      color: rgba(167,139,250,0.7);
      font-weight: 600;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0.45em 0.65em;
      border-bottom: 1px solid rgba(139,92,246,0.15);
      background: rgba(124,58,237,0.06);
    }
    td {
      padding: 0.4em 0.65em;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      word-break: break-all;
      color: rgba(255,255,255,0.7);
      transition: background 0.1s;
    }
    tr:hover td { background: rgba(124,58,237,0.06); }
    .del-btn {
      background: rgba(220,50,50,0.12);
      border: 1px solid rgba(220,50,50,0.3);
      color: #f87171;
      border-radius: 0.4em;
      padding: 0.18em 0.6em;
      cursor: pointer;
      font-size: 0.78rem;
      transition: background 0.12s, border-color 0.12s;
    }
    .del-btn:hover { background: rgba(220,50,50,0.28); border-color: rgba(248,113,113,0.45); }
    .clear-btn {
      background: rgba(220,50,50,0.1);
      border: 1px solid rgba(220,50,50,0.28);
      color: #f87171;
      border-radius: 0.65em;
      padding: 0.38em 1em;
      cursor: pointer;
      font-size: 0.82rem;
      margin-bottom: 0.75em;
      font-weight: 500;
      transition: background 0.12s, box-shadow 0.12s, transform 0.1s;
    }
    .clear-btn:hover { background: rgba(220,50,50,0.24); box-shadow: 0 0 12px rgba(220,50,50,0.2); transform: translateY(-1px); }
    .refresh-btn {
      background: rgba(124,58,237,0.1);
      border: 1px solid rgba(139,92,246,0.28);
      color: #c4b5fd;
      border-radius: 0.65em;
      padding: 0.38em 1em;
      cursor: pointer;
      font-size: 0.82rem;
      margin-bottom: 0.75em;
      margin-left: 0.5em;
      font-weight: 500;
      transition: background 0.12s, box-shadow 0.12s, transform 0.1s;
    }
    .refresh-btn:hover { background: rgba(124,58,237,0.24); box-shadow: 0 0 12px rgba(124,58,237,0.2); transform: translateY(-1px); }
  `;

	return html`
    <div>
      <div style="display:flex;align-items:center;gap:0.5em;margin-bottom:0.5em;">
        <span style="font-size:0.95rem;font-weight:600;color:rgba(255,255,255,0.85);">Session Cookies</span>
        <button class="refresh-btn" on:click=${refresh}>↻ Refresh</button>
        <button class="clear-btn" on:click=${handleClearAll}>🗑 Clear All</button>
      </div>
      ${use(this.loading, (loading) =>
				loading
					? html`<div style="color:rgba(255,255,255,0.35);font-size:0.85rem;">Loading…</div>`
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
                          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${meta.value}</td>
                          <td>${meta.path ?? "/"}</td>
                          <td><button class="del-btn" on:click=${() => handleDelete(domain, name)}>✕</button></td>
                        </tr>`
											);
										}
									}
									return rows.length
										? rows
										: html`<tr><td colspan="5" style="color:rgba(255,255,255,0.3);text-align:center;padding:1em;">No cookies stored</td></tr>`;
								})}
              </tbody>
            </table>`
			)}
    </div>
  `;
}

// ── Main browser app ─────────────────────────────────────────────────────────
function BrowserApp() {
	this.css = `
    width: 100%;
    height: 100%;
    color: #e0def4;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

    a { color: #e0def4; }
    input, button { font-family: inherit; }

    .navbar {
      display: flex;
      align-items: center;
      gap: 0.35em;
      padding: 0.5em 0.75em;
      background: rgba(8, 5, 18, 0.7);
      backdrop-filter: saturate(180%) blur(24px);
      -webkit-backdrop-filter: saturate(180%) blur(24px);
      border-bottom: 1px solid rgba(139,92,246,0.15);
      box-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4);
    }

    .nav-btn {
      color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.45em;
      background: rgba(255,255,255,0.05);
      padding: 0.28em 0.6em;
      cursor: pointer;
      font-size: 0.82rem;
      white-space: nowrap;
      transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.1s;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18); color: #fff; transform: translateY(-1px); }
    .nav-btn.panic {
      border-color: rgba(220,50,50,0.38);
      background: rgba(220,50,50,0.1);
      color: #f87171;
    }
    .nav-btn.panic:hover { background: rgba(220,50,50,0.22); border-color: rgba(248,113,113,0.45); box-shadow: 0 0 10px rgba(220,50,50,0.2); }
    .nav-btn.active-tab {
      border-color: rgba(139,92,246,0.55);
      background: rgba(124,58,237,0.18);
      color: #c4b5fd;
      box-shadow: 0 0 10px rgba(124,58,237,0.2);
    }

    input.bar {
      flex: 1;
      padding: 0.3em 0.7em;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.45em;
      outline: none;
      color: #fff;
      background: rgba(255,255,255,0.06);
      font-size: 0.88rem;
      min-width: 0;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    input.bar:focus {
      border-color: rgba(139,92,246,0.55);
      background: rgba(255,255,255,0.09);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
    }

    .tab-content {
      flex: 1;
      overflow: hidden;
    }

    iframe {
      background-color: #fff;
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }

    .version {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.25);
      white-space: nowrap;
    }
    .version a { color: rgba(255,255,255,0.25); }

    .session-panel {
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.01);
    }
  `;

	this.url = store.url;
	this.activeTab = "browser"; // "browser" | "sessions" | "account"

	const frame = scramjet.createFrame();

	this.mount = () => {
		const body = btoa(
			`<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center"><h2>Welcome to <i>Parastar</i></h2><p>Type a URL in the bar above and press Enter.</p></div>
      </body>`
		);
		frame.go(`data:text/html;base64,${body}`);
	};

	frame.addEventListener("urlchange", (e) => {
		if (!e.url) return;
		this.url = e.url;
	});

	const handleSubmit = () => {
		this.url = this.url.trim();
		if (!this.url.startsWith("http")) {
			this.url = "https://" + this.url;
		}
		this.activeTab = "browser";
		return frame.go(this.url);
	};

	const cfg = h(Config);
	document.body.appendChild(cfg);
	this.githubURL = `https://github.com/MercuryWorkshop/scramjet/commit/${$scramjetVersion.build}`;

	return html`
    <div>
      <!-- Navigation bar -->
      <div class="navbar">
        <button class="nav-btn" on:click=${() => cfg.showModal()}>⚙</button>
        <button class="nav-btn" on:click=${() => frame.back()}>‹</button>
        <button class="nav-btn" on:click=${() => frame.forward()}>›</button>
        <button class="nav-btn" on:click=${() => frame.reload()}>↻</button>

        <input class="bar"
          autocomplete="off" autocapitalize="off" autocorrect="off"
          bind:value=${use(this.url)}
          on:input=${(e) => { this.url = e.target.value; }}
          on:keyup=${(e) => e.key === "Enter" && (store.url = this.url) && handleSubmit()}
        />

        <button class="nav-btn" on:click=${() => window.open(scramjet.encodeUrl(this.url))}>↗</button>

        <!-- Tab switcher -->
        <button
          class=${use(this.activeTab, (t) => "nav-btn" + (t === "sessions" ? " active-tab" : ""))}
          on:click=${() => { this.activeTab = this.activeTab === "sessions" ? "browser" : "sessions"; }}
        >🍪 Sessions</button>

        <button
          class=${use(this.activeTab, (t) => "nav-btn" + (t === "account" ? " active-tab" : ""))}
          on:click=${() => { this.activeTab = this.activeTab === "account" ? "browser" : "account"; }}
        >👤 Account</button>

        <!-- Panic button -->
        <button class="nav-btn panic" on:click=${panic} title="Clear all cookies, cache, and storage">🗑 Panic</button>

        <span class="version">
          <b>Parastar</b> ${$scramjetVersion.version}
          <a href=${use(this.githubURL)}>${$scramjetVersion.build}</a>
        </span>
      </div>

      <!-- Tab content -->
      <div class="tab-content">
        ${use(this.activeTab, (tab) => {
					if (tab === "sessions") return html`<div class="session-panel">${h(SessionManager)}</div>`;
					if (tab === "account") return html`<div class="session-panel">${h(AccountPanel)}</div>`;
					return frame.frame;
				})}
      </div>
    </div>
  `;
}


// ── Quick link icon data ─────────────────────────────────────────────────────
const QUICK_LINKS = [
{ name: "Google", url: "https://google.com", letter: "G", grad: "linear-gradient(135deg,#4285f4,#34a3e6)" },
{ name: "YouTube", url: "https://youtube.com", letter: "▶", grad: "linear-gradient(135deg,#ff0000,#cc0000)" },
{ name: "Discord", url: "https://discord.com", letter: "D", grad: "linear-gradient(135deg,#5865f2,#4752c4)" },
{ name: "Reddit", url: "https://reddit.com", letter: "R", grad: "linear-gradient(135deg,#ff4500,#e03d00)" },
{ name: "X", url: "https://x.com", letter: "𝕏", grad: "linear-gradient(135deg,#18181b,#3f3f46)" },
{ name: "Spotify", url: "https://spotify.com", letter: "♪", grad: "linear-gradient(135deg,#1db954,#158a3e)" },
{ name: "GitHub", url: "https://github.com", letter: "⌨", grad: "linear-gradient(135deg,#24292e,#3d444d)" },
{ name: "Wikipedia", url: "https://wikipedia.org", letter: "W", grad: "linear-gradient(135deg,#374151,#1f2937)" },
];

// ── Games ────────────────────────────────────────────────────────────────────
const GAMES = [
{ name: "1v1.lol", url: "https://1v1.lol", icon: "🎮", color: "#ef4444" },
{ name: "Slope", url: "https://slope.io", icon: "⛷", color: "#8b5cf6" },
{ name: "Krunker.io", url: "https://krunker.io", icon: "🎯", color: "#f97316" },
{ name: "Retro Bowl", url: "https://retrobowl.me", icon: "🏈", color: "#10b981" },
{ name: "Shell Shockers", url: "https://shellshock.io", icon: "🥚", color: "#eab308" },
{ name: "Cookie Clicker", url: "https://orteil.dashnet.org/cookieclicker/", icon: "🍪", color: "#f59e0b" },
{ name: "Bloxd.io", url: "https://bloxd.io", icon: "🧱", color: "#06b6d4" },
{ name: "Paper.io 2", url: "https://paper-io.com", icon: "📄", color: "#6366f1" },
{ name: "Smash Karts", url: "https://smashkarts.io", icon: "🚗", color: "#ec4899" },
{ name: "Minecraft", url: "https://classic.minecraft.net", icon: "⛏", color: "#84cc16" },
{ name: "Tetris", url: "https://tetris.com/play-tetris", icon: "🟦", color: "#3b82f6" },
{ name: "2048", url: "https://play2048.co", icon: "🔢", color: "#f97316" },
{ name: "Flappy Bird", url: "https://flappybird.io", icon: "🐦", color: "#22c55e" },
{ name: "Minesweeper", url: "https://minesweeper.online", icon: "💣", color: "#a78bfa" },
{ name: "Agar.io", url: "https://agar.io", icon: "🫧", color: "#14b8a6" },
{ name: "Slither.io", url: "https://slither.io", icon: "🐍", color: "#4ade80" },
{ name: "Wordle", url: "https://www.nytimes.com/games/wordle/index.html", icon: "🟩", color: "#6ee7b7" },
{ name: "Chess.com", url: "https://chess.com", icon: "♟", color: "#94a3b8" },
{ name: "Skribbl.io", url: "https://skribbl.io", icon: "✏️", color: "#fb923c" },
{ name: "Geoguessr", url: "https://www.geoguessr.com", icon: "🌍", color: "#34d399" },
];

// ── Games panel ───────────────────────────────────────────────────────────────
function GamesPanel() {
this.query = "";

this.css = `
    padding: 1.5em 1.75em; overflow-y: auto; height: 100%; box-sizing: border-box;
    animation: slideUp 0.25s ease;
    .games-header { display:flex; align-items:center; gap:0.75em; margin-bottom:1.25em; }
    .games-title {
      font-size: 1.15rem; font-weight:800; letter-spacing:-0.03em; flex:1;
      background: linear-gradient(90deg, #c4b5fd 0%, #a78bfa 50%, #818cf8 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .games-search {
      background: rgba(14,9,30,0.6); border:1px solid rgba(139,92,246,0.2);
      border-radius: 2em; color:#fff; outline:none; padding: 0.38em 1em;
      font-size: 0.82rem; width: 200px;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .games-search::placeholder { color: rgba(255,255,255,0.28); }
    .games-search:focus {
      border-color: rgba(139,92,246,0.6);
      background: rgba(20,12,40,0.75);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.15), 0 0 16px rgba(124,58,237,0.1);
    }
    .featured-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.85em; margin-bottom: 1.35em; }
    .featured-card {
      position: relative; border-radius: 16px; padding: 1.35em 1.1em; cursor: pointer;
      overflow: hidden; display: flex; flex-direction:column; justify-content:flex-end;
      min-height: 115px; border: 1px solid rgba(255,255,255,0.1);
      transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    }
    .featured-card:hover {
      transform: translateY(-5px) scale(1.02);
      box-shadow: 0 18px 48px rgba(0,0,0,0.6), 0 0 30px rgba(124,58,237,0.15);
      border-color: rgba(255,255,255,0.16);
    }
    .featured-card::before {
      content:""; position:absolute; inset:0;
      background: linear-gradient(160deg, rgba(255,255,255,0.1) 0%, transparent 55%); z-index:1;
    }
    .featured-card::after {
      content:""; position:absolute; inset:0; z-index:0;
      background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%);
    }
    .fc-badge {
      position:absolute; top:0.7em; left:0.8em; z-index:2; font-size:0.58rem; font-weight:700;
      text-transform:uppercase; letter-spacing:0.12em; color: rgba(255,255,255,0.75);
      background: rgba(0,0,0,0.35); padding:2px 8px; border-radius:1em;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .fc-icon { font-size:2.4rem; line-height:1; z-index:2; margin-bottom:0.3em; }
    .fc-name { font-size:0.9rem; font-weight:700; color:#fff; z-index:2; text-shadow: 0 2px 6px rgba(0,0,0,0.6); }
    .games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 0.7em; }
    .game-card {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:0.4em; padding: 1em 0.5em;
      background: rgba(14,9,30,0.5);
      border:1px solid rgba(255,255,255,0.07); border-radius: 14px; cursor:pointer; text-align:center;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      transition: background 0.15s, border-color 0.15s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s;
      position:relative; overflow:hidden;
    }
    .game-card::before { content:""; position:absolute; inset:0; opacity:0; background: var(--gc, rgba(139,92,246,0.5)); transition: opacity 0.15s; border-radius: inherit; }
    .game-card:hover {
      transform: translateY(-5px) scale(1.04);
      border-color: rgba(139,92,246,0.45);
      box-shadow: 0 10px 28px rgba(0,0,0,0.45), 0 0 18px rgba(124,58,237,0.12);
    }
    .game-card:hover::before { opacity:0.14; }
    .gi { font-size:1.8rem; line-height:1; position:relative; z-index:1; }
    .gn { font-size:0.73rem; color:rgba(255,255,255,0.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; position:relative; z-index:1; }
    .section-label { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:rgba(167,139,250,0.5); margin-bottom:0.65em; font-weight:700; }
  `;

return html`
    <div>
      <div class="games-header">
        <span class="games-title">🎮 Games</span>
        <input class="games-search" placeholder="Search games…"
          bind:value=${use(this.query)}
          on:input=${(e) => { this.query = e.target.value; }}
        />
      </div>
      ${use(this.query, (q) => q.trim() ? null : html`
          <div class="section-label">Featured</div>
          <div class="featured-row">
            ${[GAMES[0], GAMES[2], GAMES[1]].map((game) => html`
              <button class="featured-card"
                style="background: linear-gradient(145deg, ${game.color}55 0%, ${game.color}22 60%, rgba(0,0,0,0.4) 100%);"
                on:click=${() => this.onPlay(game.url)}>
                <div class="fc-badge">Play now</div>
                <span class="fc-icon">${game.icon}</span>
                <span class="fc-name">${game.name}</span>
              </button>
            `)}
          </div>
          <div class="section-label" style="margin-top:0.25em;">All Games</div>
        `)}
      <div class="games-grid">
        ${use(this.query, (q) => {
const filtered = q.trim() ? GAMES.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())) : GAMES;
return filtered.map((game) => html`
            <button class="game-card" style="--gc:${game.color};" on:click=${() => this.onPlay(game.url)}>
              <span class="gi">${game.icon}</span>
              <span class="gn">${game.name}</span>
            </button>
          `);
})}
      </div>
    </div>
  `;
}

// ── Top Menu Bar ──────────────────────────────────────────────────────────────
function MenuBar() {
this._time = "";
this.mount = () => {
const tick = () => {
const now = new Date();
this._time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
tick();
const id = setInterval(tick, 1000);
this.unmount = () => clearInterval(id);
};

this.css = `
    display: flex; align-items: center; gap: 0.5em; padding: 0 1em;
    height: 30px; flex-shrink: 0;
    background: rgba(5, 3, 14, 0.78);
    backdrop-filter: saturate(200%) blur(28px); -webkit-backdrop-filter: saturate(200%) blur(28px);
    border-bottom: 1px solid rgba(139,92,246,0.12);
    box-shadow: 0 1px 0 rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04);
    z-index: 100; user-select: none;
    .mb-brand {
      font-size: 0.82rem; font-weight: 900; letter-spacing: -0.01em;
      font-family: "Nunito", "Inter", sans-serif;
      background: linear-gradient(90deg, #c4b5fd 0%, #a78bfa 60%, #818cf8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .mb-sep { color: rgba(139,92,246,0.3); font-size:0.7rem; }
    .mb-spacer { flex: 1; }
    .mb-status { display: inline-flex; align-items: center; gap: 0.3em; font-size: 0.68rem; color: rgba(255,255,255,0.38); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px rgba(74,222,128,0.8), 0 0 16px rgba(74,222,128,0.4); }
    .mb-clock { font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.7); min-width: 4.5em; text-align: right; }
    .mb-settings-btn { background: none; border: none; color: rgba(255,255,255,0.35); cursor: pointer; font-size: 0.82rem; padding: 0 0.25em; transition: color 0.12s, transform 0.15s; }
    .mb-settings-btn:hover { color: rgba(167,139,250,0.9); transform: rotate(30deg); }
  `;

return html`
    <div>
      <span class="mb-brand"><span aria-hidden="true">✦</span> Parastar</span>
      <span class="mb-sep">|</span>
      ${use(this.activeView, (v) => html`<span style="font-size:0.72rem;color:rgba(255,255,255,0.4);">${
v === "home" ? "Home" : v === "browser" ? "Browser" : v === "games" ? "Games" : v === "sessions" ? "Sessions" : "Account"
}</span>`)}
      <div class="mb-spacer"></div>
      <div class="mb-status"><div class="status-dot"></div><span>Proxy Active</span></div>
      <span class="mb-sep">|</span>
      <span class="mb-clock">${use(this._time)}</span>
      <button class="mb-settings-btn" on:click=${this.onSettings} title="Settings">⚙</button>
    </div>
  `;
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen() {
this.searchVal = "";
this._time = "";
this._date = "";

this.mount = () => {
const tick = () => {
const now = new Date();
this._time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
this._date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
};
tick();
const id = setInterval(tick, 1000);
this.unmount = () => clearInterval(id);
};

const handleSearch = () => {
const q = this.searchVal.trim();
if (!q) return;
this.onNavigate(q.startsWith("http") ? q : "https://" + q);
};

this.css = `
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    flex:1; padding-bottom:80px; animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1);
    @keyframes hsGlowPulse {
      0%, 100% { text-shadow: 0 0 60px rgba(139,92,246,0.7), 0 0 120px rgba(124,58,237,0.35), 0 0 240px rgba(124,58,237,0.12); }
      50% { text-shadow: 0 0 100px rgba(167,139,250,1), 0 0 200px rgba(124,58,237,0.65), 0 0 350px rgba(124,58,237,0.25); }
    }
    .hs-welcome {
      font-family: "Nunito", "Inter", sans-serif;
      font-size: clamp(1rem, 2.5vw, 1.35rem);
      font-weight: 600;
      color: rgba(196, 181, 253, 0.7);
      letter-spacing: 0.04em;
      margin-bottom: 0.1em;
      user-select: none;
    }
    .hs-name {
      font-family: "Nunito", "Inter", sans-serif;
      font-size: clamp(3.8rem, 10vw, 7rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1;
      color: #fff;
      text-shadow: 0 0 60px rgba(139,92,246,0.7), 0 0 120px rgba(124,58,237,0.35), 0 0 240px rgba(124,58,237,0.12);
      animation: hsGlowPulse 6s ease-in-out infinite;
      user-select: none;
      margin-bottom: 0.15em;
    }
    .hs-sub {
      font-size: clamp(0.78rem, 1.6vw, 0.9rem);
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.06em;
      margin-bottom: 2em;
      user-select: none;
    }
    .hs-card {
      background: rgba(6, 4, 18, 0.6);
      backdrop-filter: saturate(200%) blur(28px);
      -webkit-backdrop-filter: saturate(200%) blur(28px);
      border: 1px solid rgba(255,255,255,0.1);
      border-top: 1px solid rgba(255,255,255,0.18);
      border-radius: 26px;
      padding: 1.75em 2em 1.5em;
      width: min(580px, 88vw);
      box-shadow: 0 28px 72px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.35),
                  inset 0 1px 0 rgba(255,255,255,0.09), 0 0 0 1px rgba(139,92,246,0.08);
    }
    .hs-search-wrap { position: relative; width: 100%; margin-bottom: 1.6em; }
    .hs-search-icon { position:absolute; left:1.15em; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.3); pointer-events:none; font-size:0.9rem; }
    .hs-search {
      width:100%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 3em; color:#fff; outline:none;
      padding: 0.88em 1.2em 0.88em 3em; font-size: 0.97rem;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
      font-family: inherit;
    }
    .hs-search::placeholder { color: rgba(255,255,255,0.22); }
    .hs-search:focus {
      border-color: rgba(139,92,246,0.7);
      background: rgba(255,255,255,0.09);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.2), 0 0 32px rgba(124,58,237,0.15);
    }
    .hs-apps { display: flex; gap: 1.5em; flex-wrap: wrap; justify-content: center; }
    .app-icon {
      display:flex; flex-direction:column; align-items:center; gap:0.55em;
      cursor:pointer; background:none; border:none; padding:0;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    .app-icon:hover { transform: scale(1.18) translateY(-5px); }
    .app-icon:hover .app-face {
      box-shadow: 0 12px 32px rgba(0,0,0,0.6), 0 0 24px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
      border-color: rgba(255,255,255,0.2);
    }
    .app-face {
      width: 64px; height: 64px;
      border-radius: 50%;
      display:flex; align-items:center; justify-content:center;
      font-size: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.12);
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .app-name { font-size:0.68rem; color:rgba(255,255,255,0.5); white-space:nowrap; font-weight:600; letter-spacing:0.02em; }
    .hs-ver { margin-top:1.5em; font-size:0.6rem; color:rgba(255,255,255,0.1); }
    .hs-ver a { color:rgba(255,255,255,0.1); }
  `;

return html`
    <div>
      <div class="hs-welcome">Welcome to</div>
      <div class="hs-name">Parastar</div>
      <div class="hs-sub">${use(this._date)} &nbsp;·&nbsp; ${use(this._time)}</div>
      <div class="hs-card">
        <div class="hs-search-wrap">
          <span class="hs-search-icon">🔍</span>
          <input class="hs-search" placeholder="Search or enter a URL…"
            autocomplete="off" autocapitalize="off" autocorrect="off"
            bind:value=${use(this.searchVal)}
            on:input=${(e) => { this.searchVal = e.target.value; }}
            on:keyup=${(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div class="hs-apps">
          ${QUICK_LINKS.map((link) => html`
            <button class="app-icon" on:click=${() => this.onNavigate(link.url)}>
              <div class="app-face" style="background:${link.grad}">${link.letter}</div>
              <span class="app-name">${link.name}</span>
            </button>
          `)}
        </div>
      </div>
      <div class="hs-ver">
        proxy v${$scramjetVersion.version} ·
        <a href=${"https://github.com/MercuryWorkshop/scramjet/commit/" + $scramjetVersion.build}>${$scramjetVersion.build}</a>
      </div>
    </div>
  `;
}

// ── macOS-style floating glass Dock ──────────────────────────────────────────
function Dock() {
const DOCK_ITEMS = [
{ id: "home", label: "Home", icon: "⌂" },
{ id: "browser", label: "Browser", icon: "🌐" },
{ id: "games", label: "Games", icon: "🎮" },
{ id: "sessions", label: "Sessions", icon: "🍪" },
{ id: "account", label: "Account", icon: "👤" },
];

this.css = `
    position: relative; height: 90px; flex-shrink: 0; pointer-events: none;
    .dock-pill {
      pointer-events: all; position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: flex-end; gap: 6px; padding: 9px 18px 9px;
      background: rgba(6, 4, 16, 0.72);
      backdrop-filter: saturate(220%) blur(36px);
      -webkit-backdrop-filter: saturate(220%) blur(36px);
      border: 1px solid rgba(255,255,255,0.12);
      border-top: 1px solid rgba(255,255,255,0.14);
      border-bottom-color: rgba(255,255,255,0.06);
      border-radius: 28px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.75), 0 8px 20px rgba(0,0,0,0.5),
                  inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(139,92,246,0.12);
    }
    .di { position: relative; display: flex; flex-direction: column; align-items: center; background: none; border: none; padding: 0 4px; cursor: pointer; transform-origin: bottom center; transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .di:hover { transform: translateY(-18px) scale(1.45); }
    .di-face {
      width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;
      font-size: 1.7rem; border-radius: 16px;
      background: rgba(15, 9, 32, 0.7);
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .di:hover .di-face {
      background: rgba(28,16,52,0.85);
      border-color: rgba(167,139,250,0.4);
      box-shadow: 0 6px 18px rgba(0,0,0,0.55), 0 0 22px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.14);
    }
    .di.active .di-face {
      background: rgba(124,58,237,0.3);
      border-color: rgba(167,139,250,0.65);
      box-shadow: 0 0 0 1px rgba(139,92,246,0.45), 0 6px 20px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.14);
    }
    .di-dot { width: 4px; height: 4px; border-radius: 50%; margin-top: 4px; background: rgba(196,181,253,0.95); box-shadow: 0 0 7px rgba(167,139,250,1), 0 0 14px rgba(124,58,237,0.6); }
    .di-dot-empty { height: 8px; }
    .di-label {
      position: absolute; bottom: calc(100% + 16px); left: 50%; transform: translateX(-50%) translateY(6px);
      background: rgba(6,4,16,0.94); backdrop-filter: blur(14px);
      color: rgba(255,255,255,0.94); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.01em;
      padding: 4px 12px; border-radius: 9px;
      border: 1px solid rgba(139,92,246,0.28);
      box-shadow: 0 6px 20px rgba(0,0,0,0.55);
      white-space: nowrap; pointer-events: none; opacity: 0;
      transition: opacity 0.12s, transform 0.12s;
    }
    .di:hover .di-label { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;

return html`
    <div>
      <div class="dock-pill">
        ${DOCK_ITEMS.map((item) => html`
          <button
            class=${use(this.activeView, (v) => "di" + (v === item.id ? " active" : ""))}
            on:click=${() => this.onSelect(item.id)}
          >
            <span class="di-label">${item.label}</span>
            <div class="di-face">${item.icon}</div>
            ${use(this.activeView, (v) => v === item.id ? html`<div class="di-dot"></div>` : html`<div class="di-dot-empty"></div>`)}
          </button>
        `)}
      </div>
    </div>
  `;
}

// ── Browser navbar (inside OS app) ───────────────────────────────────────────
function OsBrowserNav() {
this.inputUrl = this.url || "";

const submit = () => {
let u = this.inputUrl.trim();
if (!u) return;
if (!u.startsWith("http")) u = "https://" + u;
this.onNavigate(u);
};

this.css = `
    display: flex; align-items: center; gap: 0.35em; padding: 0.5em 0.85em;
    background: rgba(6, 4, 16, 0.65);
    backdrop-filter: saturate(180%) blur(24px); -webkit-backdrop-filter: saturate(180%) blur(24px);
    border-bottom: 1px solid rgba(139,92,246,0.12);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.3);
    z-index: 10;
    .nbtn {
      color: rgba(255,255,255,0.5); border: none; background: none;
      border-radius: 0.4em; padding: 0.3em 0.55em; cursor: pointer; font-size: 0.95rem;
      transition: color 0.12s, background 0.12s, transform 0.1s;
    }
    .nbtn:hover { color: #fff; background: rgba(255,255,255,0.08); transform: scale(1.1); }
    .url-bar {
      flex: 1; min-width: 0;
      background: rgba(10, 6, 22, 0.6);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 2em; color: #fff; outline: none;
      padding: 0.34em 0.9em; font-size: 0.86rem;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .url-bar:focus {
      border-color: rgba(139,92,246,0.6);
      background: rgba(14, 9, 30, 0.75);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.15), 0 0 16px rgba(124,58,237,0.1);
    }
  `;

return html`
    <div>
      <button class="nbtn" on:click=${this.onBack} title="Back">‹</button>
      <button class="nbtn" on:click=${this.onForward} title="Forward">›</button>
      <button class="nbtn" on:click=${this.onReload} title="Reload">↻</button>
      <input class="url-bar"
        autocomplete="off" autocapitalize="off" autocorrect="off"
        bind:value=${use(this.url)}
        on:input=${(e) => { this.inputUrl = e.target.value; }}
        on:keyup=${(e) => { if (e.key === "Enter") { this.inputUrl = e.target.value; submit(); } }}
      />
      <button class="nbtn" on:click=${() => this.onNewTab()} title="Open in new tab">↗</button>
    </div>
  `;
}

// ── Main OS App (webOS desktop) ───────────────────────────────────────────────
function OSApp() {
this.activeView = "home";
this.browserUrl = store.url || "https://google.com";

this.css = `
    width: 100%; height: 100%; display: flex; flex-direction: column;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    color: #e0def4;
    .main-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; position: relative; }
    .panel {
      flex: 1; overflow: hidden;
      margin: 1em 1.25em;
      border-radius: 22px;
      background: rgba(6, 4, 18, 0.62);
      backdrop-filter: saturate(200%) blur(28px);
      -webkit-backdrop-filter: saturate(200%) blur(28px);
      border: 1px solid rgba(255,255,255,0.1);
      border-top: 1px solid rgba(255,255,255,0.16);
      box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35),
                  inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(139,92,246,0.07);
    }
    iframe { border: none; width: 100%; height: 100%; display: block; background: #fff; }
  `;

const frame = scramjet.createFrame();

this.mount = () => {
const body = btoa(
`<body style="background:#06040f;color:rgba(255,255,255,0.3);font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center">
          <div style="font-size:3rem;margin-bottom:0.5rem;opacity:0.4;">🌐</div>
          <div style="font-size:0.85rem;letter-spacing:0.02em;">Use the search bar or tap Browser in the dock</div>
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
      ${h(MenuBar, { activeView: use(this.activeView), onSettings: () => cfg.showModal() })}
      <div class="main-area">
        ${use(this.activeView, (view) => {
if (view === "home") return h(HomeScreen, { onNavigate: navigateTo });
if (view === "browser") return html`
              <div style="display:flex;flex-direction:column;height:100%;">
                ${h(OsBrowserNav, {
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
if (view === "games") return html`<div class="panel">${h(GamesPanel, { onPlay: (url) => navigateTo(url) })}</div>`;
if (view === "sessions") return html`<div class="panel">${h(SessionManager)}</div>`;
if (view === "account") return html`<div class="panel">${h(AccountPanel)}</div>`;
})}
      </div>
      ${h(Dock, { activeView: use(this.activeView), onSelect: (id) => { this.activeView = id; } })}
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
const len = bytes.byteLength;
for (let i = 0; i < len; i++) {
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
