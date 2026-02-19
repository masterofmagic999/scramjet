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
    padding: 1em;
    box-sizing: border-box;
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    th {
      text-align: left;
      color: rgba(255,255,255,0.45);
      font-weight: 500;
      padding: 0.35em 0.5em;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    td {
      padding: 0.35em 0.5em;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      word-break: break-all;
    }
    .del-btn {
      background: rgba(220,50,50,0.15);
      border: 1px solid rgba(220,50,50,0.35);
      color: #f87171;
      border-radius: 0.4em;
      padding: 0.15em 0.55em;
      cursor: pointer;
      font-size: 0.78rem;
    }
    .del-btn:hover { background: rgba(220,50,50,0.3); }
    .clear-btn {
      background: rgba(220,50,50,0.12);
      border: 1px solid rgba(220,50,50,0.3);
      color: #f87171;
      border-radius: 0.6em;
      padding: 0.35em 0.9em;
      cursor: pointer;
      font-size: 0.82rem;
      margin-bottom: 0.75em;
    }
    .clear-btn:hover { background: rgba(220,50,50,0.25); }
    .refresh-btn {
      background: rgba(76,139,245,0.12);
      border: 1px solid rgba(76,139,245,0.3);
      color: #93c5fd;
      border-radius: 0.6em;
      padding: 0.35em 0.9em;
      cursor: pointer;
      font-size: 0.82rem;
      margin-bottom: 0.75em;
      margin-left: 0.5em;
    }
    .refresh-btn:hover { background: rgba(76,139,245,0.25); }
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
      padding: 0.45em 0.6em;
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .nav-btn {
      color: #fff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 0.4em;
      background: rgba(255,255,255,0.06);
      padding: 0.25em 0.55em;
      cursor: pointer;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.12); }
    .nav-btn.panic {
      border-color: rgba(220,50,50,0.4);
      background: rgba(220,50,50,0.1);
      color: #f87171;
    }
    .nav-btn.panic:hover { background: rgba(220,50,50,0.22); }
    .nav-btn.active-tab {
      border-color: rgba(76,139,245,0.55);
      background: rgba(76,139,245,0.15);
      color: #93c5fd;
    }

    input.bar {
      flex: 1;
      padding: 0.28em 0.6em;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 0.4em;
      outline: none;
      color: #fff;
      background: rgba(255,255,255,0.06);
      font-size: 0.88rem;
      min-width: 0;
    }
    input.bar:focus { border-color: rgba(76,139,245,0.5); }

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
      color: rgba(255,255,255,0.3);
      white-space: nowrap;
    }
    .version a { color: rgba(255,255,255,0.3); }

    .session-panel {
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.02);
    }
  `;

	this.url = store.url;
	this.activeTab = "browser"; // "browser" | "sessions"

	const frame = scramjet.createFrame();

	this.mount = () => {
		const body = btoa(
			`<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center"><h2>Welcome to <i>Scramjet</i></h2><p>Type a URL in the bar above and press Enter.</p></div>
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

        <!-- Panic button -->
        <button class="nav-btn panic" on:click=${panic} title="Clear all cookies, cache, and storage">🗑 Panic</button>

        <span class="version">
          <b>scramjet</b> ${$scramjetVersion.version}
          <a href=${use(this.githubURL)}>${$scramjetVersion.build}</a>
        </span>
      </div>

      <!-- Tab content -->
      <div class="tab-content">
        ${use(this.activeTab, (tab) =>
					tab === "sessions"
						? html`<div class="session-panel">${h(SessionManager)}</div>`
						: frame.frame
				)}
      </div>
    </div>
  `;
}

window.addEventListener("load", async () => {
	const root = document.getElementById("app");
	try {
		root.replaceWith(h(BrowserApp));
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
