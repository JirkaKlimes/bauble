"""API tests against a running PocketBase with the bauble hooks.

python3 tests/api_test.py <base-url> <admin-invite-link> <superuser-email> <superuser-password>

Use tests/run_api_tests.sh, which sets up a throwaway database.
"""

import datetime
import json
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from typing import Any

BASE = sys.argv[1].rstrip("/")
ADMIN_LINK, SU_EMAIL, SU_PASSWORD = sys.argv[2:5]
passed = failed = 0


def call(method, path, body=None, token=None) -> tuple[int, Any]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except ValueError:
            return e.code, txt


def check(name, cond, extra: Any = "") -> None:
    global passed, failed
    if cond:
        passed += 1
        print("  ok  ", name)
    else:
        failed += 1
        print("  FAIL", name, extra)


def join(token, name, email, bd, bm, **extra):
    s, r = call(
        "POST",
        "/api/bauble/join",
        {
            "token": token,
            "name": name,
            "email": email,
            "password": "password123",
            "bday_day": bd,
            "bday_month": bm,
            **extra,
        },
    )
    assert s == 200, (s, r)
    return r["token"], r["record"]


def records(col, rest=""):
    return f"/api/collections/{col}/records{rest}"


def next_occasions(user_id, bd, bm):
    today = datetime.date.today()
    occ = []
    for y in (today.year, today.year + 1):
        occ.append((datetime.date(y, 12, 24), f"xmas-{y}"))
        occ.append((datetime.date(y, bm, bd), f"bday-{user_id}-{y}"))
    return [o for d, o in sorted(occ) if d >= today][:2]


def png(width, height):
    """A PNG header declaring width x height, with a tiny body: enough for type and size checks."""
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    body = zlib.compress(b"\x00" * (width + 1)) if width * height <= 64 else zlib.compress(b"\x00" * 64)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", body) + chunk(b"IEND", b"")


def upload(method, path, fields, files, token):
    boundary = "bauble-test-boundary"
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, (name, data) in files.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode() + data + b"\r\n")
    data = b"".join(parts) + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")


