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

// ── Auth token (Supabase session) ────────────────────────────────────────────
/** Bearer token for the current Supabase session (null = not logged in). */
let _authToken = localStorage.getItem("sj_auth_token") ?? null;

function authHeaders() {
	if (!_authToken) return {};

	return { Authorization: `Bearer ${_authToken}` };
}

// ── Session Manager helpers ─────────────────────────────────────────────────

/** Bearer token for the current Supabase session (null = not logged in). */
let _authToken = localStorage.getItem("sj_auth_token") ?? null;

function authHeaders() {
	if (!_authToken) return {};
	return { Authorization: `Bearer ${_authToken}` };
}

async function fetchCookies() {
	try {
		const res = await fetch("/api/cookies", { headers: authHeaders() });

		return await res.json();
	} catch {
		return {};
	}
}

async function deleteCookie(domain, name) {
	await fetch(
		`/api/cookies/${encodeURIComponent(domain)}/${encodeURIComponent(name)}`,
		{ method: "DELETE", headers: authHeaders() }
	);
}

async function clearAllCookies() {
	await fetch("/api/cookies", { method: "DELETE", headers: authHeaders() });
}

// ── Panic ────────────────────────────────────────────────────────────────────
async function panic() {
	await clearAllCookies();
	_authToken = null;
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

// ── Account Management (Supabase) ────────────────────────────────────────────
function AccountPanel() {
	this.view = "idle"; // "idle" | "login" | "register" | "loggedIn"
	this.email = "";
	this.password = "";
	this.error = "";
	this.userId = "";

	this.mount = async () => {
		if (!_authToken) {
			this.view = "idle";

			return;
		}
		try {
			const res = await fetch("/api/auth/me", { headers: authHeaders() });
			if (res.ok) {
				const { userId } = await res.json();
				this.userId = userId;
				this.view = "loggedIn";
			} else {
				_authToken = null;
				localStorage.removeItem("sj_auth_token");
				this.view = "idle";
			}
		} catch {
			this.view = "idle";
		}
	};

	const doLogin = async () => {
		this.error = "";
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: this.email, password: this.password }),
			});
			const data = await res.json();
			if (!res.ok) {
				this.error = data.error ?? "Login failed";

				return;
			}
			_authToken = data.accessToken;
			localStorage.setItem("sj_auth_token", _authToken);
			this.userId = data.userId;
			this.view = "loggedIn";
			this.password = "";
		} catch {
			this.error = "Network error";
		}
	};

	const doRegister = async () => {
		this.error = "";
		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: this.email, password: this.password }),
			});
			const data = await res.json();
			if (!res.ok) {
				this.error = data.error ?? "Registration failed";

				return;
			}
			if (data.accessToken) {
				_authToken = data.accessToken;
				localStorage.setItem("sj_auth_token", _authToken);
				this.userId = data.userId;
				this.view = "loggedIn";
			} else {
				this.error = "Check your email to confirm your account, then log in.";
				this.view = "idle";
			}
			this.password = "";
		} catch {
			this.error = "Network error";
		}
	};

	const doLogout = () => {
		_authToken = null;
		localStorage.removeItem("sj_auth_token");
		this.userId = "";
		this.view = "idle";
	};

	this.css = `
    overflow-y: auto; height: 100%;
    padding: 1.5em 1.75em; box-sizing: border-box;
    animation: slideUp 0.25s ease;
    .ap-title {
      font-size: 1.1rem; font-weight: 700; letter-spacing:-0.02em;
      background: linear-gradient(90deg,#c4b5fd,#818cf8);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      margin-bottom: 1.25em;
    }
    .ap-card {
      max-width: 400px; margin: 1em auto;
      background: rgba(124,58,237,0.06);
      border: 1px solid rgba(139,92,246,0.2);
      border-radius: 16px; padding: 1.5em;
    }
    .ap-desc {
      font-size: 0.82rem; color: rgba(255,255,255,0.45);
      margin-bottom: 1em; line-height: 1.55;
    }
    .ap-input {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.6em; color: #fff;
      padding: 0.45em 0.75em; font-size: 0.88rem;
      margin-bottom: 0.6em; outline: none;
      transition: border-color 0.15s;
    }
    .ap-input:focus { border-color: rgba(139,92,246,0.6); }
    .ap-btn {
      width: 100%; padding: 0.5em;
      border-radius: 0.65em;
      border: 1px solid rgba(139,92,246,0.4);
      background: rgba(124,58,237,0.15);
      color: #a78bfa; cursor: pointer; font-size: 0.88rem;
      margin-bottom: 0.4em;
      transition: background 0.13s;
    }
    .ap-btn:hover { background: rgba(124,58,237,0.28); }
    .ap-btn.danger {
      border-color: rgba(239,68,68,0.35);
      background: rgba(239,68,68,0.1); color: #f87171;
    }
    .ap-btn.danger:hover { background: rgba(239,68,68,0.22); }
    .ap-link {
      font-size: 0.78rem; color: rgba(255,255,255,0.38);
      cursor: pointer; text-decoration: underline;
      margin-top: 0.3em; display: inline-block;
    }
    .ap-error { color: #f87171; font-size: 0.8rem; margin-bottom: 0.6em; }
    .ap-info {
      font-size: 0.8rem; color: rgba(255,255,255,0.45);
      word-break: break-all; margin-bottom: 0.75em; line-height: 1.5;
    }
  `;

	return html`
		<div>
			<div class="ap-title">👤 Account</div>
			<div class="ap-card">
				${use(this.view, (view) => {
					if (view === "loggedIn") {
						return html`
							<div class="ap-info">
								Logged in — your cookies are synced to your account and will be
								available next time you log in.
							</div>
							<div
								class="ap-info"
								style="font-size:0.7rem;color:rgba(255,255,255,0.25);"
							>
								User ID: ${use(this.userId)}
							</div>
							<button class="ap-btn danger" on:click=${doLogout}>
								Log out
							</button>
						`;
					}
					if (view === "register") {
						return html`
							${use(this.error, (e) =>
								e ? html`<div class="ap-error">${e}</div>` : ""
							)}
							<input
								class="ap-input"
								type="email"
								placeholder="Email"
								bind:value=${use(this.email)}
								on:input=${(e) => {
									this.email = e.target.value;
								}}
							/>
							<input
								class="ap-input"
								type="password"
								placeholder="Password"
								bind:value=${use(this.password)}
								on:input=${(e) => {
									this.password = e.target.value;
								}}
								on:keyup=${(e) => e.key === "Enter" && doRegister()}
							/>
							<button class="ap-btn" on:click=${doRegister}>
								Create account
							</button>
							<span
								class="ap-link"
								on:click=${() => {
									this.view = "login";
									this.error = "";
								}}
								>← Back to login</span
							>
						`;
					}
					return html`
						<div class="ap-desc">
							Sign in to sync your cookies via Supabase — sessions persist
							across Codespace restarts.
						</div>
						${use(this.error, (e) =>
							e ? html`<div class="ap-error">${e}</div>` : ""
						)}
						<input
							class="ap-input"
							type="email"
							placeholder="Email"
							bind:value=${use(this.email)}
							on:input=${(e) => {
								this.email = e.target.value;
							}}
						/>
						<input
							class="ap-input"
							type="password"
							placeholder="Password"
							bind:value=${use(this.password)}
							on:input=${(e) => {
								this.password = e.target.value;
							}}
							on:keyup=${(e) => e.key === "Enter" && doLogin()}
						/>
						<button class="ap-btn" on:click=${doLogin}>Log in</button>
						<span
							class="ap-link"
							on:click=${() => {
								this.view = "register";
								this.error = "";
							}}
							>Don't have an account? Register</span
						>
					`;
				})}
			</div>
		</div>
	`;
}

