const express = require('express');
const client = require('prom-client');
const os = require('os');

const APP_VERSION = process.env.APP_VERSION || 'v2.0.0';
const COLOR = process.env.APP_COLOR || '#16a34a'; // green
const PORT = process.env.PORT || 3000;
const POD_NAME = process.env.HOSTNAME || os.hostname();

const app = express();

// --- Prometheus metrics (same pattern as meshapp) ---
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'frontend_' });

const requestCounter = new client.Counter({
  name: 'frontend_requests_total',
  help: 'Total requests received, labeled by version, pod, route, and status code',
  labelNames: ['version', 'pod', 'route', 'status_code'],
  registers: [register],
});

const requestDuration = new client.Histogram({
  name: 'frontend_request_duration_seconds',
  help: 'Request duration in seconds, labeled by version and route',
  labelNames: ['version', 'pod', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Record metrics on response finish, not on request arrival —
// status code and duration aren't known until the response is sent.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      version: APP_VERSION,
      pod: POD_NAME,
      route: req.route ? req.route.path : req.path, // req.route.path avoids per-id cardinality blowup
      status_code: res.statusCode,
    };
    requestCounter.inc(labels);
    requestDuration.observe(labels, durationSeconds);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', version: APP_VERSION }));
app.get('/readyz', (req, res) => res.status(200).json({ status: 'ready', version: APP_VERSION }));

app.get('/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    pod: POD_NAME,
    node: process.version,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.set('X-App-Version', APP_VERSION);
  res.send(renderPage());
});

function renderPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Frontend Demo ${APP_VERSION}</title>
<style>
  :root { --accent: ${COLOR}; }
  body {
    margin: 0; font-family: -apple-system, Segoe UI, Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #0f172a; color: #f8fafc;
  }
  .card {
    background: var(--accent); border-radius: 16px; padding: 48px 64px;
    text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  }
  h1 { font-size: 3rem; margin: 0 0 8px; letter-spacing: -0.02em; }
  p { opacity: 0.85; margin: 4px 0; font-size: 0.95rem; }
  code { background: rgba(0,0,0,0.25); padding: 2px 8px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="card">
    <h1>VERSION ${APP_VERSION.toUpperCase()}</h1>
    <p>Serving from pod <code>${POD_NAME}</code></p>
    <p id="ts"></p>
  </div>
  <script>
    document.getElementById('ts').textContent = new Date().toLocaleString();
  </script>
</body>
</html>`;
}

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'app started', version: APP_VERSION, pod: POD_NAME, port: PORT }));
});

// Graceful shutdown — lets in-flight requests finish before the pod
// terminates, which matters during a canary/blue-green cutover where
// old-version pods get scaled down while traffic is still shifting.
process.on('SIGTERM', () => {
  console.log(JSON.stringify({ level: 'info', msg: 'SIGTERM received, shutting down gracefully', version: APP_VERSION, pod: POD_NAME }));
  server.close(() => process.exit(0));
});