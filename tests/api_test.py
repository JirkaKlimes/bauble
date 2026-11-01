"""API tests against a running PocketBase with the bauble hooks.

python3 tests/api_test.py <base-url> <admin-invite-link> <superuser-email> <superuser-password>

Use tests/run_api_tests.sh, which sets up a throwaway database.
"""

import datetime
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
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


def join(token, name, email, bd, bm):
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

alex_t, alex = join(admin_token, "Alex", "alex@example.com", 20, 5)
check("join returns admin user", alex["role"] == "admin" and alex["slot"] == 0, alex)
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
mom_t, mom = join(inv["token"], "Mom", "mom@example.com", 14, 3)
check("member joined with slot 1", mom["role"] == "member" and mom["slot"] == 1, mom)
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
    {"owner": mom["id"], "title": "Mug", "pr": "high", "price": 459},
    mom_t,
)
check("owner creates wish", s == 200, (s, w1))
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
s, r = call("POST", "/api/collections/_superusers/auth-with-password", {"identity": SU_EMAIL, "password": SU_PASSWORD})
check("dashboard reachable directly", s == 200, (s, r))

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