// ── Settings dialog ──────────────────────────────────────────────────────────
function Config() {
	function handleModalClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 200);
	}

	this.css = `
    :modal[open] { animation: fade 0.2s ease; }
    :modal::backdrop { backdrop-filter: blur(12px); background: rgba(0,0,0,0.5); }
    .cfg-title {
      font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
      background: linear-gradient(90deg, #a78bfa, #818cf8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 1.2em;
    }
    .cfg-label {
      font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.35); margin-bottom: 0.4em; margin-top: 0.9em;
    }
    .cfg-label:first-of-type { margin-top: 0; }
    .transport-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .tbtn {
      border: 1px solid rgba(139,92,246,0.4);
      background: rgba(124,58,237,0.08);
      border-radius: 0.55em; color: #a78bfa;
      padding: 0.35em 0.85em; cursor: pointer; font-size: 0.78rem;
      transition: background 0.15s, border-color 0.15s;
    }
    .tbtn:hover { background: rgba(124,58,237,0.22); border-color: rgba(167,139,250,0.6); }
    .active-xport { font-size: 0.67rem; color: rgba(255,255,255,0.28); margin: 0.3em 0 0.6em; }
    .cfg-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.6em; color: #fff; outline: none;
      padding: 0.45em 0.75em; width: 100%; font-size: 0.82rem; margin-bottom: 0.5em;
      transition: border-color 0.15s;
    }
    .cfg-input:focus { border-color: rgba(139,92,246,0.6); }
    .cfg-actions { display: flex; gap: 0.5em; justify-content: flex-end; margin-top: 1em; }
    .btn-close {
      border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
      border-radius: 0.6em; color: rgba(255,255,255,0.8);
      padding: 0.4em 1.1em; cursor: pointer; font-size: 0.82rem;
      transition: background 0.13s;
    }
    .btn-close:hover { background: rgba(255,255,255,0.1); }
    .btn-panic {
      border: 1px solid rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);
      border-radius: 0.6em; color: #f87171;
      padding: 0.4em 1.1em; cursor: pointer; font-size: 0.82rem;
      transition: background 0.13s;
    }
    .btn-panic:hover { background: rgba(239,68,68,0.2); }
  `;

	return html`
		<dialog
			style="background:rgba(10,7,22,0.95);backdrop-filter:blur(28px);color:#fff;border-radius:16px;border:1px solid rgba(139,92,246,0.25);padding:1.6em;min-width:340px;max-width:440px;width:92vw;box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04);"
		>
			<div class="cfg-title">⚙ Settings</div>

			<div class="cfg-label">Transport</div>
			<div class="transport-row">
				<button
					class="tbtn"
					on:click=${() => {
						connection.setTransport("/libcurl/index.mjs", [
							{ wisp: store.wispurl },
						]);
						store.transport = "/libcurl/index.mjs";
					}}
				>
					libcurl.js
				</button>
				<button
					class="tbtn"
					on:click=${() => {
						connection.setTransport("/epoxy/index.mjs", [
							{ wisp: store.wispurl },
						]);
						store.transport = "/epoxy/index.mjs";
					}}
				>
					epoxy
				</button>
				<button
					class="tbtn"
					on:click=${() => {
						connection.setTransport("/baremod/index.mjs", [store.bareurl]);
						store.transport = "/baremod/index.mjs";
					}}
				>
					bare server 3
				</button>
			</div>
			<div class="active-xport">${use(store.transport)}</div>

			<div class="cfg-label">Wisp URL</div>
			<input
				class="cfg-input"
				bind:value=${use(store.wispurl)}
				spellcheck="false"
			/>

			<div class="cfg-label">Bare URL</div>
			<input
				class="cfg-input"
				bind:value=${use(store.bareurl)}
				spellcheck="false"
			/>

			<div class="cfg-actions">
				<button class="btn-panic" on:click=${panic}>🗑 Panic</button>
				<button class="btn-close" on:click=${() => handleModalClose(this.root)}>
					Close
				</button>
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
    overflow-y: auto; height: 100%;
    padding: 1.5em 1.75em; box-sizing: border-box;
    animation: slideUp 0.25s ease;
    .sm-header { display:flex; align-items:center; gap:0.6em; margin-bottom:1.25em; }
    .sm-title {
      font-size: 1.1rem; font-weight: 700; letter-spacing:-0.02em; flex:1;
      background: linear-gradient(90deg,#c4b5fd,#818cf8);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .sm-btn {
      background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.65); border-radius:0.55em;
      padding:0.3em 0.75em; cursor:pointer; font-size:0.78rem;
      display:inline-flex; align-items:center; gap:0.3em;
      transition: background 0.13s, color 0.13s;
    }
    .sm-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
    .sm-btn.danger { border-color:rgba(239,68,68,0.3); color:#f87171; background:rgba(239,68,68,0.07); }
    .sm-btn.danger:hover { background:rgba(239,68,68,0.18); }
    table { width:100%; border-collapse:collapse; font-size:0.82rem; }
    th {
      text-align:left; padding:0.35em 0.6em;
      border-bottom:1px solid rgba(255,255,255,0.07);
      font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em;
      color:rgba(255,255,255,0.35); font-weight:500;
    }
    td { padding:0.38em 0.6em; border-bottom:1px solid rgba(255,255,255,0.04); }
    .del { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25);
      color:#f87171; border-radius:0.4em; padding:0.12em 0.5em;
      cursor:pointer; font-size:0.72rem; }
    .del:hover { background:rgba(239,68,68,0.22); }
    .empty { color:rgba(255,255,255,0.22); text-align:center; padding:3em 0; font-size:0.85rem; }
  `;

	return html`
		<div>
			<div class="sm-header">
				<span class="sm-title">🍪 Session Cookies</span>
				<button class="sm-btn" on:click=${refresh}>↻ Refresh</button>
				<button class="sm-btn danger" on:click=${handleClearAll}>
					🗑 Clear All
				</button>
			</div>
			${use(this.loading, (loading) =>
				loading
					? html`<div class="empty">Loading…</div>`
					: html`<table>
							<thead>
								<tr>
									<th>Domain</th>
									<th>Name</th>
									<th>Value</th>
									<th>Path</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								${use(this.cookies, (cookies) => {
									const rows = [];
									for (const [domain, names] of Object.entries(cookies)) {
										for (const [name, meta] of Object.entries(names)) {
											rows.push(
												html`<tr>
													<td>${domain}</td>
													<td>${name}</td>
													<td
														style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
													>
														${meta.value}
													</td>
													<td>${meta.path ?? "/"}</td>
													<td>
														<button
															class="del"
															on:click=${() => handleDelete(domain, name)}
														>
															✕
														</button>
													</td>
												</tr>`
											);
										}
									}

									return rows.length
										? rows
										: html`<tr>
												<td colspan="5" class="empty">No cookies stored</td>
											</tr>`;
								})}
							</tbody>
						</table>`
			)}
		</div>
	`;
}

