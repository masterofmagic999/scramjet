/**
 * Supabase-backed cookie store.
 *
 * Used instead of the file-based store when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are both set in the environment.
 *
 * Required Supabase table (run once in the Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS cookie_store (
 *     user_id    TEXT PRIMARY KEY,
 *     cookies    JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 * Because all state lives in Supabase (not in the Node.js heap) the server's
 * memory footprint stays flat across long-running Codespace sessions.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE = "cookie_store";

function makeClient() {
	return createClient(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_SERVICE_ROLE_KEY,
		{ auth: { persistSession: false } }
	);
}

/**
 * Remove cookies whose `expires` field is in the past.
 * Keeps stored payloads small so Supabase row size stays bounded.
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
 * Load cookies for a given user from Supabase.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function loadCookiesFromSupabase(userId) {
	try {
		const supabase = makeClient();
		const { data, error } = await supabase
			.from(TABLE)
			.select("cookies")
			.eq("user_id", userId)
			.single();
		if (error || !data) return {};
		return pruneExpired(data.cookies ?? {});
	} catch {
		return {};
	}
}

/**
 * Persist cookies for a given user to Supabase.
 * Expired cookies are pruned before saving to prevent unbounded row growth.
 *
 * @param {object} cookies
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function saveCookiesToSupabase(cookies, userId) {
	const pruned = pruneExpired(cookies);
	const supabase = makeClient();
	await supabase.from(TABLE).upsert(
		{
			user_id: userId,
			cookies: pruned,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "user_id" }
	);
}

/**
 * Delete all cookies for a given user from Supabase.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearCookiesFromSupabase(userId) {
	const supabase = makeClient();
	await supabase.from(TABLE).delete().eq("user_id", userId);
}

/**
 * Authenticate a user (sign in with email + password).
 * Uses the Supabase anon key so the service role key is never exposed.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{accessToken: string, userId: string}|null>}
 */
export async function signIn(email, password) {
	const client = createClient(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_ANON_KEY,
		{ auth: { persistSession: false } }
	);
	const { data, error } = await client.auth.signInWithPassword({
		email,
		password,
	});
	if (error || !data?.session) return null;
	return {
		accessToken: data.session.access_token,
		userId: data.user.id,
	};
}

/**
 * Register a new user (sign up with email + password).
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{accessToken: string|null, userId: string}|null>}
 */
export async function signUp(email, password) {
	const client = createClient(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_ANON_KEY,
		{ auth: { persistSession: false } }
	);
	const { data, error } = await client.auth.signUp({ email, password });
	if (error || !data?.user) return null;
	// signUp may not return a session if email confirmation is required
	return {
		accessToken: data.session?.access_token ?? null,
		userId: data.user.id,
	};
}

/**
 * Verify an access token and return the user ID.
 *
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function getUserId(token) {
	try {
		const supabase = makeClient();
		const { data, error } = await supabase.auth.getUser(token);
		if (error || !data?.user) return null;
		return data.user.id;
	} catch {
		return null;
	}
}
