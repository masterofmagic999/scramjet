/**
 * Encrypted server-side cookie store.
 *
 * Cookies are persisted to COOKIE_STORE_PATH (default: .cookies.json).
 * When STORE_KEY is set the file is encrypted with AES-256-GCM so that
 * credentials cannot be read from disk without the key.
 */

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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

export function loadCookies() {
	try {
		if (!existsSync(STORE_PATH)) return {};
		const raw = readFileSync(STORE_PATH, "utf8");
		return decrypt(raw);
	} catch {
		return {};
	}
}

export function saveCookies(cookies) {
	writeFileSync(STORE_PATH, encrypt(cookies), "utf8");
}
