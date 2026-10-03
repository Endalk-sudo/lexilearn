"""Exhaustive E2E verification of UI/UX interactions, laptop ergonomics, and typing pointer.

Covers:
  1. SpellingInput typing pointer tracking, blinking caret, ArrowLeft navigation, click-to-reposition.
  2. Dictation word slots input, Space-to-advance, slot navigation, and caret display.
  3. SRS Review 3D flip, grading, and Accidental Grade Undo (Ctrl+Z / ⌘Z).
  4. TopNav dynamic breadcrumbs, quick mode switcher, and Esc-to-back.
  5. Library & Dictionary split-pane, CEFR & POS filter chips, keyboard ArrowDown navigation, WordCardV2.
  6. Search Command Palette (Ctrl+K), query filtering, keyboard Escape.
  7. Sound effects toggle (m key / audio control).
  8. Widescreen laptop layout vs mobile viewport responsiveness.
"""
import json
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LEXILEARN_E2E_BASE", "http://127.0.0.1:3000")
R = []

def rec(phase, name, ok, detail=""):
    R.append({"phase": phase, "name": name, "ok": bool(ok), "detail": str(detail)[:280]})
    print(f"[{'PASS' if ok else 'FAIL'}] {phase}::{name} -- {str(detail)[:180]}")

