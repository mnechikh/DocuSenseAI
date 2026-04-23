/**
 * Load test — document upload endpoint
 *
 * Usage:
 *   LOAD_TEST_API_KEY=<key> node load-tests/upload.mjs
 *
 * Env vars:
 *   LOAD_TEST_API_KEY   (required) Bearer token from /dashboard/api-keys
 *   LOAD_TEST_BASE_URL  (default: http://localhost:9002)
 *   CONCURRENCY         (default: 10) parallel slots
 *   ITERATIONS          (default: 3)  batches to run
 */

const BASE_URL = process.env.LOAD_TEST_BASE_URL ?? "http://localhost:9002";
const API_KEY = process.env.LOAD_TEST_API_KEY;
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const ITERATIONS = parseInt(process.env.ITERATIONS ?? "3", 10);

if (!API_KEY) {
  console.error("ERROR: LOAD_TEST_API_KEY env var is required.");
  process.exit(1);
}

// Minimal text document as base64 for the data URI payload
const PAYLOAD_B64 = Buffer.from("Load test document. This is a performance test sample.").toString("base64");
const PAYLOAD_URI = `data:text/plain;base64,${PAYLOAD_B64}`;

const latencies = [];
const errors = [];

async function uploadOne(index) {
  const docId = `loadtest-${Date.now()}-${index}`;
  const body = JSON.stringify({
    filename: `loadtest-${index}.txt`,
    fileType: "text/plain",
    documentDataUri: PAYLOAD_URI,
  });

  const start = performance.now();
  try {
    const resp = await fetch(`${BASE_URL}/api/v1/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body,
    });
    const elapsed = performance.now() - start;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      errors.push({ docId, status: resp.status, body: text.slice(0, 200) });
    } else {
      latencies.push(elapsed);
    }
  } catch (err) {
    errors.push({ docId, status: 0, body: err.message });
  }
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBatch(batchNum) {
  const tasks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    tasks.push(uploadOne(batchNum * CONCURRENCY + i));
  }
  await Promise.all(tasks);
}

console.log(`\n── Upload Load Test ─────────────────────────────────────────`);
console.log(`   Target : ${BASE_URL}/api/v1/documents`);
console.log(`   Concurrency: ${CONCURRENCY}  ·  Iterations: ${ITERATIONS}`);
console.log(`   Total requests: ${CONCURRENCY * ITERATIONS}\n`);

const totalStart = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
  process.stdout.write(`  Batch ${i + 1}/${ITERATIONS} … `);
  const t = performance.now();
  await runBatch(i);
  console.log(`done in ${(performance.now() - t).toFixed(0)}ms`);
}

const totalMs = performance.now() - totalStart;
const sorted = [...latencies].sort((a, b) => a - b);

console.log(`\n── Results ──────────────────────────────────────────────────`);
console.log(`   Requests : ${CONCURRENCY * ITERATIONS}`);
console.log(`   Succeeded: ${latencies.length}`);
console.log(`   Errored  : ${errors.length}`);
console.log(`   Total time: ${(totalMs / 1000).toFixed(2)}s`);
if (sorted.length > 0) {
  console.log(`   Throughput: ${(latencies.length / (totalMs / 1000)).toFixed(1)} req/s`);
  console.log(`   Latency p50: ${percentile(sorted, 50).toFixed(0)}ms`);
  console.log(`   Latency p90: ${percentile(sorted, 90).toFixed(0)}ms`);
  console.log(`   Latency p99: ${percentile(sorted, 99).toFixed(0)}ms`);
  console.log(`   Min: ${sorted[0].toFixed(0)}ms  Max: ${sorted[sorted.length - 1].toFixed(0)}ms`);
}
if (errors.length > 0) {
  console.log(`\n── Errors ───────────────────────────────────────────────────`);
  errors.slice(0, 10).forEach((e) => console.log(`   [${e.status}] ${e.body}`));
}
console.log(`─────────────────────────────────────────────────────────────\n`);