// ── Games ────────────────────────────────────────────────────────────────────
const GAMES = [
	{ name: "1v1.lol", url: "https://1v1.lol", icon: "🎮", color: "#ef4444" },
	{ name: "Slope", url: "https://slope.io", icon: "⛷", color: "#8b5cf6" },
	{
		name: "Krunker.io",
		url: "https://krunker.io",
		icon: "🎯",
		color: "#f97316",
	},
	{
		name: "Retro Bowl",
		url: "https://retrobowl.me",
		icon: "🏈",
		color: "#10b981",
	},
	{
		name: "Shell Shockers",
		url: "https://shellshock.io",
		icon: "🥚",
		color: "#eab308",
	},
	{
		name: "Cookie Clicker",
		url: "https://orteil.dashnet.org/cookieclicker/",
		icon: "🍪",
		color: "#f59e0b",
	},
	{ name: "Bloxd.io", url: "https://bloxd.io", icon: "🧱", color: "#06b6d4" },
	{
		name: "Paper.io 2",
		url: "https://paper-io.com",
		icon: "📄",
		color: "#6366f1",
	},
	{
		name: "Smash Karts",
		url: "https://smashkarts.io",
		icon: "🚗",
		color: "#ec4899",
	},
	{
		name: "Minecraft",
		url: "https://classic.minecraft.net",
		icon: "⛏",
		color: "#84cc16",
	},
	{
		name: "Tetris",
		url: "https://tetris.com/play-tetris",
		icon: "🟦",
		color: "#3b82f6",
	},
	{ name: "2048", url: "https://play2048.co", icon: "🔢", color: "#f97316" },
	{
		name: "Flappy Bird",
		url: "https://flappybird.io",
		icon: "🐦",
		color: "#22c55e",
	},
	{
		name: "Minesweeper",
		url: "https://minesweeper.online",
		icon: "💣",
		color: "#a78bfa",
	},
	{ name: "Agar.io", url: "https://agar.io", icon: "🫧", color: "#14b8a6" },
	{
		name: "Slither.io",
		url: "https://slither.io",
		icon: "🐍",
		color: "#4ade80",
	},
	{
		name: "Wordle",
		url: "https://www.nytimes.com/games/wordle/index.html",
		icon: "🟩",
		color: "#6ee7b7",
	},
	{ name: "Chess.com", url: "https://chess.com", icon: "♟", color: "#94a3b8" },
	{
		name: "Skribbl.io",
		url: "https://skribbl.io",
		icon: "✏️",
		color: "#fb923c",
	},
	{
		name: "Geoguessr",
		url: "https://www.geoguessr.com",
		icon: "🌍",
		color: "#34d399",
	},
];

