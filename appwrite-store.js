/**
 * Appwrite-backed cookie store.
 *
 * Used instead of the file-based store when APPWRITE_PROJECT_ID and
 * APPWRITE_API_KEY are both set in the environment.
 *
 * Appwrite database / collection used (must already exist in your project):
 *   Database ID  : 6998bda1003d071c37b6
 *   Collection ID: parastar
 *
 * Required collection attributes:
 *   user_id    – String, required, unique (used as the document ID)
 *   cookies    – String (JSON-serialised cookie map), required
 *   updated_at – DateTime, required
 *
 * Because all state lives in Appwrite (not in the Node.js heap) the server's
 * memory footprint stays flat across long-running Codespace sessions.
 */

import { Client, Databases, ID, Query } from "node-appwrite";

const DATABASE_ID = "6998bda1003d071c37b6";
const COLLECTION_ID = "parastar";

/** Build an authenticated server-side Appwrite client. */
function makeClient() {
	const client = new Client();
	client
		.setEndpoint(
			process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
		)
		.setProject(process.env.APPWRITE_PROJECT_ID)
		.setKey(process.env.APPWRITE_API_KEY);
	return client;
}

/**
 * Remove cookies whose `expires` field is in the past.
 * Keeps stored payloads small so Appwrite document size stays bounded.
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
 * Load cookies for a given user from Appwrite.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function loadCookiesFromAppwrite(userId) {
	try {
		const db = new Databases(makeClient());
		const result = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
			Query.equal("user_id", userId),
			Query.limit(1),
		]);
		if (!result.documents.length) return {};
		const raw = result.documents[0].cookies;
		let parsed;
		if (typeof raw === "string") {
			try {
				parsed = JSON.parse(raw);
			} catch {
				parsed = {};
			}
		} else {
			parsed = raw ?? {};
		}
		return pruneExpired(parsed);
	} catch {
		return {};
	}
}

/**
 * Persist cookies for a given user to Appwrite.
 * Expired cookies are pruned before saving to prevent unbounded document growth.
 *
 * @param {object} cookies
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function saveCookiesToAppwrite(cookies, userId) {
	const pruned = pruneExpired(cookies);
	const db = new Databases(makeClient());
	const payload = {
		user_id: userId,
		cookies: JSON.stringify(pruned),
		updated_at: new Date().toISOString(),
	};
	try {
		// Try to find an existing document for this user.
		const result = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
			Query.equal("user_id", userId),
			Query.limit(1),
		]);
		if (result.documents.length) {
			await db.updateDocument(
				DATABASE_ID,
				COLLECTION_ID,
				result.documents[0].$id,
				payload
			);
		} else {
			await db.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), payload);
		}
	} catch {
		// Silently fail – cookie loss is preferable to a server crash.
	}
}

/**
 * Delete all cookies for a given user from Appwrite.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearCookiesFromAppwrite(userId) {
	try {
		const db = new Databases(makeClient());
		const result = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
			Query.equal("user_id", userId),
			Query.limit(1),
		]);
		if (result.documents.length) {
			await db.deleteDocument(
				DATABASE_ID,
				COLLECTION_ID,
				result.documents[0].$id
			);
		}
	} catch {
		// Silently fail.
	}
}
