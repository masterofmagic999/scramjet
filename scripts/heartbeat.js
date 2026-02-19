/**
 * Heartbeat / keep-alive script for GitHub Codespaces.
 *
 * Pings the local server every INTERVAL ms so that the Codespace is not
 * automatically suspended due to inactivity.  Also prints current Node.js
 * heap usage so memory-constrained Codespace instances can be monitored
 * easily.  Set NODE_OPTIONS=--max-old-space-size=512 (already set in
 * devcontainer.json) to cap the V8 heap for low-RAM environments.
 */

const INTERVAL = 4 * 60 * 1000; // 4 minutes – well within the 5-min idle limit
const PORT = process.env.PORT || 1337;
const BASE_URL = `http://localhost:${PORT}`;

function formatMB(bytes) {
	return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function printMemory() {
	const mem = process.memoryUsage();
	console.log(
		`[heartbeat] heap: ${formatMB(mem.heapUsed)} / ${formatMB(mem.heapTotal)} ` +
			`rss: ${formatMB(mem.rss)}`
	);
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