function Games({ onPlay }) {
	this.query = "";

	this.css = `
    padding: 1.5em 1.75em; overflow-y: auto;
    height: 100%; box-sizing: border-box;
    animation: slideUp 0.25s ease;

    .games-header { display:flex; align-items:center; gap:0.75em; margin-bottom:1.25em; }
    .games-title {
      font-size: 1.1rem; font-weight:700; letter-spacing:-0.02em;
      background: linear-gradient(90deg,#c4b5fd,#818cf8);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      flex:1;
    }
    .games-search {
      background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
      border-radius: 2em; color:#fff; outline:none;
      padding: 0.35em 0.9em 0.35em 0.9em;
      font-size: 0.82rem; width: 200px;
      transition: border-color 0.15s, background 0.15s;
    }
    .games-search::placeholder { color: rgba(255,255,255,0.3); }
    .games-search:focus { border-color: rgba(139,92,246,0.55); background: rgba(255,255,255,0.09); }

    /* Featured row – top 3 games as large gradient banners */
    .featured-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75em;
      margin-bottom: 1.25em;
    }
    .featured-card {
      position: relative;
      border-radius: 14px;
      padding: 1.25em 1em;
      cursor: pointer;
      overflow: hidden;
      display: flex; flex-direction:column; justify-content:flex-end;
      min-height: 110px;
      border: 1px solid rgba(255,255,255,0.08);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .featured-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.5); }
    .featured-card::before {
      content:""; position:absolute; inset:0;
      background: linear-gradient(160deg, rgba(255,255,255,0.07) 0%, transparent 60%);
      z-index:1;
    }
    .fc-badge {
      position:absolute; top:0.65em; left:0.75em; z-index:2;
      font-size:0.58rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em;
      color: rgba(255,255,255,0.6);
      background: rgba(0,0,0,0.3); padding:2px 7px; border-radius:1em;
    }
    .fc-icon { font-size:2.2rem; line-height:1; z-index:2; margin-bottom:0.3em; }
    .fc-name {
      font-size:0.88rem; font-weight:700; color:#fff; z-index:2;
      text-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }

    /* Regular game grid */
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
      gap: 0.65em;
    }
    .game-card {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:0.4em; padding: 1em 0.5em;
      background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);
      border-radius: 12px; cursor:pointer; text-align:center;
      transition: background 0.15s, border-color 0.15s, transform 0.12s;
      position:relative; overflow:hidden;
    }
    .game-card::before {
      content:""; position:absolute; inset:0; opacity:0;
      background: var(--gc, rgba(139,92,246,0.5));
      transition: opacity 0.15s;
    }
    .game-card:hover { transform: translateY(-3px); border-color: rgba(139,92,246,0.4); }
    .game-card:hover::before { opacity:0.12; }
    .gi { font-size:1.75rem; line-height:1; position:relative; z-index:1; }
    .gn {
      font-size:0.73rem; color:rgba(255,255,255,0.7); white-space:nowrap;
      overflow:hidden; text-overflow:ellipsis; max-width:100%;
      position:relative; z-index:1;
    }
    .section-label {
      font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em;
      color:rgba(255,255,255,0.3); margin-bottom:0.65em; font-weight:600;
    }
  `;

	return html`
		<div>
			<div class="games-header">
				<span class="games-title">🎮 Games</span>
				<input
					class="games-search"
					placeholder="Search games…"
					bind:value=${use(this.query)}
					on:input=${(e) => {
						this.query = e.target.value;
					}}
				/>
			</div>

			<!-- Featured games (hidden when searching) -->
			${use(this.query, (q) =>
				q.trim()
					? null
					: html`
							<div class="section-label">Featured</div>
							<div class="featured-row">
								${[GAMES[0], GAMES[2], GAMES[1]].map(
									(game) => html`
										<button
											class="featured-card"
											style="background: linear-gradient(145deg, ${game.color}55 0%, ${game.color}22 60%, rgba(0,0,0,0.4) 100%);"
											on:click=${() => onPlay(game.url)}
										>
											<div class="fc-badge">Play now</div>
											<span class="fc-icon">${game.icon}</span>
											<span class="fc-name">${game.name}</span>
										</button>
									`
								)}
							</div>
							<div class="section-label" style="margin-top:0.25em;">
								All Games
							</div>
						`
			)}

			<!-- Full game grid (filtered by search) -->
			<div class="games-grid">
				${use(this.query, (q) => {
					const filtered = q.trim()
						? GAMES.filter((g) =>
								g.name.toLowerCase().includes(q.toLowerCase())
							)
						: GAMES;

					return filtered.map(
						(game) => html`
							<button
								class="game-card"
								style="--gc:${game.color};"
								on:click=${() => onPlay(game.url)}
							>
								<span class="gi">${game.icon}</span>
								<span class="gn">${game.name}</span>
							</button>
						`
					);
				})}
			</div>
		</div>
	`;
}

