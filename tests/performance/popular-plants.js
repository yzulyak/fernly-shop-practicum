/**
 * Popular + catalog browse load for Fernly.
 *
 * Targets from docs/features/popular-plants.md ("How fast it must be"):
 * - ~20 shoppers browsing at once
 * - GET /api/popular: p95 ≤ 300 ms, no failures
 * - GET /api/plants: p95 ≤ 300 ms under the same load
 *
 * Usage:
 *   k6 run tests/performance/popular-plants.js                 # smoke (1 VU)
 *   k6 run -e PROFILE=load tests/performance/popular-plants.js # ~20 VUs
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:8100';
const PROFILE = __ENV.PROFILE || 'smoke';

const popularFailures = new Rate('popular_failures');
const catalogFailures = new Rate('catalog_failures');
const popularDuration = new Trend('popular_duration', true);
const catalogDuration = new Trend('catalog_duration', true);

const thresholds =
  PROFILE === 'load'
    ? {
        popular_failures: ['rate==0'],
        catalog_failures: ['rate==0'],
        popular_duration: ['p(95)<300'],
        catalog_duration: ['p(95)<300'],
        http_req_failed: ['rate==0'],
      }
    : {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<1000'],
      };

export const options =
  PROFILE === 'load'
    ? {
        scenarios: {
          busy_hour: {
            executor: 'constant-vus',
            vus: 20,
            duration: '45s',
          },
        },
        thresholds,
      }
    : {
        vus: 1,
        iterations: 1,
        thresholds,
      };

function getJson(path) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    tags: { name: path.split('?')[0] },
  });
}

export default function () {
  const popular = getJson('/api/popular?limit=4');
  popularDuration.add(popular.timings.duration);
  const popularOk = check(popular, {
    'popular status 200': (r) => r.status === 200,
    'popular has items': (r) => {
      try {
        const body = r.json();
        return body && Array.isArray(body.items);
      } catch {
        return false;
      }
    },
  });
  popularFailures.add(!popularOk || popular.status !== 200);

  const catalog = getJson('/api/plants?pageSize=24');
  catalogDuration.add(catalog.timings.duration);
  const catalogOk = check(catalog, {
    'catalog status 200': (r) => r.status === 200,
    'catalog has items': (r) => {
      try {
        const body = r.json();
        return body && Array.isArray(body.items);
      } catch {
        return false;
      }
    },
  });
  catalogFailures.add(!catalogOk || catalog.status !== 200);

  if (PROFILE === 'load') {
    sleep(0.3);
  }
}
