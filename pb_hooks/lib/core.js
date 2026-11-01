/// <reference path="../../.dev/pb_data/types.d.ts" />

// PocketBase runs every hook handler in its own VM, so handlers require()
// these modules instead of sharing globals.

const MESSAGES = {
  wish_not_found: "This wish no longer exists.",
  claim_not_found: "This claim no longer exists.",
  own_wish: "You cannot buy your own wish.",
  wish_gone: "This wish is no longer on the list.",
  occ_invalid: "This occasion cannot be chosen.",
  claim_taken: "Someone else is already buying this.",
  occasion_over: "This occasion is already over.",
  not_buyer: "You are not buying this.",
  invite_invalid: "This invite is no longer valid.",
  name_required: "Enter your name.",
  email_invalid: "This email address does not look right.",
  password_short: "The password must have at least 8 characters.",
  email_taken: "Someone in the family already uses this email address.",
  url_blocked: "This link cannot be loaded.",
};

const STATUS = {
  wish_not_found: 404, claim_not_found: 404, invite_invalid: 404,
  own_wish: 403, not_buyer: 403,
  claim_taken: 409,
};

// PocketBase rewrites ApiError messages and strips unknown data, so errors
// that the client translates by code are thrown as Fail and sent as plain JSON.
class Fail extends Error {
  constructor(code, extra) {
    super(code);
    this.code = code;
    this.extra = extra || {};
  }
}

function handle(fn) {
  return (e) => {
    try {
      return fn(e);
    } catch (err) {
      if (!(err instanceof Fail)) throw err;
      const status = STATUS[err.code] || 400;
      return e.json(status, Object.assign({ status, code: err.code, message: MESSAGES[err.code] }, err.extra));
    }
  };
}

function findOrNull(fn) {
  try { return fn(); } catch (_) { return null; }
}

function body(e) { return e.requestInfo().body || {}; }

function strSlice(rec, key) {
  const v = rec.getStringSlice(key), out = [];
  for (let i = 0; i < v.length; i++) out.push(v[i]);
  return out;
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function nowUnix() { return Math.floor(Date.now() / 1000); }

// Dates use the process time zone (TZ). Gifts are revealed at local midnight
// after the occasion day.
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function pbDate(d) { return d.toISOString().replace("T", " "); }
function revealAt(day) { return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1); }

function nextOccasions(owner) {
  const today = startOfDay(new Date());
  const y = today.getFullYear();
  const bd = owner.getInt("bday_day"), bm = owner.getInt("bday_month");
  const out = [];
  for (const yy of [y, y + 1]) {
    out.push({ id: "xmas-" + yy, day: new Date(yy, 11, 24) });
    if (bd && bm) out.push({ id: "bday-" + owner.id + "-" + yy, day: new Date(yy, bm - 1, bd) });
  }
  return out.filter((o) => o.day >= today).sort((a, b) => a.day - b.day).slice(0, 2);
}

function baseURL() {
  return ($os.getenv("BAUBLE_URL") || $app.settings().meta.appURL || "http://127.0.0.1:8090").replace(/\/+$/, "");
}

module.exports = { Fail, handle, findOrNull, body, strSlice, clean, nowUnix, pbDate, revealAt, nextOccasions, baseURL };
