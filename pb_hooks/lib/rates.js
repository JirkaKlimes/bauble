/// <reference path="../../.dev/pb_data/types.d.ts" />

const { fetchURL } = require(`${__hooks}/lib/net.js`);

const ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const KEY = "bauble_rates";
const FRESH = 6 * 3600 * 1000;
const RETRY = 10 * 60 * 1000;

// European Central Bank reference rates: units of each currency for one euro.
// They change once a working day.
function fetchECB() {
  const res = fetchURL(ECB, "application/xml,text/xml", 5);
  if (res.statusCode !== 200) return null;
  const xml = toString(res.body, 200000);
  const date = (xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/) || [])[1];
  const rates = { EUR: 1 };
  const re = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g;
  let m;
  while ((m = re.exec(xml))) if (Number(m[2]) > 0) rates[m[1]] = Number(m[2]);
  return date && Object.keys(rates).length > 1 ? { date, rates } : null;
}

// Cached in the app store, which all hook VMs share. A failed fetch keeps
// the last rates and tries again after RETRY.
function current() {
  const store = $app.store();
  const old = store.get(KEY);
  if (old && Date.now() < old.until) return old;
  let got = null;
  try { got = fetchECB(); } catch (_) { /* offline or blocked: keep what we have */ }
  const next = got
    ? { until: Date.now() + FRESH, date: got.date, rates: got.rates }
    : { until: Date.now() + RETRY, date: old ? old.date : "", rates: old ? old.rates : {} };
  store.set(KEY, next);
  return next;
}

function rates(e) {
  const r = current();
  return e.json(200, { base: "EUR", date: r.date, rates: r.rates });
}

module.exports = { rates };
