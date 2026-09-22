"""Repro test for 'Router action dispatched before initialization' (E668).

Exercises every path that syncs the hash router:
  - tab clicks (store change -> location.hash write)
  - deep-link load (#/review on first load)
  - reload with a hash present
  - browser back/forward through hash entries
Listens for the E668 error and any page errors on console.
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LEXILEARN_E2E_BASE", "http://127.0.0.1:3000")
errors = []

def track(page, tag):
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"[{tag}] console.{m.type}: {m.text}")
            if m.type == "error" and ("dispatched before" in m.text or "E668" in m.text or "Internal Next.js error" in m.text) else None)

def click_tab(pg, label):
    # Tab accessible names include count badges (e.g. "Learn99+"), so match by prefix.
    ok = pg.evaluate(
        """(label) => {
            const btn = [...document.querySelectorAll('button')].find(
                (b) => b.textContent.trim().startsWith(label)
            );
            if (btn) { btn.click(); return true }
            return false
        }""",
        label,
    )
    if ok:
        pg.wait_for_timeout(350)
        print(f"click {label:10s} -> hash={pg.evaluate('location.hash')}")
    else:
        print(f"click {label:10s} -> SKIPPED (no button)")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    # Skip first-run onboarding so the app shell is clickable
    ctx.add_init_script("try{localStorage.setItem('lexilearn-onboarding-v2','1')}catch(e){}")
    pg = ctx.new_page()
    track(pg, "main")

    # 1) cold load
    pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(1500)

    # 2) tab clicks (the path that used to call history.pushState)
    for label in ["Review", "Library", "Progress", "Today", "Learn"]:
        click_tab(pg, label)

    # 3) AI Coach (drill-in view)
    try:
        pg.get_by_role("button", name="AI Coach").first.click(timeout=3000)
        pg.wait_for_timeout(500)
        print(f"click AI Coach  -> hash={pg.evaluate('location.hash')}")
    except Exception as e:
        print(f"click AI Coach  -> SKIPPED ({type(e).__name__})")

    # 4) browser back twice (popstate through hash entries)
    pg.go_back(timeout=5000); pg.wait_for_timeout(300)
    pg.go_back(timeout=5000); pg.wait_for_timeout(300)
    print(f"after back x2   -> hash={pg.evaluate('location.hash')}")

    # 5) deep link straight to a hashed URL
    pg.goto(BASE + "/#/review", wait_until="domcontentloaded", timeout=20000)
    pg.wait_for_timeout(1000)
    print(f"deep link       -> hash={pg.evaluate('location.hash')}")

    # 6) reload with hash present
    pg.reload(wait_until="domcontentloaded", timeout=20000)
    pg.wait_for_timeout(1000)
    print(f"reload          -> hash={pg.evaluate('location.hash')}")

    # 7) rapid tab switching (race the store subscription)
    for label in ["Quiz", "Library", "Review", "Progress"]:
        click_tab(pg, label)
        pg.wait_for_timeout(80)
    pg.wait_for_timeout(600)

    browser.close()

print("\n=== RESULT ===")
e668 = [e for e in errors if "dispatched before" in e or "E668" in e]
other = [e for e in errors if e not in e668]
print(f"E668 occurrences: {len(e668)}")
for e in e668[:5]:
    print(" ", e[:200])
print(f"other captured errors: {len(other)}")
for e in other[:8]:
    print(" ", e[:200])
sys.exit(1 if e668 else 0)