// ── Quick link icon data ─────────────────────────────────────────────────────
const QUICK_LINKS = [
	{
		name: "Google",
		url: "https://google.com",
		letter: "G",
		grad: "linear-gradient(135deg,#4285f4,#34a3e6)",
	},
	{
		name: "YouTube",
		url: "https://youtube.com",
		letter: "▶",
		grad: "linear-gradient(135deg,#ff0000,#cc0000)",
	},
	{
		name: "Discord",
		url: "https://discord.com",
		letter: "D",
		grad: "linear-gradient(135deg,#5865f2,#4752c4)",
	},
	{
		name: "Reddit",
		url: "https://reddit.com",
		letter: "R",
		grad: "linear-gradient(135deg,#ff4500,#e03d00)",
	},
	{
		name: "X",
		url: "https://x.com",
		letter: "𝕏",
		grad: "linear-gradient(135deg,#18181b,#3f3f46)",
	},
	{
		name: "Spotify",
		url: "https://spotify.com",
		letter: "♪",
		grad: "linear-gradient(135deg,#1db954,#158a3e)",
	},
	{
		name: "GitHub",
		url: "https://github.com",
		letter: "⌨",
		grad: "linear-gradient(135deg,#24292e,#3d444d)",
	},
	{
		name: "Wikipedia",
		url: "https://wikipedia.org",
		letter: "W",
		grad: "linear-gradient(135deg,#374151,#1f2937)",
	},
];

