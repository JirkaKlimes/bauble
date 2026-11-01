"""Retakes the README screenshots from the in-memory demo family.

npm --prefix web run build
nix develop -c python3 scripts/screenshots.py [name ...]

The browser clock is set to a fixed date per shot, so the scenes do not
depend on the day the script runs. Output goes to docs/ as WebP.
"""

import asyncio
import datetime
import functools
import http.server
import io
import json
import math
import pathlib
import sys
import threading
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from PIL import Image
from playwright.async_api import Browser, Page, async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"
OUT = ROOT / "docs"
TZ = "Europe/Prague"

DESKTOP = {"viewport": {"width": 1440, "height": 900}, "device_scale_factor": 1.5}
PHONE = {
    "viewport": {"width": 390, "height": 844},
    "device_scale_factor": 2,
    "is_mobile": True,
    "has_touch": True,
}

# The star on the tree turns at 0.45 rad/s (web/src/lib/scene/index.ts) and
# faces the camera every pi/0.45 seconds. Three turns also cover the intro.
SETTLE_S = 3 * math.pi / 0.45

# Snow, sparks and stars come from Math.random. A seeded generator (mulberry32)
# makes every run render the same frame. This seed keeps flakes off the hero text.
SEEDED_RANDOM = """
(() => {
  let s = 1224;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
"""

# The demo user is an admin. Members never see the time machine.
HIDE_ADMIN = "#tmWrap, [aria-controls='tm'] { display: none !important; }"


@dataclass(frozen=True)
class Shot:
    name: str
    locale: str
    day: datetime.date
    device: dict
    width: int
    member: str | None = None


SHOTS = [
    Shot("christmas", "en-GB", datetime.date(2026, 12, 12), DESKTOP, 1600),
    Shot("wishes", "en-GB", datetime.date(2026, 12, 12), DESKTOP, 1600, member="mum"),
    Shot("phone-birthday", "en-GB", datetime.date(2026, 3, 10), PHONE, 600),
    Shot("phone-quiet", "en-GB", datetime.date(2026, 8, 20), PHONE, 600),
    Shot("phone-list", "en-GB", datetime.date(2026, 12, 12), PHONE, 600, member="aunt"),
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def serve() -> http.server.ThreadingHTTPServer:
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=DIST)
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


async def page_has(page: Page, expr: str) -> bool:
    # wait_for_function polls on animation frames, which stand still while the clock is paused
    for _ in range(600):
        if await page.evaluate(expr):
            return True
        await asyncio.sleep(0.1)
    return False


async def take(browser: Browser, base: str, shot: Shot) -> None:
    ctx = await browser.new_context(locale=shot.locale, timezone_id=TZ, **shot.device)
    page = await ctx.new_page()
    await page.add_init_script(SEEDED_RANDOM)
    morning = datetime.datetime.combine(shot.day, datetime.time(10), ZoneInfo(TZ))
    # A paused clock makes every frame land on an exact time, however slowly the machine renders.
    await page.clock.install(time=morning)
    await page.clock.pause_at(morning + datetime.timedelta(seconds=1))
    await page.goto(f"{base}/?demo")
    if not await page_has(page, "!!window.bauble"):
        sys.exit(f"{shot.name}: the app did not start")
    await page.clock.run_for(round(SETTLE_S * 1000))
    if not await page.evaluate("(() => { const d = window.bauble.debug(); return !d.intro && d.phase === 'home'; })()"):
        sys.exit(f"{shot.name}: the intro did not finish")
    await page.add_style_tag(content=HIDE_ADMIN)
    if shot.member:
        await page.evaluate(f"window.bauble.openMember({json.dumps(shot.member)})")
        await page.clock.run_for(3000)
    image = Image.open(io.BytesIO(await page.screenshot()))
    image = image.resize((shot.width, round(image.height * shot.width / image.width)), Image.Resampling.LANCZOS)
    image.save(OUT / f"{shot.name}.webp", quality=82, method=6)
    await ctx.close()
    print(f"docs/{shot.name}.webp")


async def main(names: list[str]) -> None:
    if not (DIST / "index.html").exists():
        sys.exit("web/dist is missing: run npm --prefix web run build")
    OUT.mkdir(exist_ok=True)
    server = serve()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    async with async_playwright() as p:
        # Render on the real GPU: the Chromium in nixpkgs ships without SwiftShader.
        browser = await p.chromium.launch(channel="chromium", args=["--enable-gpu", "--use-angle=gl", "--ignore-gpu-blocklist"])
        for shot in SHOTS:
            if not names or shot.name in names:
                await take(browser, base, shot)
        await browser.close()
    server.shutdown()


asyncio.run(main(sys.argv[1:]))
