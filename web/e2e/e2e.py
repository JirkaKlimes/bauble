"""Browser end-to-end run against a live PocketBase that serves web/dist.

python3 web/e2e/e2e.py http://127.0.0.1:8095 <admin-invite-link>

Screenshots go to web/e2e/shots/ (gitignored). Exits non-zero on the first failed check.
"""

import asyncio
import pathlib
import struct
import sys
import zlib

from playwright.async_api import async_playwright, Page, expect

BASE, LINK = sys.argv[1].rstrip("/"), sys.argv[2]
LINK = BASE + LINK[LINK.index("/i/") :]
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "shots"
OUT.mkdir(exist_ok=True)
# bypass_csp: Playwright polls wait_for_function strings with eval, which the server CSP forbids.
# Render on the real GPU: the Chromium in nixpkgs ships without SwiftShader.
ARGS = ["--enable-gpu", "--use-angle=gl", "--ignore-gpu-blocklist"]
SHOT_TIMEOUT = 180_000
errors: list[str] = []
pages: list[Page] = []


def face(path: pathlib.Path, rgb: tuple[int, int, int]) -> pathlib.Path:
    """A plain test photo: a coloured disc on a light background."""
    w = h = 160
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            inside = (x - 80) ** 2 + (y - 80) ** 2 < 60**2
            row += bytes(rgb if inside else (235, 225, 210))
        rows.append(bytes(row))

    def chunk(t: bytes, d: bytes) -> bytes:
        return (
            struct.pack(">I", len(d))
            + t
            + d
            + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"".join(rows)))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    return path


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what, flush=True)
    if not ok:
        print("\n".join(errors[:30]))
        sys.exit(1)


async def page(browser, mobile=False) -> Page:
    ctx = await (
        browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            locale="cs-CZ",
            bypass_csp=True,
        )
        if mobile
        else browser.new_context(
            viewport={"width": 1440, "height": 900}, locale="en-US", bypass_csp=True
        )
    )
    pg = await ctx.new_page()
    pg.set_default_timeout(60_000)
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on(
        "console",
        lambda m: errors.append(f"console {m.type}: {m.text}")
        # expected 4xx answers (bad invite, unreadable shop link) show up as resource errors
        if m.type == "error" and not m.text.startswith("Failed to load resource")
        else None,
    )
    pages.append(pg)
    return pg


async def solo(pg: Page) -> None:
    """Software WebGL is slow: only the page under test draws."""
    for other in pages:
        if other is not pg and not other.is_closed():
            await other.evaluate('window.bauble && window.bauble.pause(true)')
    await pg.evaluate('window.bauble && window.bauble.pause(false)')


async def ready(pg: Page) -> None:
    await pg.wait_for_function("window.bauble", timeout=60_000)
    await pg.evaluate("window.bauble.fast(true)")
    await solo(pg)


async def shot(pg: Page, name: str) -> None:
    await pg.screenshot(path=str(OUT / f"{name}.png"), timeout=SHOT_TIMEOUT)


async def phase(pg: Page, want: str) -> None:
    await pg.wait_for_function(
        f"window.bauble.debug().phase === '{want}'", timeout=120_000
    )


async def join(
    pg: Page,
    link: str,
    name: str,
    photo: pathlib.Path,
    email: str,
    day: int,
    month: int,
    prefix: str,
) -> None:
    await solo(pg)
    await pg.goto(link, wait_until="commit")
    await ready(pg)
    await pg.wait_for_selector("#onboard", timeout=120_000)
    await shot(pg, f"{prefix}-1-welcome")
    await pg.fill("#obName", name)
    await pg.click("#obNext1")
    await pg.set_input_files("#obFile", str(photo))
    await pg.click("#obNext2")
    await pg.select_option("#bdDay", str(day))
    await pg.select_option("#bdMonth", str(month))
    await pg.click("#obFinish")
    await pg.fill("#obEmail", email)
    await pg.fill("#obPass", "password1234")
    await shot(pg, f"{prefix}-2-account")
    await pg.click("#obJoin")
    await pg.wait_for_selector("#onboard", state="detached", timeout=120_000)
    await phase(pg, "home")
    await pg.wait_for_timeout(2000)
    await shot(pg, f"{prefix}-3-home")


async def open_member(pg: Page, name: str) -> None:
    mid = await pg.evaluate(
        "n => [...document.querySelectorAll('.blabel')].find(l => l.querySelector('b').textContent === n)?.dataset.member",
        name,
    )
    check(bool(mid), f"label for {name} exists")
    await pg.evaluate("id => window.bauble.openMember(id)", mid)
    await pg.wait_for_selector("#pName", timeout=30_000)
    await expect(pg.locator("#pName")).to_have_text(name)