// ── Home screen ─────────────────────────────────────────────────────────────
function HomeScreen({ onNavigate }) {
	this.searchVal = "";
	this._time = "";
	this._date = "";

	this.mount = () => {
		const tick = () => {
			const now = new Date();
			this._time = now.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
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

	const handleSearch = () => {
		const q = this.searchVal.trim();
		if (!q) return;
		onNavigate(q.startsWith("http") ? q : "https://" + q);
	};

	this.css = `
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    flex:1; padding-bottom:80px; animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1);

    /* ── Clock ── */
    .hs-clock { text-align:center; margin-bottom:0.6em; user-select:none; }
    .hs-time {
      font-size: clamp(4.5rem, 12vw, 8rem);
      font-weight: 100;
      letter-spacing: -0.04em;
      line-height: 1;
      color: #fff;
      animation: glowPulse 4s ease-in-out infinite;
    }
    .hs-date {
      font-size: clamp(0.85rem, 2vw, 1rem);
      color: rgba(255,255,255,0.38);
      margin-top: 0.5em;
      font-weight: 400;
      letter-spacing: 0.04em;
    }

    /* ── Search ── */
    .hs-search-wrap {
      position: relative;
      width: clamp(300px, 55vw, 580px);
      margin: 1.5em 0 2em;
    }
    .hs-search-icon {
      position:absolute; left:1em; top:50%; transform:translateY(-50%);
      font-size:0.95rem; color:rgba(255,255,255,0.35); pointer-events:none;
    }
    .hs-search {
      width:100%;
      background: rgba(255,255,255,0.065);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 2.5em;
      color:#fff; outline:none;
      padding: 0.85em 1em 0.85em 2.8em;
      font-size: 1rem;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .hs-search::placeholder { color: rgba(255,255,255,0.28); }
    .hs-search:focus {
      border-color: rgba(139,92,246,0.7);
      background: rgba(255,255,255,0.09);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.2), 0 0 30px rgba(124,58,237,0.15);
      animation: borderGlow 2s ease-in-out infinite;
    }

    /* ── App icon grid ── */
    .hs-apps {
      display: flex; gap: 1.1em; flex-wrap: wrap;
      justify-content: center; max-width: 600px;
    }
    .app-icon {
      display:flex; flex-direction:column; align-items:center; gap:0.45em;
      cursor:pointer; background:none; border:none; padding:0;
      transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
    }
    .app-icon:hover { transform: scale(1.12) translateY(-3px); }
    .app-face {
      width: 56px; height: 56px;
      border-radius: 16px;
      display:flex; align-items:center; justify-content:center;
      font-size: 1.25rem; font-weight: 700; color:#fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .app-name { font-size:0.68rem; color:rgba(255,255,255,0.55); white-space:nowrap; }

    /* ── Version ── */
    .hs-ver { margin-top:2em; font-size:0.62rem; color:rgba(255,255,255,0.15); }
    .hs-ver a { color:rgba(255,255,255,0.15); }
  `;

	return html`
		<div>
			<!-- Giant glowing clock -->
			<div class="hs-clock">
				<div class="hs-time">${use(this._time)}</div>
				<div class="hs-date">${use(this._date)}</div>
			</div>

			<!-- Glowing search bar -->
			<div class="hs-search-wrap">
				<span class="hs-search-icon">��</span>
				<input
					class="hs-search"
					placeholder="Search or enter a URL…"
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					bind:value=${use(this.searchVal)}
					on:input=${(e) => {
						this.searchVal = e.target.value;
					}}
					on:keyup=${(e) => e.key === "Enter" && handleSearch()}
				/>
			</div>

			<!-- Gradient app icons -->
			<div class="hs-apps">
				${QUICK_LINKS.map(
					(link) => html`
						<button class="app-icon" on:click=${() => onNavigate(link.url)}>
							<div class="app-face" style="background:${link.grad}">
								${link.letter}
							</div>
							<span class="app-name">${link.name}</span>
						</button>
					`
				)}
			</div>

			<!-- Version watermark -->
			<div class="hs-ver">
				scramjet ${$scramjetVersion.version} ·
				<a
					href=${"https://github.com/MercuryWorkshop/scramjet/commit/" +
					$scramjetVersion.build}
					>${$scramjetVersion.build}</a
				>
			</div>
		</div>
	`;
}

// ── Top Menu Bar (macOS-style) ───────────────────────────────────────────────
function MenuBar({ activeView, onSettings }) {
	this._time = "";
	this.mount = () => {
		const tick = () => {
			const now = new Date();
			this._time = now.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		};
		tick();
		const id = setInterval(tick, 1000);
		this.unmount = () => clearInterval(id);
	};

	this.css = `
    display: flex; align-items: center; gap: 0.5em;
    padding: 0 1em;
    height: 28px; flex-shrink: 0;
    background: rgba(6, 4, 15, 0.7);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 100; position: relative;
    user-select: none;

    .mb-brand {
      font-size: 0.78rem; font-weight: 700; letter-spacing: -0.01em;
      background: linear-gradient(90deg, #a78bfa, #818cf8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .mb-sep { color: rgba(255,255,255,0.12); font-size:0.7rem; }
    .mb-spacer { flex: 1; }
    .mb-status {
      display: inline-flex; align-items: center; gap: 0.3em;
      font-size: 0.68rem; color: rgba(255,255,255,0.4);
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 6px rgba(74,222,128,0.7);
    }
    .mb-clock {
      font-size: 0.72rem; font-weight: 500; color: rgba(255,255,255,0.65);
      min-width: 4.5em; text-align: right;
    }
    .mb-settings-btn {
      background: none; border: none; color: rgba(255,255,255,0.4);
      cursor: pointer; font-size: 0.82rem; padding: 0 0.25em;
      transition: color 0.12s;
    }
    .mb-settings-btn:hover { color: rgba(255,255,255,0.8); }
  `;

	return html`
		<div>
			<span class="mb-brand">✦ Parastar</span>
			<span class="mb-sep">|</span>
			${use(
				activeView,
				(v) =>
					html`<span style="font-size:0.72rem;color:rgba(255,255,255,0.4);"
						>${v === "home"
							? "Home"
							: v === "browser"
								? "Browser"
								: v === "games"
									? "Games"
									: "Sessions"}</span
					>`
			)}
			<div class="mb-spacer"></div>
			<div class="mb-status">
				<div class="status-dot"></div>
				<span>Proxy Active</span>
			</div>
			<span class="mb-sep">|</span>
			<span class="mb-clock">${use(this._time)}</span>
			<button class="mb-settings-btn" on:click=${onSettings} title="Settings">
				⚙
			</button>
		</div>
	`;
}

// ── macOS-style floating glass dock ─────────────────────────────────────────
function Dock({ activeView, onSelect }) {
	const DOCK_ITEMS = [
		{ id: "home", label: "Home", icon: "⌂" },
		{ id: "browser", label: "Browser", icon: "🌐" },
		{ id: "games", label: "Games", icon: "🎮" },
		{ id: "sessions", label: "Sessions", icon: "🍪" },
		{ id: "account", label: "Account", icon: "👤" },
	];

	this.css = `
    position: relative;
    height: 82px; flex-shrink: 0;
    pointer-events: none;

    .dock-pill {
      pointer-events: all;
      position: absolute; bottom: 12px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: flex-end; gap: 5px;
      padding: 8px 14px 7px;
      background: rgba(10, 6, 22, 0.6);
      backdrop-filter: saturate(180%) blur(28px);
      -webkit-backdrop-filter: saturate(180%) blur(28px);
      border: 1px solid rgba(139,92,246,0.2);
      border-radius: 24px;
      box-shadow:
        0 16px 48px rgba(0,0,0,0.65),
        0 4px 12px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.07),
        0 0 0 1px rgba(139,92,246,0.08);
      white-space: nowrap;
    }

    .di {
      position: relative; display: flex; flex-direction: column;
      align-items: center; background: none; border: none;
      padding: 0 3px; cursor: pointer;
      transform-origin: bottom center;
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .di:hover { transform: translateY(-14px) scale(1.38); }

    .di-face {
      width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem; border-radius: 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .di.active .di-face {
      background: rgba(124,58,237,0.25);
      border-color: rgba(139,92,246,0.55);
      box-shadow: 0 0 0 1px rgba(139,92,246,0.35), 0 3px 12px rgba(124,58,237,0.3);
    }

    .di-dot {
      width: 4px; height: 4px; border-radius: 50%;
      margin-top: 3px;
      background: rgba(167,139,250,0.8);
      box-shadow: 0 0 4px rgba(139,92,246,0.7);
    }
    .di-dot-empty { height: 7px; }

    .di-label {
      position: absolute; bottom: calc(100% + 12px); left: 50%;
      transform: translateX(-50%) translateY(5px);
      background: rgba(10,6,22,0.92);
      backdrop-filter: blur(10px);
      color: rgba(255,255,255,0.9);
      font-size: 0.68rem; font-weight: 500;
      padding: 3px 10px; border-radius: 8px;
      border: 1px solid rgba(139,92,246,0.2);
      white-space: nowrap; pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s, transform 0.12s;
    }
    .di:hover .di-label {
      opacity: 1; transform: translateX(-50%) translateY(0);
    }

    .dock-sep {
      width: 1px; height: 36px;
      background: rgba(255,255,255,0.1);
      align-self: center; margin: 0 6px;
    }
  `;

	return html`
		<div>
			<div class="dock-pill">
				${DOCK_ITEMS.map(
					(item) => html`
						<button
							class=${use(
								activeView,
								(v) => "di" + (v === item.id ? " active" : "")
							)}
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
			</div>
		</div>
	`;
}

// ── Browser navbar ───────────────────────────────────────────────────────────
function BrowserNav({
	url,
	onBack,
	onForward,
	onReload,
	onNavigate,
	onNewTab,
}) {
	this.inputUrl =
		typeof url === "object" && "value" in url ? url.value : url || "";

	const submit = () => {
		let u = this.inputUrl.trim();
		if (!u) return;
		if (!u.startsWith("http")) u = "https://" + u;
		onNavigate(u);
	};

	this.css = `
    display: flex; align-items: center; gap: 0.35em;
    padding: 0.45em 0.75em;
    background: rgba(6, 4, 15, 0.55);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 10;

    .nbtn {
      color: rgba(255,255,255,0.5); border: none; background: none;
      border-radius: 0.4em; padding: 0.28em 0.5em;
      cursor: pointer; font-size: 0.95rem;
      transition: color 0.12s, background 0.12s;
    }
    .nbtn:hover { color: #fff; background: rgba(255,255,255,0.08); }

    .url-bar {
      flex: 1; min-width: 0;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 0.55em; color: #fff; outline: none;
      padding: 0.32em 0.75em; font-size: 0.86rem;
      transition: border-color 0.15s, background 0.15s;
    }
    .url-bar:focus {
      border-color: rgba(139,92,246,0.55);
      background: rgba(255,255,255,0.09);
    }
  `;

	return html`
		<div>
			<button class="nbtn" on:click=${onBack} title="Back">‹</button>
			<button class="nbtn" on:click=${onForward} title="Forward">›</button>
			<button class="nbtn" on:click=${onReload} title="Reload">↻</button>
			<input
				class="url-bar"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				bind:value=${use(url)}
				on:input=${(e) => {
					this.inputUrl = e.target.value;
				}}
				on:keyup=${(e) => {
					if (e.key === "Enter") {
						this.inputUrl = e.target.value;
						submit();
					}
				}}
			/>
			<button class="nbtn" on:click=${() => onNewTab()} title="Open in new tab">
				↗
			</button>
		</div>
	`;
}

// ── Main OS App ──────────────────────────────────────────────────────────────
function OSApp() {
	this.activeView = "home";
	this.browserUrl = store.url || "https://google.com";

	this.css = `
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    color: #e0def4;

    .main-area {
      flex: 1; overflow: hidden;
      display: flex; flex-direction: column;
      position: relative;
    }
    .panel {
      flex: 1; overflow: hidden;
    }
    iframe {
      border: none; width: 100%; height: 100%;
      display: block; background: #fff;
    }
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
			<!-- macOS-style menu bar -->
			${h(MenuBar, {
				activeView: use(this.activeView),
				onSettings: () => cfg.showModal(),
			})}

			<!-- Main content -->
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
									onNewTab: () =>
										window.open(scramjet.encodeUrl(this.browserUrl)),
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
						return html` <div class="panel">${h(SessionManager)}</div> `;
					}

					if (view === "account") {
						return html` <div class="panel">${h(AccountPanel)}</div> `;
					}
				})}
			</div>

			<!-- Floating macOS-style dock -->
			${h(Dock, {
				activeView: use(this.activeView),
				onSelect: (id) => {
					this.activeView = id;
				},
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
