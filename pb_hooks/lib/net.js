/// <reference path="../../.dev/pb_data/types.d.ts" />

const { Fail, handle } = require(`${__hooks}/lib/core.js`);

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function privateIPv4(p) {
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 192 && p[1] === 0 && p[2] === 0) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19));
}

// First line of defence against SSRF. $http.send follows redirects and
// resolves DNS without a hook, so a public name can still lead to a private
// address. The NixOS module blocks private ranges at the socket level
// (IPAddressDeny); run other deployments with an equivalent egress filter.
function allowedURL(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  const m = raw.match(/^https?:\/\/([a-z0-9.-]+)(?::(\d+))?(?:[/?#]|$)/i);
  if (!m) return false; // also rejects userinfo, IPv6 literals and backslashes
  const host = m[1].toLowerCase().replace(/\.$/, ""), port = m[2];
  if (port && port !== "80" && port !== "443") return false;
  if (!host || host.indexOf("..") >= 0) return false;
  if (/^[0-9.]+$/.test(host)) {
    const p = host.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return false;
    return !privateIPv4(p);
  }
  // a name must end in an alphabetic TLD; rejects 0x7f000001, 127.1 and similar
  if (!/\.[a-z][a-z0-9-]*[a-z0-9]$/.test(host)) return false;
  if (/\.(local|localhost|internal|lan|home|arpa|test|invalid)$/.test(host)) return false;
  const extra = ($os.getenv("BAUBLE_PREVIEW_BLOCK") || "").split(",").map((s) => s.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
  return !extra.some((suf) => host === suf || host.endsWith("." + suf));
}

function fetchURL(url, accept, timeout) {
  return $http.send({ url, method: "GET", timeout, headers: { "User-Agent": UA, "Accept": accept, "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8" } });
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function meta(html, keys) {
  for (const k of keys) {
    const re1 = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\']' + k + '["\'][^>]*content=["\']([^"\']+)["\']', "i");
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name|itemprop)=["\']' + k + '["\']', "i");
    const m = html.match(re1) || html.match(re2);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}

function jsonLdPrice(html) {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1]); } catch (_) { continue; }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== "object") continue;
      if (Array.isArray(n)) { for (const x of n) stack.push(x); continue; }
      if (n.offers) stack.push(n.offers);
      if (n["@graph"]) stack.push(n["@graph"]);
      const p = n.price != null ? n.price : n.lowPrice;
      if (p != null && (n["@type"] === "Offer" || n["@type"] === "AggregateOffer" || n.priceCurrency)) return { price: p, currency: n.priceCurrency || "" };
    }
  }
  return null;
}

function absolute(u, base) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return "https:" + u;
  const m = base.match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] + (u.charAt(0) === "/" ? u : "/" + u) : "";
}

function preview(e) {
  const url = String(e.request.url.query().get("url") || "").trim();
  if (!allowedURL(url)) throw new Fail("url_blocked");
  let res;
  try {
    res = fetchURL(url, "text/html,application/xhtml+xml", 10);
  } catch (_) {
    return e.json(200, { ok: false });
  }
  if (res.statusCode >= 400) return e.json(200, { ok: false });
  const html = toString(res.body, 2500000);
  let title = meta(html, ["og:title", "twitter:title"]);
  if (!title) { const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); title = t ? decodeEntities(t[1]) : ""; }
  title = title.replace(/\s*[|–—-]\s*[^|–—-]{2,40}$/, "").slice(0, 120);
  const image = absolute(meta(html, ["og:image:secure_url", "og:image", "twitter:image"]), url);
  let price = meta(html, ["product:price:amount", "og:price:amount", "price"]);
  let currency = meta(html, ["product:price:currency", "og:price:currency", "priceCurrency"]);
  if (!price) { const j = jsonLdPrice(html); if (j) { price = String(j.price); currency = currency || j.currency; } }
  const num = parseFloat(String(price).replace(/\s/g, "").replace(",", "."));
  return e.json(200, {
    ok: !!title,
    title,
    image: allowedURL(image) ? image : "",
    price: isFinite(num) && num > 0 ? Math.round(num) : null,
    currency: String(currency || "").toUpperCase().slice(0, 3),
    store: url.match(/^https?:\/\/(?:www\.)?([^/?#:]+)/i)[1].toLowerCase(),
  });
}

module.exports = { allowedURL, fetchURL, preview: handle(preview) };
