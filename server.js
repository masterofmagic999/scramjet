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
	SUPABASE_ENABLED,
} from "./cookie-store.js";
import { getUserId, signIn, signUp } from "./supabase-store.js";

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
 * Extract a bearer token from the Authorization header and return the
 * Supabase user ID, or the default fallback when auth is not configured.
 *
 * @param {import("fastify").FastifyRequest} req
 * @returns {Promise<string>}
 */
async function resolveUserId(req) {
	if (!SUPABASE_ENABLED) return "_default";
	const auth = req.headers["authorization"] ?? "";
	if (!auth.startsWith("Bearer ")) return "_default";
	const token = auth.slice(7);
	return (await getUserId(token)) ?? "_default";
}

// ── Auth endpoints ──────────────────────────────────────────────────────────

fastify.post("/api/auth/register", async (req, reply) => {
	if (!SUPABASE_ENABLED) {
		return reply.code(503).send({ error: "Supabase is not configured" });
	}
	const { email, password } = req.body ?? {};
	if (!email || !password) {
		return reply.code(400).send({ error: "email and password are required" });
	}
	const result = await signUp(email, password);
	if (!result) {
		return reply.code(400).send({ error: "Registration failed" });
	}
	return result;
});

fastify.post("/api/auth/login", async (req, reply) => {
	if (!SUPABASE_ENABLED) {
		return reply.code(503).send({ error: "Supabase is not configured" });
	}
	const { email, password } = req.body ?? {};
	if (!email || !password) {
		return reply.code(400).send({ error: "email and password are required" });
	}
	const result = await signIn(email, password);
	if (!result) {
		return reply.code(401).send({ error: "Invalid credentials" });
	}
	return result;
});

fastify.get("/api/auth/me", async (req, reply) => {
	if (!SUPABASE_ENABLED) {
		return reply.code(503).send({ error: "Supabase is not configured" });
	}
	const auth = req.headers["authorization"] ?? "";
	if (!auth.startsWith("Bearer ")) {
		return reply.code(401).send({ error: "No token provided" });
	}
	const userId = await getUserId(auth.slice(7));
	if (!userId) {
		return reply.code(401).send({ error: "Invalid or expired token" });
	}
	return { userId };
});

// ── Cookie store API ────────────────────────────────────────────────────────

fastify.get("/api/cookies", async (req, reply) => {
	const userId = await resolveUserId(req);
	reply.header("Content-Type", "application/json");
	return await loadCookies(userId);
});

fastify.post("/api/cookies", async (req, reply) => {
	const userId = await resolveUserId(req);
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
	const userId = await resolveUserId(req);
	await clearCookies(userId);
	return { ok: true };
});

fastify.delete("/api/cookies/:domain/:name", async (req, reply) => {
	const userId = await resolveUserId(req);
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
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
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
