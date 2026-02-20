// Dev server imports
import { createBareServer } from "@nebula-services/bare-server-node";
import { createServer } from "http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import rspackConfig from "./rspack.config.js";
import { rspack } from "@rspack/core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

//transports
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { chmodSync, mkdirSync, writeFileSync } from "fs";
import {
	clearCookies,
	loadCookies,
	saveCookies,
	APPWRITE_ENABLED,
} from "./cookie-store.js";

const bare = createBareServer("/bare/", {
	logErrors: true,
	blockLocal: false,
});

wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

				if (bare.shouldRoute(req)) {
					bare.routeRequest(req, res);
				} else {
					handler(req, res);
				}
			})
			.on("upgrade", (req, socket, head) => {
				if (bare.shouldRoute(req)) {
					bare.routeUpgrade(req, socket, head);
				} else {
					wisp.routeRequest(req, socket, head);
				}
			});
	},
});

// ── Dynamic /config.js — must be registered BEFORE static-file plugin ────────
// Generates the correct Wisp / Bare URLs from the incoming request's Host
// so the proxy works on any dynamic hostname (Codespaces, Railway, Render …)
// without any manual configuration.
fastify.get("/config.js", async (req, reply) => {
	const forwarded = req.headers["x-forwarded-proto"];
	const proto = forwarded
		? forwarded.split(",")[0].trim()
		: req.protocol || "http";
	const host =
		req.headers["x-forwarded-host"]?.split(",")[0].trim() || req.headers.host;
	const wsProto = proto === "https" ? "wss" : "ws";
	reply.header("content-type", "application/javascript; charset=utf-8");
	return `let _CONFIG = ${JSON.stringify({
		wispurl: `${wsProto}://${host}/wisp/`,
		bareurl: `${proto}://${host}/bare/`,
	})};`;
});

fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./dist"),
	prefix: "/scram/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./assets"),
	prefix: "/assets/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: bareModulePath,
	prefix: "/baremod/",
	decorateReply: false,
});

// ── Auth helpers ────────────────────────────────────────────────────────────

/**
 * Always returns the single default user ID.
 * Per-user isolation is not needed for a single-user Codespace deployment.
 *
 * @returns {string}
 */
function resolveUserId() {
	return "_default";
}

// ── Cloud status endpoint ────────────────────────────────────────────────────

fastify.get("/api/cloud-status", async (_req, _reply) => {
	return { appwrite: APPWRITE_ENABLED };
});

// ── Auth endpoints (removed – Appwrite backend is configured via env vars) ──

// ── Cookie store API ────────────────────────────────────────────────────────

fastify.get("/api/cookies", async (req, reply) => {
	const userId = resolveUserId();
	reply.header("Content-Type", "application/json");
	return await loadCookies(userId);
});

fastify.post("/api/cookies", async (req, reply) => {
	const userId = resolveUserId();
	const cookies = await loadCookies(userId);
	const { domain, name, value, path = "/", expires, httpOnly, secure, sameSite } =
		req.body ?? {};
	if (!domain || !name) {
		return reply.code(400).send({ error: "domain and name are required" });
	}
	if (!cookies[domain]) cookies[domain] = {};
	cookies[domain][name] = { value, path, expires, httpOnly, secure, sameSite };
	await saveCookies(cookies, userId);
	return { ok: true };
});

fastify.delete("/api/cookies", async (req, _reply) => {
	const userId = resolveUserId();
	await clearCookies(userId);
	return { ok: true };
});

fastify.delete("/api/cookies/:domain/:name", async (req, reply) => {
	const userId = resolveUserId();
	const cookies = await loadCookies(userId);
	const { domain, name } = req.params;
	if (cookies[domain]) {
		delete cookies[domain][name];
		if (Object.keys(cookies[domain]).length === 0) {
			delete cookies[domain];
		}
	}
	await saveCookies(cookies, userId);
	return { ok: true };
});

// ── Heartbeat (keep-alive) ──────────────────────────────────────────────────

fastify.get("/api/heartbeat", async (_req, _reply) => {
	return { ok: true, time: Date.now() };
});

// ── Header fingerprint randomization ───────────────────────────────────────

const USER_AGENTS = [
	// Chrome on Windows (most common desktop UA)
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	// Chrome on macOS
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	// Chrome on Linux
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	// Firefox
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0",
	// Safari
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
	// Edge on Windows
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
];

export function randomUserAgent() {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

fastify.get("/api/useragent", async (_req, _reply) => {
	return { userAgent: randomUserAgent() };
});

// ───────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) || 1337 : 1337;

fastify.listen({
	port: PORT,
	host: "0.0.0.0",
});

fastify.setNotFoundHandler((request, reply) => {
	console.error("PAGE PUNCHED THROUGH SW - " + request.url);
	reply.code(593).send("punch through");
});
console.log(`Listening on http://localhost:${PORT}/`);
if (!process.env.CI) {
	try {
		writeFileSync(
			".git/hooks/pre-commit",
			"pnpm format\ngit update-index --again"
		);
		chmodSync(".git/hooks/pre-commit", 0o755);
	} catch {}

	const compiler = rspack(rspackConfig);
	compiler.watch({}, (err, stats) => {
		console.log(
			stats
				? stats.toString({
						preset: "minimal",
						colors: true,
						version: false,
					})
				: ""
		);
	});
}
