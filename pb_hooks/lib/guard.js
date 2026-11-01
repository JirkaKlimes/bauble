/// <reference path="../../.dev/pb_data/types.d.ts" />

// Rules hide claims from the wish owner, but a client filter or sort that
// joins through a back-relation still changes which rows come back (sorting
// wishes by claims_via_wish drops the claimed ones). The web client never
// needs joins, so they are refused outright.
const JOIN = /_via_|@collection/i;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function joinsInRequest(e, path) {
  if (path.indexOf("/api/collections/") === 0) {
    const q = e.request.url.query();
    return ["filter", "sort", "expand"].some((k) => JOIN.test(q.get(k)));
  }
  // Subscription options are JSON, where "\u005f" spells "_" only after this
  // check. The web client never sends options, so none are accepted.
  if (path === "/api/realtime" && e.request.method === "POST") {
    const subs = (e.requestInfo().body || {}).subscriptions || [];
    return subs.some((s) => String(s).indexOf("?") >= 0);
  }
  return false;
}

// The superuser dashboard is only served to direct connections (for example
// an SSH tunnel), never to anything that came through cloudflared or a proxy.
const PROXY_HEADERS = ["CF-Connecting-IP", "X-Forwarded-For", "Forwarded", "X-Real-IP"];
function proxiedAdmin(e, path) {
  if (path.indexOf("/_/") !== 0 && path.indexOf("/api/collections/_superusers/") !== 0) return false;
  return PROXY_HEADERS.some((h) => e.request.header.get(h) !== "");
}

function guard(e) {
  const path = e.request.url.path;
  if (proxiedAdmin(e, path)) return e.json(404, { status: 404, message: "Not found." });
  if (!e.hasSuperuserAuth() && joinsInRequest(e, path)) {
    return e.json(400, { status: 400, code: "query_refused", message: "Joins are not allowed in client queries." });
  }
  if (path.indexOf("/_/") !== 0) {
    const h = e.response.header();
    h.set("Content-Security-Policy", CSP);
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "no-referrer");
    h.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    h.set("Strict-Transport-Security", "max-age=31536000");
  }
  return e.next();
}

module.exports = { guard };