async def main() -> None:
    f1, f2 = (
        face(OUT / "face1.png", (200, 60, 70)),
        face(OUT / "face2.png", (40, 90, 170)),
    )
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chromium", args=ARGS)

        anon = await page(browser)
        await anon.goto(BASE, wait_until="commit")
        await ready(anon)
        await anon.wait_for_selector("#authLogin", timeout=120_000)
        check(not await anon.evaluate("document.documentElement.classList.contains('no-gl')"), "the 3D scene runs (WebGL)")
        await shot(anon, "0-login")
        await anon.goto(BASE + "/i/aaaaaaaaaaaaaaaaaaaaaaaa", wait_until="commit")
        await ready(anon)
        await anon.wait_for_selector("#authInvalid", timeout=120_000)
        await shot(anon, "0-invalid")
        await anon.context.close()
        pages.remove(anon)

        admin = await page(browser)
        await join(admin, LINK, "Alex", f1, "alex@example.com", 20, 5, "1-admin")

        await admin.click("#meBtn")
        await admin.click('[data-pa="invite"]')
        await admin.fill("#invNote", "Máma")
        await admin.click("#invCreate")
        await admin.wait_for_selector("#invLink")
        link = await admin.input_value("#invLink")
        check("/i/" in link, "admin created an invite link")
        await shot(admin, "2-invites")
        await admin.click("#invClose")
        await admin.wait_for_selector("#invites", state="detached")
        await admin.evaluate("window.bauble.closePanel()")

        member = await page(browser, mobile=True)
        await join(member, link, "Máma", f2, "mama@example.com", 14, 3, "3-member")
        await admin.wait_for_function(
            "[...document.querySelectorAll('.blabel b')].some(b => b.textContent === 'Máma')",
            timeout=60_000,
        )
        check(True, "second member appears live for the admin")
        await solo(admin)
        await admin.wait_for_timeout(2500)
        await shot(admin, "3-admin-sees-member")
        await solo(member)
        check(
            await member.evaluate("document.documentElement.lang") == "cs",
            "cs locale picked from the browser language",
        )

        await member.click("#meBtn")
        await member.wait_for_selector("#cUrl")
        await member.fill(
            "#cUrl", "https://shop.invalid/produkt/hrnek-s-cibulakem-123456"
        )
        await member.click("#cLoad")
        await member.wait_for_selector("#cTitle", timeout=60_000)
        title = await member.input_value("#cTitle")
        check(
            title == "Hrnek s cibulakem",
            f"link preview falls back to a title from the URL ({title!r})",
        )
        await member.fill("#cPrice", "459")
        await member.click("#cSave")
        await member.click("#cNoLink")
        await member.fill("#cTitle", "Vlněné ponožky")
        await member.fill("#cPrice", "299")
        await member.click("#cSave")
        await member.wait_for_function(
            "document.querySelectorAll('#tagList [data-state=\"owner\"]').length === 2"
        )
        await member.wait_for_function(
            "![...document.querySelectorAll('#tagList [data-wish]')].some(li => li.dataset.wish.startsWith('tmp'))",
            timeout=30_000,
        )
        check(True, "member added two wishes and the server confirmed them")
        await shot(member, "4-member-list")

        await solo(admin)
        await open_member(admin, "Máma")
        mug = admin.locator("#tagList li", has_text="Hrnek s cibulakem")
        await mug.locator('[data-act="claim"]').click()
        await expect(mug).to_have_attribute("data-state", "mine")
        await admin.wait_for_timeout(1500)
        await shot(admin, "5-admin-claims")

        await solo(member)
        await member.reload(wait_until="commit")
        await ready(member)
        await phase(member, "home")
        await member.click("#meBtn")
        await member.wait_for_selector('#tagList [data-state="owner"]')
        check(
            await member.locator(".ribbon").count() == 0,
            "the owner sees no claim on her list",
        )

        requests: list[str] = []
        member.on(
            "request",
            lambda r: requests.append(f"{r.method} {r.url}")
            if "/api/collections/wishes/records/" in r.url
            and r.method in ("DELETE", "PATCH")
            else None,
        )
        await member.click(".grab")
        await member.wait_for_timeout(1500)
        socks = member.locator("#tagList li", has_text="Vlněné ponožky")
        await socks.locator('[data-act="delete"]').click()
        await expect(socks).to_have_count(0)
        await member.click("#toast button")
        await expect(
            member.locator("#tagList li", has_text="Vlněné ponožky")
        ).to_have_count(1)
        await member.wait_for_timeout(7000)
        check(not requests, "undo cancels the delete before anything is sent")

        mug_owner = member.locator("#tagList li", has_text="Hrnek s cibulakem")
        await mug_owner.locator('[data-act="delete"]').click()
        await expect(mug_owner).to_have_count(0)
        await shot(member, "6-member-deleted")
        for _ in range(40):
            if requests:
                break
            await member.wait_for_timeout(500)
        check(
            any(r.startswith("DELETE") for r in requests),
            f"delete is sent once the undo window closes ({requests})",
        )

        await solo(admin)
        await admin.wait_for_selector('#tagList [data-state="gone"]', timeout=60_000)
        check(True, "buyer sees the deleted wish as gone")
        await admin.wait_for_timeout(1000)
        await shot(admin, "7-admin-sees-gone")

        await solo(member)
        # on a phone the profile tools sit behind the "more" button
        await member.click(".ph-tools-btn")
        await member.locator('.ph-actions .lang button[lang="en"]').click()
        await expect(member.locator(".ph-kicker")).to_have_text("Your wishes")
        check(
            await member.evaluate("document.documentElement.lang") == "en",
            "language switch cs to en",
        )
        await shot(member, "8-member-en")
        await member.locator('.ph-actions .lang button[lang="cs"]').click()
        await expect(member.locator(".ph-kicker")).to_have_text("Tvoje přání")
        check(True, "language switch en to cs")
        url = member.url
        await member.evaluate("history.back()")
        await member.wait_for_selector("#panel", state="hidden", timeout=30_000)
        check(member.url == url, "back gesture closes the list and stays in the app")

        demo = await page(browser)
        await solo(demo)
        await demo.goto(BASE + "/?demo", wait_until="commit")
        await ready(demo)
        await phase(demo, "home")
        check(
            await demo.evaluate("window.bauble.debug().members") == 5,
            "demo loads a sample family",
        )
        await demo.wait_for_timeout(1500)
        await shot(demo, "9-demo")
        await demo.evaluate("window.bauble.setDay(55)")
        await demo.wait_for_timeout(5000)
        await shot(demo, "9-demo-day55")

        await browser.close()
    print("\n".join(errors[:30]) or "no browser errors")
    sys.exit(1 if errors else 0)


asyncio.run(main())
