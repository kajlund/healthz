import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = resolve(process.argv[2] || ".");
const npm = process.env.npm_execpath;
assert(npm, "Run with npm run verify:start");
const html = await readFile(resolve(directory, "apps/web/dist/index.html"), "utf8");
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((done) => listener.close(done));

const child = spawn(process.execPath, [npm, "start"], {
  cwd: directory,
  detached: process.platform !== "win32",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused_test",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
let spawnError;
child.on("error", (error) => { spawnError = error; });
child.stdout.on("data", (data) => { logs = (logs + data).slice(-4000); });
child.stderr.on("data", (data) => { logs = (logs + data).slice(-4000); });
const origin = `http://127.0.0.1:${port}`;
try {
  let health;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null, `npm start exited early:\n${logs}`);
    try {
      health = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await delay(100);
    }
  }
  assert(health, `npm start did not listen:\n${logs}`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), html);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)];
  assert(assets.length > 0, "Built HTML must reference bundled assets");
  for (const [, path] of assets) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert(!(response.headers.get("content-type") || "").includes("text/html"));
    await response.arrayBuffer();
  }
  for (const path of ["/favicon.svg", "/healthz-icon.svg", "/healthz-logo.svg"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", /image\/svg\+xml/);
    await response.arrayBuffer();
  }
  const missing = await fetch(`${origin}/api/not-a-route`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "NOT_FOUND");
  console.log("npm start serves /health, the built frontend, and bundled assets.");
} finally {
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
    assert.equal(result.status, 0, "Could not stop smoke-test process tree");
  } else {
    process.kill(-child.pid, "SIGTERM");
  }
}