def status_of(url, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


print("invites")
admin_token = ADMIN_LINK.rstrip("/").split("/")[-1]
s, r = call("GET", f"/api/bauble/invite/{admin_token}")
check("admin invite is valid", s == 200 and r["role"] == "admin", r)
s, r = call("GET", "/api/bauble/invite/aaaaaaaaaaaaaaaaaaaaaaaa")
check(
    "unknown invite is 404 invite_invalid",
    s == 404 and r["code"] == "invite_invalid",
    (s, r),
)
s, r = call(
    "POST",
    records("users"),
    {
        "email": "x@example.com",
        "password": "password123",
        "passwordConfirm": "password123",
        "name": "X",
    },
)
check("public sign-up is blocked", s in (400, 403), (s, r))
s, r = call(
    "POST",
    "/api/bauble/join",
    {"token": admin_token, "name": "A", "email": "bad", "password": "password123"},
)
check(
    "bad email gives email_invalid", s == 400 and r["code"] == "email_invalid", (s, r)
)

alex_t, alex = join(admin_token, "Alex", "alex@example.com", 20, 5, lang="cs", currency="CZK")
check("join returns admin user", alex["role"] == "admin" and alex["slot"] == 0, alex)
check(
    "a command-line invite takes the browser's currency and language",
    alex["currency"] == "CZK" and alex["lang"] == "cs",
    alex,
)
s, r = call(
    "POST",
    "/api/bauble/join",
    {
        "token": admin_token,
        "name": "Y",
        "email": "y@example.com",
        "password": "password123",
    },
)
check("invite is single use", s == 404 and r["code"] == "invite_invalid", (s, r))

s, inv = call("POST", records("invites"), {"note": "Mom", "role": "member"}, alex_t)
check(
    "admin creates invite",
    s == 200
    and len(inv.get("token", "")) == 24
    and inv.get("created_by") == alex["id"],
    (s, inv),
)
s, r = call(
    "POST",
    records("invites"),
    {"note": "x", "role": "member", "token": "a" * 24},
    alex_t,
)
check("invite token cannot be chosen", s in (400, 403), (s, r))
mom_t, mom = join(inv["token"], "Mom", "mom@example.com", 14, 3, lang="xx", currency="USD")
check("member joined with slot 1", mom["role"] == "member" and mom["slot"] == 1, mom)
check(
    "an invited member takes the inviter's currency, an unknown language is left empty",
    mom["currency"] == "CZK" and mom["lang"] == "",
    mom,
)
s, r = call("POST", records("invites"), {"note": "Hack", "role": "admin"}, mom_t)
check("member cannot create invites", s in (400, 403), (s, r))
s, r = call("GET", records("invites"), None, mom_t)
check("member cannot list invites", s == 200 and r["totalItems"] == 0, r)

s, inv2 = call("POST", records("invites"), {"note": "Dad", "role": "member"}, alex_t)
dad_t, dad = join(inv2["token"], "Dad", "dad@example.com", 2, 7)

print("users")
s, r = call("GET", records("users"), None, mom_t)
check("family can list each other", s == 200 and r["totalItems"] == 3, r)
check(
    "emails are hidden from others",
    all(not u.get("email") or u["id"] == mom["id"] for u in r["items"]),
    r["items"],
)
s, r = call("PATCH", records("users", f"/{mom['id']}"), {"role": "admin"}, mom_t)
check("cannot promote yourself", s in (400, 403, 404), (s, r))
s, r = call("PATCH", records("users", f"/{alex['id']}"), {"name": "Pwned"}, mom_t)
check("cannot edit someone else", s in (403, 404), (s, r))
s, r = call("PATCH", records("users", f"/{mom['id']}"), {"voc": "mami"}, mom_t)
check("can edit own profile", s == 200 and r["voc"] == "mami", (s, r))
s, r = call("PATCH", records("users", f"/{mom['id']}"), {"lang": "en", "currency": "GBP"}, mom_t)
check("can set own language and currency", s == 200 and r["lang"] == "en" and r["currency"] == "GBP", (s, r))
for bad in [{"lang": "de"}, {"currency": "gbp"}, {"currency": ""}]:
    s, r = call("PATCH", records("users", f"/{mom['id']}"), bad, mom_t)
    check(f"refuses {bad}", s == 400, (s, r))
s, r = call("GET", records("users"))
check(
    "anonymous cannot list users",
    (s == 200 and r["totalItems"] == 0) or s in (401, 403),
    (s, r),
)

print("wishes")
s, w1 = call(
    "POST",
    records("wishes"),
    {"owner": mom["id"], "title": "Mug", "pr": "high", "price": 459, "currency": "CZK"},
    mom_t,
)
check("owner creates wish", s == 200, (s, w1))
s, r = call(
    "POST",
    records("wishes"),
    {"owner": mom["id"], "title": "Lighter", "pr": "nice", "price": 38.95, "currency": "USD"},
    mom_t,
)
check("a price keeps its currency and cents", s == 200 and r["price"] == 38.95 and r["currency"] == "USD", (s, r))
for bad in [{"price": 5}, {"currency": "USD"}, {"price": 5, "currency": "usd"}]:
    s, r = call("POST", records("wishes"), {"owner": mom["id"], "title": "x", "pr": "nice", **bad}, mom_t)
    check(f"wish refuses {bad}", s == 400, (s, r))
s, r = call(
    "POST",
    records("wishes"),
    {"owner": alex["id"], "title": "Fake", "pr": "high"},
    mom_t,
)
check("cannot create wish for someone else", s in (400, 403), (s, r))
s, r = call(
    "POST",
    records("wishes"),
    {"id": "abcdefghijklmno", "owner": mom["id"], "title": "x", "pr": "nice"},
    mom_t,
)
check("client cannot choose wish id", s in (400, 403), (s, r))
s, r = call(
    "POST",
    records("wishes"),
    {"owner": mom["id"], "title": "x", "pr": "nice", "url": "javascript:alert(1)"},
    mom_t,
)
check("javascript: url rejected", s == 400, (s, r))
s, w2 = call(
    "POST",
    records("wishes"),
    {"owner": mom["id"], "title": "Socks", "pr": "nice"},
    mom_t,
)
s, w3 = call(
    "POST",
    records("wishes"),
    {"owner": mom["id"], "title": "Book", "pr": "nice"},
    mom_t,
)
s, r = call("PATCH", records("wishes", f"/{w2['id']}"), {"owner": alex["id"]}, mom_t)
check("cannot give a wish away", s in (400, 403, 404), (s, r))
s, r = call("PATCH", records("wishes", f"/{w3['id']}"), {"price": 12.5, "currency": "EUR"}, mom_t)
check("a price can be added later", s == 200 and r["currency"] == "EUR", (s, r))
s, r = call("PATCH", records("wishes", f"/{w3['id']}"), {"price": 0}, mom_t)
check("removing a price without its currency is refused", s == 400, (s, r))
s, r = call("PATCH", records("wishes", f"/{w3['id']}"), {"price": 0, "currency": ""}, mom_t)
check("a price and its currency go together", s == 200 and r["currency"] == "", (s, r))

print("claims")
occ_now, occ_later = next_occasions(mom["id"], 14, 3)
s, c1 = call("POST", "/api/bauble/claims", {"wish": w1["id"]}, alex_t)
check(
    "claim defaults to next occasion",
    s == 200 and c1["occ"] == occ_now and c1["by"] == [alex["id"]],
    (s, c1),
)
s, r = call("POST", "/api/bauble/claims", {"wish": w1["id"]}, dad_t)
check(
    "double claim is 409 with the claim",
    s == 409 and r["code"] == "claim_taken" and r["claim"]["id"] == c1["id"],
    (s, r),
)
s, r = call("POST", "/api/bauble/claims", {"wish": w1["id"]}, mom_t)
check("owner cannot claim own wish", s == 403 and r["code"] == "own_wish", (s, r))
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/join", {}, dad_t)
check(
    "join adds second buyer",
    s == 200 and set(r["by"]) == {alex["id"], dad["id"]},
    (s, r),
)
s, r = call("GET", records("claims"), None, mom_t)
check("owner cannot list claims on her wishes", s == 200 and r["totalItems"] == 0, r)
s, r = call("GET", records("claims", f"/{c1['id']}"), None, mom_t)
check("owner cannot view the claim", s == 404, (s, r))
for action in ("join", "leave", "occ"):
    s, r = call(
        "POST", f"/api/bauble/claims/{c1['id']}/{action}", {"occ": occ_later}, mom_t
    )
    check(
        f"owner {action} looks like a missing claim",
        s == 404 and r["code"] == "claim_not_found" and '"by"' not in json.dumps(r),
        (s, r),
    )
s, r = call("GET", records("claims"), None, dad_t)
check("others can see claims", s == 200 and r["totalItems"] == 1, r)
s, r = call(
    "POST",
    records("claims"),
    {
        "wish": w2["id"],
        "by": [dad["id"]],
        "occ": occ_now,
        "reveal_at": "2030-01-01 00:00:00.000Z",
    },
    dad_t,
)
check("raw claim create is blocked", s in (400, 403), (s, r))
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/occ", {"occ": "xmas-1999"}, alex_t)
check("invalid occasion rejected", s == 400 and r["code"] == "occ_invalid", (s, r))
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/occ", {"occ": occ_later}, alex_t)
check("move claim to the other occasion", s == 200 and r["occ"] == occ_later, (s, r))
s, inv3 = call("POST", records("invites"), {"role": "member"}, alex_t)
kid_t, kid = join(inv3["token"], "Kid", "kid@example.com", 1, 1)
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/occ", {"occ": occ_now}, kid_t)
check("non-buyer cannot move claim", s == 403 and r["code"] == "not_buyer", (s, r))
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/leave", {}, kid_t)
check("non-buyer cannot leave", s == 403 and r["code"] == "not_buyer", (s, r))

print("owner cannot detect claims")
for name, query in [
    (
        "filter back-relation",
        "?filter=" + urllib.parse.quote('claims_via_wish.id != ""'),
    ),
    ("sort back-relation", "?sort=claims_via_wish.created"),
    ("expand back-relation", "?expand=claims_via_wish"),
    (
        "@collection join",
        "?filter=" + urllib.parse.quote("@collection.claims.wish ?= id"),
    ),
]:
    s, r = call("GET", records("wishes", query), None, mom_t)
    check(
        f"{name} refused",
        s == 400 and isinstance(r, dict) and r.get("code") == "query_refused",
        (s, r),
    )
s, r = call(
    "POST",
    "/api/realtime",
    {
        "clientId": "x",
        "subscriptions": [
            "wishes/*?options="
            + urllib.parse.quote(
                json.dumps({"query": {"filter": 'claims_via_wish.id != ""'}})
            )
        ],
    },
    mom_t,
)
check("realtime back-relation refused", s == 400, (s, r))

print("owner delete is uniform")
s1, _ = call("DELETE", records("wishes", f"/{w1['id']}"), None, mom_t)
s2, _ = call("DELETE", records("wishes", f"/{w3['id']}"), None, mom_t)
check("delete claimed and unclaimed both 204", s1 == s2 == 204, (s1, s2))
for verb, body in (
    ("GET", None),
    ("PATCH", {"title": "x"}),
    ("PATCH", {"gone": ""}),
    ("DELETE", None),
):
    a, _ = call(verb, records("wishes", f"/{w1['id']}"), body, mom_t)
    b, _ = call(verb, records("wishes", f"/{w3['id']}"), body, mom_t)
    check(
        f'owner {verb} {body or ""} same for claimed and unclaimed',
        a == b == 404,
        (a, b),
    )
s, r = call("GET", records("wishes", f"/{w1['id']}"), None, alex_t)
check("buyer still sees gone=deleted", s == 200 and r["gone"] == "deleted", (s, r))
s, r = call("POST", "/api/bauble/claims", {"wish": w3["id"]}, dad_t)
check("cannot claim a gone wish", s == 400 and r["code"] == "wish_gone", (s, r))

s, su = call(
    "POST",
    "/api/collections/_superusers/auth-with-password",
    {"identity": SU_EMAIL, "password": SU_PASSWORD},
)
s, r = call("POST", "/api/crons/bauble_purge", {}, su["token"])
check("purge job runs", s == 204, (s, r))
for _ in range(20):  # the cron endpoint runs the job in the background
    s, r = call("GET", records("wishes", f"/{w3['id']}"), None, alex_t)
    if s == 404:
        break
    time.sleep(0.1)
check("purge removed unclaimed gone wish", s == 404, (s, r))
s, r = call("GET", records("wishes", f"/{w1['id']}"), None, alex_t)
check("purge kept claimed gone wish", s == 200, (s, r))

s, r = call("POST", f"/api/bauble/claims/{c1['id']}/leave", {}, dad_t)
check("first buyer leaves, claim stays", s == 200 and r["deleted"] is False, (s, r))
s, r = call("POST", f"/api/bauble/claims/{c1['id']}/leave", {}, alex_t)
check(
    "last buyer leaves, claim and gone wish removed",
    s == 200 and r["deleted"] and r["wishDeleted"],
    (s, r),
)

s, r = call("PATCH", records("wishes", f"/{w2['id']}"), {"gone": "got"}, mom_t)
check("owner marks a wish as already had", s in (200, 404), (s, r))
s, r = call("PATCH", records("wishes", f"/{w2['id']}"), {"gone": ""}, mom_t)
check("owner cannot touch it afterwards", s == 404, (s, r))

print("family")
s, r = call("GET", records("family", "/family000000000"))
check("anyone can read the gift day", s == 200 and r["christmas"] == "eve", (s, r))
s, r = call("GET", records("family"))
check("the family settings cannot be listed", s == 403, (s, r))
s, r = call("PATCH", records("family", "/family000000000"), {"christmas": "day"}, alex_t)
check("the gift day only changes through the API", s in (403, 404), (s, r))
s, r = call("POST", "/api/bauble/family", {"christmas": "day"}, mom_t)
check("a member cannot change the gift day", s == 403 and r["code"] == "admin_only", (s, r))
s, r = call("POST", "/api/bauble/family", {"christmas": "dec25"}, alex_t)
check("the gift day is eve or day", s == 400 and r["code"] == "christmas_invalid", (s, r))
today = datetime.date.today()
in_season = datetime.date(today.year, 10, 15) <= today <= datetime.date(today.year, 12, 26)
s, r = call("POST", "/api/bauble/family", {"christmas": "day"}, alex_t)
if in_season:
    check("the gift day is fixed during the season", s == 400 and r["code"] == "christmas_locked", (s, r))
else:
    check("an admin changes the gift day", s == 200 and r["christmas"] == "day", (s, r))
    call("POST", "/api/bauble/family", {"christmas": "eve"}, alex_t)

print("rates")
s, r = call("GET", "/api/bauble/rates")
check(
    "rates are public, in euros, and empty when the ECB cannot be reached",
    s == 200 and r["base"] == "EUR" and isinstance(r["rates"], dict) and (not r["rates"] or r["rates"]["EUR"] == 1),
    (s, r),
)

print("reveal")
s, r = call("POST", "/api/bauble/reveal", {}, mom_t)
check("reveal works with nothing to reveal", s == 200 and r["revealed"] == 0, (s, r))

print("preview")
for url in [
    "http://127.0.0.1:8091/",
    "http://x@127.0.0.1/",
    "http://localhost/",
    "http://0x7f000001/",
    "http://127.1/",
    "http://[::1]/",
    "http://10.0.0.1/",
    "http://100.64.0.1/",
    "http://printer.local/",
    "http://example.com:8080/",
    "ftp://example.com/",
    "http://example.com\\@127.0.0.1/",
    "http://nas.blocked.example/",
]:
    s, r = call(
        "GET", "/api/bauble/preview?url=" + urllib.parse.quote(url), None, alex_t
    )
    check(f"preview blocks {url}", s == 400 and r["code"] == "url_blocked", (s, r))
s, r = call("GET", "/api/bauble/preview?url=https://example.com/")
check("preview needs auth", s in (401, 403), (s, r))

print("review findings")
escaped = json.dumps({"query": {"filter": 'title != "" || claims\\u005fvia\\u005fwish.id = ""'}})
s, r = call("POST", "/api/realtime", {"clientId": "x", "subscriptions": ["wishes/*?options=" + urllib.parse.quote(escaped)]}, mom_t)
check("realtime options with escapes refused", s == 400, (s, r))

s, r = upload("POST", records("wishes"), {"owner": mom["id"], "title": "Huge", "pr": "nice"}, {"image": ("bomb.png", png(20000, 20000))}, mom_t)
check("image declaring 20000x20000 px refused", s == 400 and r.get("code") == "image_too_large", (s, r))
s, r = upload("PATCH", records("users", f"/{mom['id']}"), {}, {"avatar": ("bomb.png", png(20000, 20000))}, mom_t)
check("avatar declaring 20000x20000 px refused", s == 400 and r.get("code") == "image_too_large", (s, r))
s, w5 = upload("POST", records("wishes"), {"owner": mom["id"], "title": "Scarf", "pr": "nice"}, {"image": ("scarf.png", png(4, 4))}, mom_t)
check("small image accepted", s == 200 and w5.get("image"), (s, w5))
s, c5 = call("POST", "/api/bauble/claims", {"wish": w5["id"]}, alex_t)
call("DELETE", records("wishes", f"/{w5['id']}"), None, mom_t)
call("POST", "/api/crons/bauble_purge", {}, su["token"])
time.sleep(0.5)
file_url = f"{BASE}/api/files/wishes/{w5['id']}/{w5['image']}"
s, mom_ft = call("POST", "/api/files/token", {}, mom_t)
s, alex_ft = call("POST", "/api/files/token", {}, alex_t)
check("wish image needs a file token", status_of(file_url) == 404)
check("owner cannot read the image of a removed wish", status_of(f"{file_url}?token={mom_ft['token']}") == 404)
check("buyer still reads it", status_of(f"{file_url}?token={alex_ft['token']}") == 200)

s, r = call("PATCH", records("users", f"/{mom['id']}"), {"bday_day": 1, "bday_month": 11}, mom_t)
check("birthday cannot be moved once set", s in (400, 403, 404), (s, r))
s, invb = call("POST", records("invites"), {"role": "member"}, alex_t)
s, r = call("POST", "/api/bauble/join", {"token": invb["token"], "name": "Nobday", "email": "nobday@example.com", "password": "password123"})
nb_t, nb = r["token"], r["record"]
s, r = call("PATCH", records("users", f"/{nb['id']}"), {"bday_day": 3, "bday_month": 4}, nb_t)
check("birthday can be set once", s == 200 and r["bday_month"] == 4, (s, r))
s, r = call("PATCH", records("users", f"/{nb['id']}"), {"bday_day": 4, "bday_month": 4}, nb_t)
check("and then not changed", s in (400, 403, 404), (s, r))

su_id = su["record"]["collectionId"]
proxied = urllib.request.Request(
    BASE + f"/api/collections/{su_id}/auth-with-password",
    data=json.dumps({"identity": SU_EMAIL, "password": SU_PASSWORD}).encode(),
    headers={"Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9"},
    method="POST",
)
try:
    with urllib.request.urlopen(proxied, timeout=20) as res:
        proxied_status = res.status
except urllib.error.HTTPError as e:
    proxied_status = e.code
check("superuser login by collection id refused through a proxy", proxied_status == 404, proxied_status)
for col in (su_id, "_Superusers"):
    st = status_of(f"{BASE}/api/collections/{col}/auth-methods", {"CF-Connecting-IP": "203.0.113.9"})
    check(f"superuser collection {col} hidden through a proxy", st == 404, st)
s, r = call("POST", f"/api/collections/{su_id}/auth-with-password", {"identity": SU_EMAIL, "password": SU_PASSWORD})
check("superuser login works directly", s == 200, (s, r))

print("headers")
with urllib.request.urlopen(BASE + "/api/health") as res:
    csp = res.headers.get("Content-Security-Policy", "")
check(
    "responses carry CSP",
    "script-src 'self'" in csp and "frame-ancestors 'none'" in csp,
    csp,
)

req = urllib.request.Request(BASE + "/_/", headers={"CF-Connecting-IP": "203.0.113.9"})
try:
    with urllib.request.urlopen(req) as res:
        status = res.status
except urllib.error.HTTPError as e:
    status = e.code
check("dashboard refused through a proxy", status == 404, status)
time.sleep(3.1)  # *:auth allows 2 requests per 3 s
s, r = call("POST", "/api/collections/_superusers/auth-with-password", {"identity": SU_EMAIL, "password": SU_PASSWORD})
check("dashboard reachable directly", s == 200, (s, r))

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
