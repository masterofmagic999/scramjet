/**
 * Cookie store – file-based (default) or Supabase-backed (cloud).
 *
 * When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set, cookies are
 * persisted in Supabase instead of a local JSON file.  This keeps all session
 * data in the cloud so it survives Codespace restarts, and it keeps the
 * Node.js heap usage flat across long-running sessions (no cookie data sits
 * in process memory between requests).
 *
 * File-based mode (default):
 *   Cookies are persisted to COOKIE_STORE_PATH (default: .cookies.json).
 *   When STORE_KEY is set the file is encrypted with AES-256-GCM so that
 *   credentials cannot be read from disk without the key.
 *   Expired cookies are pruned on every load to prevent unbounded file growth.
 */

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	clearCookiesFromSupabase,
	loadCookiesFromSupabase,
	saveCookiesToSupabase,
} from "./supabase-store.js";

/** True when a Supabase backend is configured via environment variables. */
export const SUPABASE_ENABLED = !!(
	process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Fallback user ID for unauthenticated / single-user deployments. */
const DEFAULT_USER = "_default";

const STORE_PATH = process.env.COOKIE_STORE_PATH || ".cookies.json";
const STORE_KEY = process.env.STORE_KEY;

function deriveKey() {
	if (!STORE_KEY) return null;
	return scryptSync(STORE_KEY, "scramjet-salt", 32);
}

function encrypt(data) {
	const key = deriveKey();
	if (!key) return JSON.stringify(data);
	const iv = randomBytes(16);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(data), "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return JSON.stringify({
		iv: iv.toString("hex"),
		authTag: authTag.toString("hex"),
		data: encrypted.toString("hex"),
	});
}

function decrypt(raw) {
	const key = deriveKey();
	if (!key) return JSON.parse(raw);
	const { iv, authTag, data } = JSON.parse(raw);
	const decipher = createDecipheriv(
		"aes-256-gcm",
		key,
		Buffer.from(iv, "hex")
	);
	decipher.setAuthTag(Buffer.from(authTag, "hex"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(data, "hex")),
		decipher.final(),
	]);
	return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Remove cookies whose `expires` field is in the past.
 * Called on every load so the store never grows unboundedly in memory or on disk.
 *
 * @param {object} cookies
 * @returns {object}
 */
function pruneExpired(cookies) {
	const now = Date.now();
	const result = {};
	for (const [domain, names] of Object.entries(cookies)) {
		const kept = {};
		for (const [name, meta] of Object.entries(names)) {
			if (meta.expires && new Date(meta.expires).getTime() < now) continue;
			kept[name] = meta;
		}
		if (Object.keys(kept).length > 0) result[domain] = kept;
	}
	return result;
}

/**
 * Load cookies.
 *
 * @param {string} [userId] - User ID for Supabase-backed storage.
 * @returns {Promise<object>|object}
 */
export function loadCookies(userId = DEFAULT_USER) {
	if (SUPABASE_ENABLED) {
		return loadCookiesFromSupabase(userId);
	}
	try {
		if (!existsSync(STORE_PATH)) return {};
		const raw = readFileSync(STORE_PATH, "utf8");
		return pruneExpired(decrypt(raw));
	} catch {
		return {};
	}
}

/**
 * Persist cookies.
 *
 * @param {object} cookies
 * @param {string} [userId] - User ID for Supabase-backed storage.
 * @returns {Promise<void>|void}
 */
export function saveCookies(cookies, userId = DEFAULT_USER) {
	if (SUPABASE_ENABLED) {
		return saveCookiesToSupabase(cookies, userId);
	}
	writeFileSync(STORE_PATH, encrypt(pruneExpired(cookies)), "utf8");
}

/**
 * Delete all cookies for a user.
 *
 * @param {string} [userId] - User ID for Supabase-backed storage.
 * @returns {Promise<void>|void}
 */
export function clearCookies(userId = DEFAULT_USER) {
	if (SUPABASE_ENABLED) {
		return clearCookiesFromSupabase(userId);
	}
	writeFileSync(STORE_PATH, encrypt({}), "utf8");
}