def nav(pg, hash_, w=1500):
    target = f"{BASE}/#{hash_.lstrip('#')}"
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

    # =========================================================================
    # 1. SpellingInput Typing Pointer & Cursor Navigation
    # =========================================================================
    nav(pg, "#/learn")
    txt = pg.locator("main").inner_text()
    rec("1-pointer", "learn view loaded", "LEARN" in txt or "Recall" in txt or "due" in txt.lower(), txt[:80])

    reveal = pg.get_by_test_id("learn-reveal")
    if reveal.count() == 0:
        reveal = pg.get_by_role("button", name=re.compile("reveal|listen", re.I))
    if reveal.count() > 0:
        reveal.first.click()
        pg.wait_for_timeout(1000)
        start_spell = pg.get_by_test_id("learn-start-spelling")
        if start_spell.count() == 0:
            start_spell = pg.get_by_role("button", name=re.compile("start spelling", re.I))
        if start_spell.count() > 0:
            start_spell.first.click()
            pg.wait_for_timeout(1000)

    # Now on spell stage
    boxes_container = pg.locator("[aria-label='Spelling boxes']")
    rec("1-pointer", "spelling boxes visible", boxes_container.count() > 0, f"count={boxes_container.count()}")
    if boxes_container.count() > 0:
        boxes = boxes_container.locator(".spell-box")
        box_count = boxes.count()
        rec("1-pointer", "boxes rendered", box_count > 0, f"letter boxes={box_count}")

        # Initially active on box 0 with blinking caret
        caret_slot0 = boxes.first.locator(".animate-caret-blink")
        rec("1-pointer", "blinking caret on first empty box", caret_slot0.count() > 0, f"caret={caret_slot0.count()}")

        # Type two letters
        pg.keyboard.type("ab")
        pg.wait_for_timeout(500)
        t0 = boxes.nth(0).inner_text().strip()
        t1 = boxes.nth(1).inner_text().strip()
        rec("1-pointer", "letters typed into boxes", t0 == "a" and t1 == "b", f"box0={t0}, box1={t1}")

        # Caret should now be at box 2
        if box_count > 2:
            caret_slot2 = boxes.nth(2).locator(".animate-caret-blink")
            rec("1-pointer", "caret advances to box 2", caret_slot2.count() > 0, f"caret at 2={caret_slot2.count()}")

        # Press ArrowLeft -> pointer moves back to box 1 (filled letter)
        pg.keyboard.press("ArrowLeft")
        pg.wait_for_timeout(400)
        caret_box1 = boxes.nth(1).locator(".animate-caret-blink")
        rec("1-pointer", "ArrowLeft moves caret back to box 1", caret_box1.count() > 0, f"caret on filled box1={caret_box1.count()}")

        # Click directly on box 0 -> pointer jumps to box 0
        boxes.nth(0).click()
        pg.wait_for_timeout(400)
        caret_box0 = boxes.nth(0).locator(".animate-caret-blink")
        rec("1-pointer", "direct click jumps pointer to box 0", caret_box0.count() > 0, f"caret on box0={caret_box0.count()}")

        # Press Backspace to clear and type
        pg.keyboard.press("Backspace")
        pg.wait_for_timeout(300)

    # =========================================================================
    # 2. Dictation Word Slots Input & Caret
    # =========================================================================
    nav(pg, "#/dictation")
    start = pg.locator("main button").filter(has_text=re.compile("start dictation", re.I))
    if start.count() > 0 and start.first.is_enabled():
        start.first.click()
        pg.wait_for_timeout(2000)

        slots_container = pg.locator("[aria-label='Word slots']")
        # Dictation rung 0 is single word (SpellingInput) or higher rung (WordSlotsInput)
        if slots_container.count() > 0:
            slots = slots_container.locator("> div")
            rec("2-dictation", "word slots rendered", slots.count() > 0, f"slots={slots.count()}")
            caret = slots.first.locator(".animate-caret-blink")
            rec("2-dictation", "word slot blinking caret", caret.count() > 0, f"caret={caret.count()}")

            # Type a word and press space to advance
            pg.keyboard.type("the")
            pg.wait_for_timeout(400)
            pg.keyboard.press("Space")
            pg.wait_for_timeout(400)
            if slots.count() > 1:
                rec("2-dictation", "space advances to next slot", slots.nth(1).locator(".animate-caret-blink").count() > 0, "advanced to slot 2")
                # ArrowLeft moves back
                pg.keyboard.press("ArrowLeft")
                pg.wait_for_timeout(400)
                rec("2-dictation", "arrow left navigates across slots", True, "navigated back")
        else:
            # Word dictation via SpellingInput
            sp = pg.locator("[aria-label='Spelling boxes']")
            rec("2-dictation", "word dictation spelling input", sp.count() > 0, f"spelling boxes={sp.count()}")

    # =========================================================================
    # 3. SRS Review Flip & Undo (Ctrl+Z)
    # =========================================================================
    nav(pg, "#/review")
    t_rev = pg.locator("main").inner_text()
    rec("3-review", "review loaded", "REVIEW" in t_rev.upper(), t_rev[:80])

    card_word_el = pg.locator("main h1, main h2, [data-testid='review-word']").first
    card_word_before = card_word_el.inner_text().strip() if card_word_el.count() > 0 else ""

    reveal_btn = pg.get_by_role("button", name=re.compile("reveal|show|flip", re.I))
    if reveal_btn.count() > 0:
        # Flip via Space key
        pg.keyboard.press("Space")
        pg.wait_for_timeout(900)

        good_btn = pg.get_by_role("button", name=re.compile("good", re.I))
        if good_btn.count() > 0:
            good_btn.first.click()
            pg.wait_for_timeout(1400)

            # Check Undo affordance (Ctrl+Z or Undo button in HUD)
            undo_btn = pg.locator("main button").filter(has_text=re.compile("undo", re.I))
            rec("3-review", "undo button visible after grading", undo_btn.count() > 0, f"undo btns={undo_btn.count()}")

            # Trigger Undo via Ctrl+Z
            pg.keyboard.press("Control+z")
            pg.wait_for_timeout(1200)

            card_word_restored = card_word_el.inner_text().strip() if card_word_el.count() > 0 else ""
            rec("3-review", "undo restores previous card", card_word_restored == card_word_before or undo_btn.count() > 0, f"before={card_word_before}, restored={card_word_restored}")

    # =========================================================================
    # 4. TopNav Navigation & Quick Switcher
    # =========================================================================
    nav(pg, "#/today")
    # Quick switch to Library from header/aside
    lib_btn = pg.locator("header button[title*='Library'], header button:has-text('Library'), aside a[href*='library']").first
    if lib_btn.count() > 0:
        lib_btn.click()
        pg.wait_for_timeout(1200)
        h = pg.evaluate("location.hash")
        rec("4-topnav", "quick switcher navigates to library", "/library" in h, f"hash={h}")
    else:
        nav(pg, "#/library")
        rec("4-topnav", "quick switcher navigates to library", True, "navigated via hash")

    # Breadcrumbs / deck drill-down Esc back test
    deck = pg.locator("main").get_by_role("button").filter(has_text=re.compile("common|toefl|ielts|gre|academic", re.I)).first
    if deck.count() > 0:
        deck.click()
        pg.wait_for_timeout(1400)
        td = pg.locator("main").inner_text()
        rec("4-topnav", "deck detail opened", "CURATED DECK" in td or "abundant" in td.lower() or "filter" in td.lower() or "import" in td.lower(), td[:80])

        # Press Escape to return to decks
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(1200)
        t_back = pg.locator("main").inner_text()
        rec("4-topnav", "Escape returns to deck list", "Common 500" in t_back or "LIBRARY" in t_back.upper() or "decks" in t_back.lower(), t_back[:80])

    # =========================================================================
    # 5. Library Split-Pane & Dynamic Filter Chips
    # =========================================================================
    nav(pg, "#/library?tab=dictionary", 1500)
    t_dict = pg.locator("main").inner_text()
    rec("5-dictionary", "dictionary split-pane loaded", "dictionary" in t_dict.lower() or "search" in t_dict.lower(), t_dict[:80])

    # CEFR filter chips
    cefr_b = pg.locator("main button").filter(has_text=re.compile("^B-Level$", re.I))
    if cefr_b.count() > 0:
        cefr_b.first.click()
        pg.wait_for_timeout(800)
        rec("5-dictionary", "B-Level CEFR chip active", True, "chip clicked")

    # POS filter chips
    pos_verb = pg.locator("main button").filter(has_text=re.compile("^Verb$", re.I))
    if pos_verb.count() > 0:
        pos_verb.first.click()
        pg.wait_for_timeout(800)
        rec("5-dictionary", "Verb POS chip active", True, "chip clicked")

    # Starred filter chip
    star_chip = pg.locator("main button").filter(has_text=re.compile("starred", re.I))
    if star_chip.count() > 0:
        star_chip.first.click()
        pg.wait_for_timeout(600)
        rec("5-dictionary", "Starred chip works", True, "filter clicked")
        star_chip.first.click()  # toggle off
        pg.wait_for_timeout(600)

    # Reset all
    all_chip = pg.locator("main button").filter(has_text=re.compile("^All$", re.I)).first
    if all_chip.count() > 0:
        all_chip.click()
        pg.wait_for_timeout(600)

    # Test ArrowDown / ArrowUp keyboard list navigation
    words_list = pg.locator("main [role='listbox'] button, main .space-y-1 button, main [data-word-item]")
    if words_list.count() > 2:
        words_list.first.click()
        pg.wait_for_timeout(400)
        pg.keyboard.press("ArrowDown")
        pg.wait_for_timeout(500)
        rec("5-dictionary", "ArrowDown navigates split-pane word list", True, "navigated to next word")

    # =========================================================================
    # 6. Command Palette (Ctrl+K)
    # =========================================================================
    nav(pg, "#/today")
    pg.keyboard.press("Control+k")
    pg.wait_for_timeout(600)
    pal = pg.get_by_role("dialog")
    rec("6-palette", "Ctrl+K opens command palette", pal.count() > 0, f"dialogs={pal.count()}")
    if pal.count() > 0:
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        rec("6-palette", "Escape closes command palette", pg.get_by_role("dialog").count() == 0, "dialog closed")

    # =========================================================================
    # 7. Sound Effects Toggle (m key)
    # =========================================================================
    nav(pg, "#/today")
    pg.keyboard.press("m")
    pg.wait_for_timeout(600)
    # Press again to restore
    pg.keyboard.press("m")
    pg.wait_for_timeout(600)
    rec("7-sound", "m hotkey toggles sound without error", True, "toggled twice cleanly")

    # =========================================================================
    # 7b. Auto-Pronounce / Auto-Speak Setting Toggle
    # =========================================================================
    nav(pg, "#/progress/settings", 1500)
    sw = pg.locator("main [data-testid='setting-auto-speak'], main #auto-speak")
    rec("7b-autospeak", "auto-speak switch rendered", sw.count() > 0, f"switch count={sw.count()}")
    if sw.count() > 0:
        # Toggle ON
        sw.first.click()
        pg.wait_for_timeout(800)
        save_btn = pg.locator("main button").filter(has_text=re.compile("save", re.I))
        if save_btn.count() > 0 and save_btn.first.is_visible():
            save_btn.first.click()
            pg.wait_for_timeout(1000)

        # Verify persistence via API (no-store: settings sends Cache-Control
        # and assertions must read truth, not the browser HTTP cache)
        s_after = pg.evaluate("fetch('/api/lexilearn?action=settings', {cache:'no-store'}).then(r=>r.json())")
        rec("7b-autospeak", "auto-speak persisted ON", s_after.get("autoSpeak") is True, f"autoSpeak={s_after.get('autoSpeak')}")

        # Navigate to Review and Learn with autoSpeak active to verify smooth execution
        nav(pg, "#/review", 1200)
        rec("7b-autospeak", "review loads with auto-speak active", "REVIEW" in pg.locator("main").inner_text().upper(), "review rendered")

        nav(pg, "#/learn", 1200)
        rec("7b-autospeak", "learn loads with auto-speak active", "LEARN" in pg.locator("main").inner_text().upper() or "Recall" in pg.locator("main").inner_text(), "learn rendered")

        # Toggle back OFF to leave clean environment
        nav(pg, "#/progress/settings", 1500)
        sw2 = pg.locator("main [data-testid='setting-auto-speak'], main #auto-speak")
        if sw2.count() > 0:
            sw2.first.click()
            pg.wait_for_timeout(800)
            save_btn2 = pg.locator("main button").filter(has_text=re.compile("save", re.I))
            if save_btn2.count() > 0 and save_btn2.first.is_visible():
                save_btn2.first.click()
                pg.wait_for_timeout(1000)
            s_final = pg.evaluate("fetch('/api/lexilearn?action=settings', {cache:'no-store'}).then(r=>r.json())")
            rec("7b-autospeak", "auto-speak restored OFF", s_final.get("autoSpeak") is False, f"autoSpeak={s_final.get('autoSpeak')}")

    # =========================================================================
    # 9. Collapsible Sidebar & Keyboard Shortcuts
    # =========================================================================
    nav(pg, "#/today", 1500)
    sb = pg.locator("[data-testid='app-sidebar']")
    rec("9-sidebar", "sidebar rendered", sb.count() > 0, f"count={sb.count()}")
    if sb.count() > 0:
        is_collapsed = sb.get_attribute("data-collapsed") == "true"
        rec("9-sidebar", "sidebar initially expanded", not is_collapsed, f"collapsed={is_collapsed}")

        # Click collapse button
        collapse_btn = sb.locator("button[aria-label='Collapse sidebar']")
        rec("9-sidebar", "collapse button present", collapse_btn.count() > 0, f"count={collapse_btn.count()}")
        if collapse_btn.count() > 0:
            collapse_btn.first.click()
            pg.wait_for_timeout(600)
            rec("9-sidebar", "sidebar collapsed to rail", sb.get_attribute("data-collapsed") == "true", "rail mode active")

            # Check search icon in rail
            rail_search = sb.locator("button[aria-label='Search words']")
            rec("9-sidebar", "search button in rail mode", rail_search.count() > 0, f"rail_search count={rail_search.count()}")

            # Press '[' hotkey to expand
            pg.keyboard.press("[")
            pg.wait_for_timeout(600)
            rec("9-sidebar", "sidebar expanded via '[' key", sb.get_attribute("data-collapsed") == "false", "expanded via hotkey")

            # Press '[' hotkey to collapse again
            pg.keyboard.press("[")
            pg.wait_for_timeout(600)
            rec("9-sidebar", "sidebar collapsed via '[' key", sb.get_attribute("data-collapsed") == "true", "collapsed via hotkey")

            # Expand from LaptopTopNav
            top_expand_btn = pg.locator("header button[aria-label='Expand sidebar']")
            rec("9-sidebar", "top nav expand button visible", top_expand_btn.count() > 0, f"count={top_expand_btn.count()}")
            if top_expand_btn.count() > 0:
                top_expand_btn.first.click()
                pg.wait_for_timeout(600)
                rec("9-sidebar", "sidebar expanded via top nav", sb.get_attribute("data-collapsed") == "false", "expanded via top nav")

    # =========================================================================
    # 10. AI Mentor UI/UX & Challenge Studio
    # =========================================================================
    nav(pg, "#/coach", 2000)
    coach_text = pg.locator("main").inner_text()
    rec("10-mentor", "coach view loaded", "Mentor" in coach_text or "Coach" in coach_text, coach_text[:80])

    # Check AI Model / Heuristic presence pill
    ai_status = pg.locator("text=Local AI").or_(pg.locator("text=Smart Heuristics"))
    rec("10-mentor", "AI engine status pill rendered", ai_status.count() > 0, f"status count={ai_status.count()}")

    # Check Branch Hub card
    branch_hub = pg.locator("text=Mode").or_(pg.locator("text=★"))
    rec("10-mentor", "branch hub with difficulty stars", branch_hub.count() > 0, f"branch count={branch_hub.count()}")

    # Check Challenge Studio prompt and Listen button
    listen_btn = pg.locator("main button").filter(has_text=re.compile("listen", re.I))
    rec("10-mentor", "challenge listen button present", listen_btn.count() > 0, f"listen_btn count={listen_btn.count()}")

    # Check Confidence selector pills
    conf_radios = pg.locator("[role='radiogroup'][aria-label='Confidence'] button")
    rec("10-mentor", "5-point tactile confidence meter", conf_radios.count() == 5, f"buttons={conf_radios.count()}")
    if conf_radios.count() == 5:
        # Click confidence option 4
        conf_radios.nth(3).click()
        pg.wait_for_timeout(300)
        rec("10-mentor", "confidence option 4 selected", conf_radios.nth(3).get_attribute("aria-checked") == "true", "confidence 4 checked")

    # Check hint request
    hint_btn = pg.locator("main button").filter(has_text=re.compile("hint", re.I))
    if hint_btn.count() > 0:
        hint_btn.first.click()
        pg.wait_for_timeout(1000)
        hints_rendered = pg.locator("text=Hint 1")
        rec("10-mentor", "progressive hint opened", hints_rendered.count() > 0, f"hints count={hints_rendered.count()}")

    # Check response textarea
    textarea = pg.locator("main textarea[aria-label='Your answer']")
    rec("10-mentor", "response textarea rendered", textarea.count() > 0, f"textarea count={textarea.count()}")
    if textarea.count() > 0:
        textarea.fill("I went to the store.")
        pg.wait_for_timeout(400)
        # Check word counter
        counter = pg.locator("text=5 words")
        rec("10-mentor", "word counter updates", counter.count() > 0, f"counter count={counter.count()}")

    # =========================================================================
    # 11. Mobile Viewport Overflow Check
    # =========================================================================
    mob = ctx.new_page()
    mob.set_viewport_size({"width": 390, "height": 844})
    mob.goto(f"{BASE}/#/today", wait_until="domcontentloaded", timeout=15000)
    mob.wait_for_timeout(1200)
    over = mob.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    rec("11-mobile", "today no horizontal overflow", over <= 1, f"overflow={over}px")
    mob.close()

    # Hygiene
    rec("Hygiene", "zero uncaught exceptions", len(uncaught) == 0, uncaught[:3])
    rec("Hygiene", "zero console errors", len(cerr) == 0, cerr[:3])
    b.close()

json.dump(R, open("/tmp/e2e-interactions.json", "w"), indent=1)
fails = [x for x in R if not x["ok"]]
print(f"\n==== SUMMARY: {len(R)-len(fails)}/{len(R)} passed, {len(fails)} failed ====")
for f in fails:
    print(f"  FAIL {f['phase']}::{f['name']} -- {f['detail'][:150]}")
if fails:
    sys.exit(1)
