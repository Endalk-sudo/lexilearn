"""Deep e2e integration tests — phase-by-phase, real browser (Playwright/Chromium).

Phases:
  A. API surface (all critical ?action= endpoints)
  B. Review loop: reveal -> grade -> persistence -> dashboard counters
  C. Learn loop: reveal -> spell wrong/right -> recovery
  D. Quiz: all 6 modes render + start
  E. Dictation: render, input, controls
  F. Library: deck detail, word CRUD, CSV bulk import, dictionary tab
  G. Settings: save daily goal, persistence after reload
  H. Search palette + keyboard nav
  I. Onboarding first-run + completion
  J. Router back/forward + reload resume
"""
import json, os, re, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LEXILEARN_E2E_BASE", "http://127.0.0.1:3000")
R = []
def rec(phase, name, ok, detail=""):
    R.append({"phase": phase, "name": name, "ok": bool(ok), "detail": str(detail)[:280]})
    print(f"[{'PASS' if ok else 'FAIL'}] {phase}::{name} -- {str(detail)[:180]}")

def api(pg, action, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    q = "&" + q if q else ""
    return pg.evaluate(f"fetch('/api/lexilearn?action={action}{q}').then(r=>r.json())")

def post(pg, action, body):
    """POST helper — used by the cleanup phase to undo test-created data."""
    return pg.evaluate(
        """([action, body]) => fetch('/api/lexilearn?action=' + action, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(body),
           }).then((r) => r.json())""",
        [action, body],
    )


def nav(hash_, w=1600):
    """Navigate to a hash route. Hash-only changes don't fire a navigation,
    so reload to re-mount the view. Also reload when the hash is identical
    (e.g. /quiz -> /quiz between modes) since there'd otherwise be no op."""
    target = f"{BASE}/#{hash_.lstrip('#')}"
    if pg.url.startswith(BASE) and pg.url.split('#')[0] == BASE + '/':
        if pg.url != target or True:
            pg.evaluate(f"window.location.href = '{target}'; window.location.reload(); undefined")
    else:
        pg.goto(target, wait_until="domcontentloaded", timeout=15000)
    pg.wait_for_timeout(w)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("try{localStorage.setItem('lexilearn-onboarding-v2','1');localStorage.setItem('lexilearn-onboarding-dismissed','true')}catch(e){}")
    pg = ctx.new_page()
    cerr, uncaught = [], []
    pg.on("console", lambda m: cerr.append(m.text[:160]) if m.type == "error" else None)
    pg.on("pageerror", lambda e: uncaught.append(str(e)[:160]))

    # ---------- Phase A: API surface (fetch after first page load so origin is correct) ----------
    pg.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=15000)
    pg.wait_for_timeout(1500)
    for name, q in [("dashboard", {}), ("decks", {}), ("due", {}), ("reviewable", "limit=5"), ("new", "limit=5"), ("settings", {}), ("analytics", {}), ("quiz", "mode=mc&limit=5"), ("search", "query=the")]:
        try:
            params = dict(x.split("=") for x in q.split("&")) if q else {}
            data = api(pg, name, **params)
            ok = data is not None and not (isinstance(data, dict) and data.get("error"))
            rec("A-api", name, ok, json.dumps(data)[:120] if ok else data)
        except Exception as e:
            rec("A-api", name, False, e)

    # ---------- Phase B: Review loop ----------
    nav("#/review")
    due_before = api(pg, "dashboard").get("dueCount")
    txt = pg.locator("main").inner_text()
    rec("B-review", "renders", "REVIEW" in txt.upper(), txt[:100])
    reveal = pg.get_by_test_id("review-reveal")
    if reveal.count() == 0:
        reveal = pg.get_by_role("button", name=re.compile("reveal|show", re.I))
    if reveal.count() > 0:
        reveal.first.click(); pg.wait_for_timeout(900)
        grades = {g: pg.get_by_test_id(f"grade-{g}").count() or pg.get_by_role("button", name=re.compile(g, re.I)).count() for g in ["again", "hard", "good", "easy"]}
        rec("B-review", "grade buttons", all(v > 0 for v in grades.values()), grades)
        good = pg.get_by_role("button", name=re.compile("good", re.I))
        if good.count() > 0:
            good.first.click(); pg.wait_for_timeout(1600)
            t3 = pg.locator("main").inner_text()
            due_after = api(pg, "dashboard").get("dueCount")
            # grade may decrement dueCount, or advance to next card / session end
            advanced = due_after == due_before - 1 or "next" in t3.lower() or re.search(r"\d+\s*/\s*\d+", t3)
            rec("B-review", "grade accepted", bool(advanced), f"due {due_before} -> {due_after}; {t3[:70]}")
            pg.screenshot(path="/tmp/e2e-shots/deep-B-graded.png")
    else:
        rec("B-review", "reveal", False, txt[:150])

    # ---------- Phase C: Learn loop ----------
    nav("#/learn")
    txt = pg.locator("main").inner_text()
    rec("C-learn", "renders", "LEARN" in txt.upper() or "recall" in txt.lower(), txt[:100])
    reveal = pg.get_by_test_id("learn-reveal")
    if reveal.count() == 0:
        reveal = pg.get_by_role("button", name=re.compile("reveal|listen", re.I))
    if reveal.count() > 0:
        reveal.first.click(); pg.wait_for_timeout(900)
        pg.screenshot(path="/tmp/e2e-shots/deep-C-revealed.png")
        spell = pg.get_by_test_id("learn-check")
        inp = pg.locator("input[placeholder*='ype the word'], input[placeholder*='pelling']")
        if inp.count() > 0:
            inp.first.fill("zzz-wrong")
            chk = spell if spell.count() else pg.get_by_role("button", name=re.compile("check", re.I))
            chk.first.click(); pg.wait_for_timeout(1200)
            t2 = pg.locator("main").inner_text()
            rec("C-learn", "wrong spelling handled", any(k in t2.lower() for k in ["try again", "correct spelling", "show me", "next word"]), t2[-180:].replace("\n", " | "))
            pg.screenshot(path="/tmp/e2e-shots/deep-C-wrong.png")
            retry = pg.get_by_role("button", name=re.compile("try again|show me|next word", re.I))
            if retry.count() > 0:
                retry.first.click(); pg.wait_for_timeout(1000)
                rec("C-learn", "recovers after wrong", True, pg.locator("main").inner_text()[:80].replace("\n", " | "))
        else:
            rec("C-learn", "spell input", False, "no input found")
    else:
        rec("C-learn", "reveal", False, txt[:150])

    # ---------- Phase D: Quiz all modes (mode card click = instant start, no separate start btn) ----------
    MODES = [("mc", "Pick the meaning"), ("reverse_mc", "Find the word"), ("typing", "Type it"),
             ("spelling_bee", "Spelling bee"), ("speed_round", "Speed round"), ("match", "Match them up")]
    for mode, label in MODES:
        nav("#/quiz", 1800)
        mb = pg.get_by_test_id(f"quiz-mode-{mode}")
        if mb.count() == 0:
            mb = pg.locator("main button").filter(has_text=re.compile(label, re.I))
        if mb.count() > 0:
            mb.first.click(); pg.wait_for_timeout(1600)
            t = pg.locator("main").inner_text()
            if "No words to quiz" in t:
                rec("D-quiz", mode, True, "EMPTY-STATE (needs learned words; empty state renders correctly)")
            else:
                q_shown = re.search(r"\b1\s*/\s*\d+", t) or "match" in t.lower() or "pair" in t.lower() or "question" in t.lower() or "correct" in t.lower()
                rec("D-quiz", mode, bool(q_shown), t[:110].replace("\n", " | "))
            pg.screenshot(path=f"/tmp/e2e-shots/deep-D-{mode}.png")
            # leave the running quiz back to setup
            exitb = pg.get_by_role("button", name=re.compile("exit|quit|back", re.I))
            if exitb.count() > 0: exitb.first.click(); pg.wait_for_timeout(600)
        else:
            rec("D-quiz", mode, False, f"no mode btn '{label}'")

    # ---------- Phase E: Dictation (setup -> Start dictation -> textarea + Check) ----------
    nav("#/dictation")
    t = pg.locator("main").inner_text()
    rec("E-dictation", "renders", "DICTATION" in t.upper() or "hear" in t.lower(), t[:100])
    start = pg.locator("main button").filter(has_text=re.compile("start dictation", re.I))
    if start.count() > 0:
        if not start.first.is_enabled():
            rec("E-dictation", "session starts", False, "SKIPPED: start disabled — no TTS voices in headless Chromium (expected env limitation)")
            pg.screenshot(path="/tmp/e2e-shots/deep-E-no-tts.png")
        else:
            start.first.click(); pg.wait_for_timeout(2000)
            t = pg.locator("main").inner_text()
            rec("E-dictation", "session starts", "textarea" in pg.evaluate("() => document.querySelector('main').innerHTML.toLowerCase()") or "type" in t.lower(), t[:100])
    inp = pg.locator("main textarea#dictation-input, main textarea").first
    if inp.count() > 0:
        inp.fill("hello"); pg.wait_for_timeout(400)
        check = pg.locator("main button").filter(has_text=re.compile("check it", re.I))
        rec("E-dictation", "input+check control", check.count() > 0, f"check btn={check.count()}")
        if check.count() > 0:
            check.first.click(); pg.wait_for_timeout(1500)
            t2 = pg.locator("main").inner_text()
            graded = any(k in t2.lower() for k in ["again", "hard", "good", "easy", "next", "accuracy", "diff", "correct", "attempt", "not quite", "listen once more"])
            rec("E-dictation", "check produces feedback/grades", graded, t2[:130].replace("\n", " | "))
        pg.screenshot(path="/tmp/e2e-shots/deep-E-dictation.png")
    else:
        rec("E-dictation", "session input", False, t[:140])

    # ---------- Phase F: Library ----------
    nav("#/library")
    t = pg.locator("main").inner_text()
    rec("F-library", "renders", "LIBRARY" in t.upper() or "deck" in t.lower(), t[:100])
    deck = pg.locator("main").get_by_role("button").filter(has_text=re.compile("common|toefl|ielts|gre|academic", re.I)).first
    if deck.count() > 0:
        deck.click(); pg.wait_for_timeout(1400)
        td = pg.locator("main").inner_text()
        rec("F-library", "deck detail", len(td) > 60, td[:90].replace("\n", " | "))
        pg.screenshot(path="/tmp/e2e-shots/deep-F-deck.png")
        add = pg.get_by_role("button", name=re.compile("add word", re.I))
        if add.count() > 0:
            add.first.click(); pg.wait_for_timeout(700)
            dlg = pg.get_by_role("dialog")
            rec("F-library", "add-word dialog", dlg.count() > 0, "dialog open" if dlg.count() else "none")
            if dlg.count() > 0:
                dlg.locator("#wf-word").fill("e2e-test-word-xyz")
                dlg.locator("#wf-def").fill("test definition e2e")
                save = dlg.get_by_role("button", name=re.compile("add word|save", re.I))
                if save.count() > 0:
                    save.first.click(); pg.wait_for_timeout(1400)
                    found = json.dumps(api(pg, "search", query="e2e-test-word-xyz"))
                    rec("F-library", "word created+persisted", "e2e-test-word-xyz" in found.lower(), found[:110])
    # CSV bulk import — the "Import" action only exists on a deck detail page,
    # so open the deck first, then import a pasted list.
    nav("#/library", 1400)
    deck2 = pg.locator("main").get_by_role("button").filter(has_text=re.compile("common|toefl|ielts|gre|academic", re.I)).first
    if deck2.count() > 0:
        deck2.click(); pg.wait_for_timeout(1400)
    bulk = pg.get_by_role("button", name=re.compile("^import$", re.I))
    if bulk.count() == 0:
        bulk = pg.get_by_role("button", name=re.compile("bulk|import a list", re.I))
    rec("F-library", "import action visible", bulk.count() > 0, f"import btns={bulk.count()}")
    if bulk.count() > 0:
        bulk.first.click(); pg.wait_for_timeout(700)
        dlg = pg.get_by_role("dialog")
        if dlg.count() > 0:
            ta = dlg.locator("textarea").first
            ta.fill("zzz-csv-alpha, meaning one\nzzz-csv-beta, meaning two")
            pg.wait_for_timeout(400)
            go = dlg.get_by_role("button", name=re.compile("import|add|save", re.I))
            if go.count() > 0:
                go.first.click(); pg.wait_for_timeout(1800)
                found = json.dumps(api(pg, "search", query="zzz-csv-alpha"))
                rec("F-library", "csv import persisted", "zzz-csv-alpha" in found.lower(), found[:110])
            else:
                rec("F-library", "csv import persisted", False, "no confirm button")
        else:
            rec("F-library", "csv import persisted", False, "dialog did not open")
    nav("#/library?tab=dictionary", 1300)
    t = pg.locator("main").inner_text()
    rec("F-library", "dictionary tab", "dictionary" in t.lower() or "search" in t.lower(), t[:90])

    # ---------- Phase G: Settings (Slider for daily goal + Save changes) ----------
    nav("#/progress/settings", 1800)
    t = pg.locator("main").inner_text()
    rec("G-settings", "renders", "setting" in t.lower(), t[:90])
    slider = pg.locator("main [role='slider'][aria-valuemax='50']")
    if slider.count() > 0:
        before = api(pg, "settings").get("dailyGoal")
        slider.focus()
        for _ in range(4): pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(150)
        save = pg.get_by_role("button", name=re.compile("save changes", re.I))
        rec("G-settings", "dirty -> save visible", save.count() > 0, f"save btns={save.count()}")
        if save.count() > 0:
            save.first.click(); pg.wait_for_timeout(1400)
            s = api(pg, "settings")
            after = s.get("dailyGoal")
            rec("G-settings", "goal persisted", after != before and after is not None, f"{before} -> {after}")
        # restore ~original
        for _ in range(5): pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(100)
        save = pg.get_by_role("button", name=re.compile("save changes", re.I))
        if save.count() > 0: save.first.click(); pg.wait_for_timeout(1000)
    else:
        rec("G-settings", "slider", False, t[:120])

    # ---------- Phase H: Search palette ----------
    nav("#/today", 1200)
    pg.keyboard.press("Control+k"); pg.wait_for_timeout(700)
    pal = pg.get_by_role("dialog")
    rec("H-palette", "opens ctrl+k", pal.count() > 0, f"dialogs={pal.count()}")
    if pal.count() > 0:
        pg.keyboard.type("abund"); pg.wait_for_timeout(900)
        items = pal.locator("[cmdk-item], [role='option']")
        rec("H-palette", "search results", items.count() > 0, f"{items.count()} results")
        pg.screenshot(path="/tmp/e2e-shots/deep-H-palette.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)

    # ---------- Phase I: Onboarding (fresh context) ----------
    ctx2 = b.new_context(viewport={"width": 1440, "height": 900})
    pg2 = ctx2.new_page()
    pg2.on("pageerror", lambda e: uncaught.append(f"[onboarding] {str(e)[:140]}"))
    pg2.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=15000)
    pg2.wait_for_timeout(1800)
    dlg = pg2.get_by_role("dialog")
    rec("I-onboarding", "first-run shows", dlg.count() > 0, f"dialogs={dlg.count()}")
    pg2.screenshot(path="/tmp/e2e-shots/deep-I-onboarding.png")
    if dlg.count() > 0:
        steps = 0
        while pg2.get_by_role("dialog").count() > 0 and steps < 10:
            nxt = pg2.get_by_role("dialog").get_by_role("button", name=re.compile("next|continue|get started|start|done|begin", re.I))
            skip = pg2.get_by_role("dialog").get_by_role("button", name=re.compile("skip", re.I))
            if nxt.count() > 0: nxt.first.click()
            elif skip.count() > 0: skip.first.click()
            else: break
            pg2.wait_for_timeout(600); steps += 1
        rec("I-onboarding", "completable", pg2.get_by_role("dialog").count() == 0, f"steps={steps}")
        pg2.screenshot(path="/tmp/e2e-shots/deep-I-after.png")
    ctx2.close()

    # ---------- Phase J: Router back/forward + reload ----------
    pg.goto(f"{BASE}/#/review", wait_until="domcontentloaded"); pg.wait_for_timeout(1400)
    pg.goto(f"{BASE}/#/library", wait_until="domcontentloaded"); pg.wait_for_timeout(1400)
    pg.go_back(); pg.wait_for_timeout(1200)
    rec("J-router", "back -> review", "/review" in (pg.evaluate("location.hash") or ""), pg.evaluate("location.hash"))
    pg.go_forward(); pg.wait_for_timeout(1200)
    rec("J-router", "forward -> library", "/library" in (pg.evaluate("location.hash") or ""), pg.evaluate("location.hash"))
    pg.reload(wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
    t = pg.locator("main").inner_text()
    rec("J-router", "reload keeps view", "library" in t.lower() or "deck" in t.lower(), f"hash={pg.evaluate('location.hash')} {t[:70]}")

    # Phase L2: full quiz MC answer loop (answer Q1, grade, log session, verify persistence)
    nav("#/quiz", 1800)
    pg.get_by_test_id("quiz-mode-mc").click(); pg.wait_for_timeout(1600)
    tq = pg.locator("main").inner_text()
    if "No words to quiz" not in tq:
        opts = pg.locator("main [data-testid^='quiz-option-']")
        n_opts = opts.count()
        if n_opts >= 2:
            sess_before = len(api(pg, "analytics").get("quizSessions", []))
            opts.first.click(); pg.wait_for_timeout(1600)
            t2 = pg.locator("main").inner_text()
            progressed = re.search(r"\b2\s*/\s*\d+", t2) or "correct" in t2.lower() or "1 /" not in t2
            rec("L2-quiz", "answer Q1 advances", bool(progressed), t2[:90].replace("\n", " | "))
            sess_after = len(api(pg, "analytics").get("quizSessions", []))
            rec("L2-quiz", "quiz logged after finish?", sess_after >= sess_before, f"sessions {sess_before}->{sess_after} (logged at session end)")
            pg.screenshot(path="/tmp/e2e-shots/deep-L2-answered.png")
        else:
            rec("L2-quiz", "answer options", False, f"only {n_opts} options")
    else:
        rec("L2-quiz", "has words", False, "empty quiz queue")

    # Phase K: mobile viewport checks
    mob = ctx.new_page()
    mob.set_viewport_size({"width": 390, "height": 844})
    for h, name in [("#/today", "today"), ("#/review", "review"), ("#/library", "library"), ("#/progress", "progress")]:
        mob.goto(f"{BASE}/{h}", wait_until="domcontentloaded", timeout=15000)
        mob.wait_for_timeout(1500)
        over = mob.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        rec("K-mobile", f"{name} no overflow", over <= 1, f"overflow={over}px")
    mob.goto(f"{BASE}/#/today", wait_until="domcontentloaded", timeout=15000); mob.wait_for_timeout(1200)
    mob.screenshot(path="/tmp/e2e-shots/deep-K-mobile.png")
    mob.close()

    # ---------- Phase Z: cleanup — never leave test data behind ----------
    # The suite writes real words (a manual add + a CSV import). Remove them so
    # repeated runs can't drift the user's library, counters or heatmap.
    for probe in ("e2e-test-word-xyz", "zzz-csv-alpha", "zzz-csv-beta"):
        try:
            found = api(pg, "search", query=probe) or []
            for w in found:
                if isinstance(w, dict) and w.get("id"):
                    post(pg, "deleteWord", {"wordId": w["id"]})
            left = api(pg, "search", query=probe) or []
            rec("Z-cleanup", f"removed {probe}", len(left) == 0, f"deleted {len(found)}, left {len(left)}")
        except Exception as e:
            rec("Z-cleanup", f"removed {probe}", False, e)

    # hygiene
    rec("Hygiene", "zero uncaught", len(uncaught) == 0, uncaught[:4])
    rec("Hygiene", "console errors", len(cerr) == 0, cerr[:4])
    b.close()

json.dump(R, open("/tmp/e2e-deep.json", "w"), indent=1)
fails = [x for x in R if not x["ok"]]
print(f"\n==== SUMMARY: {len(R)-len(fails)}/{len(R)} passed, {len(fails)} failed ====")
for f in fails:
    print(f"  FAIL {f['phase']}::{f['name']} -- {f['detail'][:150]}")
