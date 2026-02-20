/**
 * Heartbeat / keep-alive script for GitHub Codespaces.
 *
 * Pings the local server every INTERVAL ms so that the Codespace is not
 * automatically suspended due to inactivity.  Also prints current Node.js
 * heap usage so memory-constrained Codespace instances can be monitored
 * easily.  Set NODE_OPTIONS=--max-old-space-size=512 --expose-gc (already set
 * in devcontainer.json) to cap the V8 heap and enable manual GC for
 * low-RAM environments.
 *
 * When the heap exceeds HEAP_WARN_PERCENT of --max-old-space-size a warning
 * is printed and, if --expose-gc was passed, a full GC is triggered to try
 * to reclaim memory before the process hits the hard limit.
 */

const INTERVAL = 4 * 60 * 1000; // 4 minutes – well within the 5-min idle limit
const PORT = process.env.PORT || 1337;
const BASE_URL = `http://localhost:${PORT}`;

// Warn (and attempt GC) once heap usage crosses this fraction of the V8 limit.
const HEAP_WARN_PERCENT = 0.75;

/**
 * Parse the --max-old-space-size=N flag from NODE_OPTIONS / argv so we can
 * compute a sensible warning threshold.  Returns the limit in bytes, or null
 * if the flag is not present (V8 will choose its own default).
 */
function parseMaxOldSpaceBytes() {
	const src = [
		...(process.env.NODE_OPTIONS || "").split(/\s+/),
		...process.execArgv,
	].join(" ");
	const m = src.match(/--max-old-space-size=(\d+)/);
	return m ? parseInt(m[1], 10) * 1024 * 1024 : null;
}

const MAX_HEAP_BYTES = parseMaxOldSpaceBytes();

function formatMB(bytes) {
	return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function printMemory() {
	const mem = process.memoryUsage();
	const heapUsed = mem.heapUsed;
	const heapTotal = mem.heapTotal;

	console.log(
		`[heartbeat] heap: ${formatMB(heapUsed)} / ${formatMB(heapTotal)} ` +
			`rss: ${formatMB(mem.rss)}`
	);

	// Warn and attempt GC when usage is high relative to the configured limit.
	const limit = MAX_HEAP_BYTES ?? heapTotal;
	if (heapUsed / limit >= HEAP_WARN_PERCENT) {
		console.warn(
			`[heartbeat] ⚠ heap usage is ${Math.round((heapUsed / limit) * 100)}% ` +
				`of the ${formatMB(limit)} limit`
		);
		if (typeof global.gc === "function") {
			global.gc();
			const after = process.memoryUsage().heapUsed;
			console.log(
				`[heartbeat] GC triggered – heap after: ${formatMB(after)} ` +
					`(freed ${formatMB(heapUsed - after)})`
			);
		}
	}
}

async function ping() {
	try {
		const res = await fetch(`${BASE_URL}/api/heartbeat`);
		const { time } = await res.json();
		console.log(`[heartbeat] ok – ${new Date(time).toISOString()}`);
	} catch (err) {
		console.error(`[heartbeat] failed – ${err.message}`);
	}
	printMemory();
}

console.log(
	`[heartbeat] started – pinging every ${INTERVAL / 1000}s (port ${PORT})`
);
ping();
setInterval(ping, INTERVAL);
