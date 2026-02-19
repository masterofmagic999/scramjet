/// <reference path="../lib/index.d.ts" />

// dumb hack to allow firefox to work (please dont do this in prod)
if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// ── Cookie persistence helpers ──────────────────────────────────────────────

/**
 * Parse a raw Set-Cookie header string into its name and value.
 * Returns null if parsing fails.
 * @param {string} raw
 * @returns {{ name: string, value: string, path: string, expires: string|undefined, httpOnly: boolean, secure: boolean, sameSite: string|undefined }|null}
 */
function parseSetCookie(raw) {
	const parts = raw.split(";").map((s) => s.trim());
	const [nameVal, ...attrs] = parts;
	const eqIdx = nameVal.indexOf("=");
	if (eqIdx === -1) return null;
	const name = nameVal.slice(0, eqIdx).trim();
	const value = nameVal.slice(eqIdx + 1).trim();
	const meta = { name, value, path: "/" };
	for (const attr of attrs) {
		const lower = attr.toLowerCase();
		if (lower.startsWith("path=")) meta.path = attr.slice(5);
		else if (lower.startsWith("expires=")) meta.expires = attr.slice(8);
		else if (lower === "httponly") meta.httpOnly = true;
		else if (lower === "secure") meta.secure = true;
		else if (lower.startsWith("samesite=")) meta.sameSite = attr.slice(9);
	}
	return meta;
}

/** Persist a single cookie to the server-side store. */
async function persistCookie(domain, cookieMeta) {
	try {
		await fetch("/api/cookies", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ domain, ...cookieMeta }),
		});
	} catch {
		// non-fatal – best-effort persistence
	}
}

/** Fetch all persisted cookies for a given domain. */
async function getPersistedCookies(domain) {
	try {
		const res = await fetch("/api/cookies");
		const all = await res.json();
		return all[domain] ?? {};
	} catch {
		return {};
	}
}

// ── Request handler ─────────────────────────────────────────────────────────

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.route(event)) {
		const response = await scramjet.fetch(event);

		// Intercept Set-Cookie headers and sync to the server-side store.
		// The Fetch API exposes only the first Set-Cookie value via .get(); use
		// .getSetCookie() where available to iterate all values correctly.
		const setCookieValues =
			typeof response.headers.getSetCookie === "function"
				? response.headers.getSetCookie()
				: [response.headers.get("set-cookie")].filter(Boolean);

		if (setCookieValues.length > 0) {
			try {
				const domain = new URL(event.request.url).hostname;
				for (const raw of setCookieValues) {
					const meta = parseSetCookie(raw);
					if (meta) {
						persistCookie(domain, meta);
					}
				}
			} catch {
				// non-fatal
			}
		}

		return response;
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

let playgroundData;
self.addEventListener("message", ({ data }) => {
	if (data.type === "playgroundData") {
		playgroundData = data;
	}
});

scramjet.addEventListener("request", (e) => {
	if (playgroundData && e.url.href.startsWith(playgroundData.origin)) {
		const headers = {};
		const origin = playgroundData.origin;
		if (e.url.href === origin + "/") {
			headers["content-type"] = "text/html";
			e.response = new Response(playgroundData.html, {
				headers,
			});
		} else if (e.url.href === origin + "/style.css") {
			headers["content-type"] = "text/css";
			e.response = new Response(playgroundData.css, {
				headers,
			});
		} else if (e.url.href === origin + "/script.js") {
			headers["content-type"] = "application/javascript";
			e.response = new Response(playgroundData.js, {
				headers,
			});
		} else {
			e.response = new Response("empty response", {
				headers,
			});
		}
		e.response.rawHeaders = headers;
		e.response.rawResponse = {
			body: e.response.body,
			headers: headers,
			status: e.response.status,
			statusText: e.response.statusText,
		};
		e.response.finalURL = e.url.toString();
	} else {
		return;
	}
});
