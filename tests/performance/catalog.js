import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.API_URL || 'http://localhost:8100').replace(/\/$/, '');
const SCENARIO = __ENV.SCENARIO || 'smoke';
const ENDPOINTS = ['catalog', 'search', 'plant'];
// open() is relative to this script; handleSummary write paths are relative to cwd.
const BASELINE_READ = './baseline.json';
const BASELINE_WRITE = 'tests/performance/baseline.json';

// Placeholder limits (3× baseline p95, clamped 50–300 ms) until someone owns a target.
function limitFromP95(p95) {
  if (p95 == null || Number.isNaN(Number(p95))) return 300;
  return Math.min(300, Math.max(50, 3 * Number(p95)));
}

function loadBaseline() {
  try {
    return JSON.parse(open(BASELINE_READ));
  } catch (_err) {
    return {};
  }
}

const baseline = loadBaseline();
const limits = Object.fromEntries(
  ENDPOINTS.map((name) => {
    const entry = baseline[name];
    const p95 = entry && typeof entry === 'object' ? entry.p95 : entry;
    return [name, limitFromP95(p95)];
  }),
);

const scenarioConfigs = {
  smoke: {
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 10,
  },
  load: {
    executor: 'constant-vus',
    vus: 20,
    duration: '30s',
  },
};

if (!scenarioConfigs[SCENARIO]) {
  throw new Error(`Unknown SCENARIO="${SCENARIO}". Use smoke or load.`);
}

export const options = {
  scenarios: {
    [SCENARIO]: scenarioConfigs[SCENARIO],
  },
  summaryTrendStats: ['p(50)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:catalog}': [`p(95)<${limits.catalog}`],
    'http_req_duration{endpoint:search}': [`p(95)<${limits.search}`],
    'http_req_duration{endpoint:plant}': [`p(95)<${limits.plant}`],
  },
};

function request(endpoint, url) {
  const res = http.get(url, {
    tags: { endpoint, name: endpoint },
  });
  check(res, {
    [`${endpoint} status is 200`]: (r) => r.status === 200,
  });
  return res;
}

export default function () {
  const catalogRes = request('catalog', `${BASE_URL}/api/plants`);

  request('search', `${BASE_URL}/api/plants?search=monstera`);

  let plantId = 'pl-monstera';
  try {
    const body = catalogRes.json();
    if (body && Array.isArray(body.items) && body.items.length > 0) {
      plantId = body.items[0].id;
    }
  } catch (_err) {
    // keep seed id from OpenAPI example
  }
  request('plant', `${BASE_URL}/api/plants/${plantId}`);

  if (SCENARIO === 'load') {
    sleep(1);
  }
}

function metricFor(data, endpoint) {
  return data.metrics[`http_req_duration{endpoint:${endpoint}}`];
}

function trendValues(metric) {
  const values = (metric && metric.values) || {};
  return {
    p50: values['p(50)'],
    p95: values['p(95)'],
    p99: values['p(99)'],
  };
}

function thresholdOk(metric) {
  if (!metric || !metric.thresholds) return false;
  return Object.values(metric.thresholds).every((t) => t.ok === true);
}

function fmtMs(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)} ms`;
}

function buildRows(data) {
  return ENDPOINTS.map((endpoint) => {
    const metric = metricFor(data, endpoint);
    const { p50, p95, p99 } = trendValues(metric);
    const limit = limits[endpoint];
    const pass = thresholdOk(metric);
    return { endpoint, p50, p95, p99, limit, pass };
  });
}

function markdownTable(rows) {
  const lines = [
    `| endpoint | p50 | p95 | p99 | limit | result |`,
    `| --- | ---: | ---: | ---: | ---: | --- |`,
    ...rows.map(
      (r) =>
        `| ${r.endpoint} | ${fmtMs(r.p50)} | ${fmtMs(r.p95)} | ${fmtMs(r.p99)} | ${fmtMs(r.limit)} | ${r.pass ? 'pass' : 'fail'} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

export function handleSummary(data) {
  const rows = buildRows(data);
  const table = markdownTable(rows);
  const report = {
    scenario: SCENARIO,
    limits,
    endpoints: Object.fromEntries(
      rows.map((r) => [
        r.endpoint,
        {
          p50: r.p50,
          p95: r.p95,
          p99: r.p99,
          limit: r.limit,
          pass: r.pass,
        },
      ]),
    ),
  };

  const out = {
    stdout: `\nCatalog ${SCENARIO} summary\n\n${table}\n`,
    [`reports/k6/catalog-${SCENARIO}.md`]: `# Catalog ${SCENARIO}\n\n${table}`,
    [`reports/k6/catalog-${SCENARIO}.json`]: `${JSON.stringify(report, null, 2)}\n`,
  };

  if (__ENV.SAVE_BASELINE === '1') {
    const nextBaseline = Object.fromEntries(
      rows.map((r) => [
        r.endpoint,
        { p95: r.p95 == null ? null : Math.round(Number(r.p95) * 100) / 100 },
      ]),
    );
    out[BASELINE_WRITE] = `${JSON.stringify(nextBaseline, null, 2)}\n`;
  }

  return out;
}
