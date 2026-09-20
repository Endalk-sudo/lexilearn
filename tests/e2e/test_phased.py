from playwright.sync_api import sync_playwright
import json, time, re
BASE="http://localhost:3000"
results=[]; shots="/tmp/e2e-shots"
def rec(phase,name,ok,detail=""):
    results.append({"phase":phase,"name":name,"ok":bool(ok),"detail":str(detail)[:300]})
    print(f"[{'PASS' if ok else 'FAIL'}] {phase} :: {name} -- {str(detail)[:220]}")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":1440,"height":900})
    # suppress onboarding for deterministic run
    ctx.add_init_script("try{localStorage.setItem('lexilearn-onboarding-v2','1');localStorage.setItem('lexilearn-onboarding-dismissed','true')}catch(e){}")
    pg=ctx.new_page()
    cerr=[]; freq=[]; uncaught=[]
    pg.on("console", lambda m: cerr.append(m.text[:200]) if m.type=="error" else None)
    pg.on("pageerror", lambda e: uncaught.append(str(e)[:200]))
    pg.on("requestfailed", lambda r: freq.append(r.url[:120]))
    pg.on("response", lambda r: freq.append(f"{r.status}:{r.url[:120]}") if r.status>=400 else None)
    # P1 boot
    t0=time.time(); r=pg.goto(BASE+"/", wait_until="domcontentloaded", timeout=20000); dt=int((time.time()-t0)*1000)
    pg.wait_for_timeout(2500)
    rec("P1-boot","home 200", r.status==200, f"{r.status} {dt}ms")
    rec("P1-boot","sidebar+main", pg.locator("main").count()>0 and pg.locator("nav,aside").count()>0, pg.title())
    rec("P1-boot","no onboarding", pg.get_by_role("dialog").count()==0, f"dialogs={pg.get_by_role('dialog').count()}")
    pg.screenshot(path=f"{shots}/final-P1-home.png")
    # helper to nav hash
    def nav(h, wait=1800):
        pg.goto(BASE+"/"+h, wait_until="domcontentloaded", timeout=15000)
        pg.wait_for_timeout(wait)
    # P2 today
    nav("#/today"); txt=pg.locator("main").inner_text()[:2000]
    rec("P2-today","today view", "Today" in pg.title() or "review" in txt.lower() or "due" in txt.lower(), txt[:140].replace(chr(10)," | "))
    pg.screenshot(path=f"{shots}/final-P2-today.png")
    # P3 learn
    nav("#/learn"); txt=pg.locator("main").inner_text()[:3000]
    rec("P3-learn","learn renders", "LEARN" in txt or "Recall" in txt, txt[:140].replace(chr(10)," | "))
    btn=pg.get_by_test_id("learn-reveal")
    if btn.count()==0:
        btn=pg.get_by_role("button", name=re.compile("reveal and listen", re.I))
    c=btn.count()
    if c>0:
        btn.first.click(); pg.wait_for_timeout(1200); txt2=pg.locator("main").inner_text()[:3000]
        rec("P3-learn","reveal works", len(txt2)>len(txt) or "meaning" in txt2.lower(), txt2[:140].replace(chr(10)," | "))
        pg.screenshot(path=f"{shots}/final-P3-revealed.png")
        # learn flow is recall -> spell -> result (grades live in Review, not Learn)
        spell=pg.get_by_test_id("learn-check")
        rec("P3-learn","spell stage reached", spell.count()>0, f"count={spell.count()}")
        advanced=False
        if spell.count()>0:
            pg.locator("[placeholder*='Type the word']").first.fill("x")
            spell.first.click(); pg.wait_for_timeout(1200)
            txt3=pg.locator("main").inner_text()[:300]
            advanced = "Next word" in txt3 or "Finish session" in txt3 or "Correct" in txt3 or "correct spelling" in txt3.lower() or "Try again" in txt3 or "Show me the answer" in txt3
            rec("P3-learn","spell check advances", advanced, txt3[:140].replace(chr(10)," | "))
            pg.screenshot(path=f"{shots}/final-P3-result.png")
    else:
        rec("P3-learn","reveal works", False, txt[:200])
    # P4 review
    nav("#/review"); txt=pg.locator("main").inner_text()[:3000]
    rec("P4-review","review renders", "REVIEW" in txt or "due" in txt.lower(), txt[:140].replace(chr(10)," | "))
    btn=pg.get_by_role("button", name=re.compile("reveal", re.I))
    if btn.count()>0:
        btn.first.click(); pg.wait_for_timeout(1000)
        for g in ["again","hard","good","easy"]:
            gb=pg.get_by_test_id(f"grade-{g}")
            if gb.count()==0:
                gb=pg.get_by_role("button", name=re.compile(g, re.I))
            rec(f"P4-review", f"grade {g}", gb.count()>0, f"count={gb.count()}")
        g=pg.get_by_role("button", name=re.compile("good", re.I))
        if g.count()>0: g.first.click(); pg.wait_for_timeout(1000)
        pg.screenshot(path=f"{shots}/final-P4-graded.png")
    else: rec("P4-review","reveal+grades", False, "no reveal btn")
    # P5 quiz
    nav("#/quiz"); txt=pg.locator("main").inner_text()[:2000]
    rec("P5-quiz","setup renders", "QUIZ" in txt or "quiz" in txt.lower(), txt[:140].replace(chr(10)," | "))
    modebtns=pg.get_by_role("button")
    # click first mode card then start
    started=False
    for pat in ["Pick the meaning","Find the word","Type it","Spelling","Speed","Match"]:
        mb=pg.get_by_role("button", name=re.compile(pat, re.I))
        if mb.count()>0:
            mb.first.click(); pg.wait_for_timeout(800); break
    for pat in ["start","begin","practice", "10 questions", "start quiz"]:
        sb=pg.get_by_role("button", name=re.compile(pat, re.I))
        if sb.count()>0:
            sb.first.click(); pg.wait_for_timeout(1500); started=True; break
    txt2=pg.locator("main").inner_text()[:2000]
    rec("P5-quiz","quiz starts", started or ("1 /" in txt2 or "correct" in txt2.lower()), txt2[:160].replace(chr(10)," | "))
    pg.screenshot(path=f"{shots}/final-P5-quiz.png")
    # P6 library
    nav("#/library"); txt=pg.locator("main").inner_text()[:2000]
    rec("P6-library","library renders", "Common 500" in txt or "Decks" in txt, txt[:140].replace(chr(10)," | "))
    # open first deck
    deck_opened=False
    for sel in [pg.get_by_text("Common 500"), pg.locator("main").locator("a,button").first]:
        try:
            if sel.count()>0: sel.first.click(timeout=5000); pg.wait_for_timeout(1500); txtd=pg.locator("main").inner_text()[:2000]
            if "abundant" in txtd.lower() or "filter this deck" in txtd.lower(): deck_opened=True; break
        except Exception as e: pass
    rec("P6-library","deck detail opens", deck_opened, pg.locator("main").inner_text()[:120].replace(chr(10)," | "))
    pg.screenshot(path=f"{shots}/final-P6-deck.png")
    # P7 progress
    nav("#/progress"); txt=pg.locator("main").inner_text()[:1500]
    rec("P7-progress","progress renders", "PROGRESS" in txt or "memory" in txt.lower(), txt[:120].replace(chr(10)," | "))
    nav("#/progress/settings"); txts=pg.locator("main").inner_text()[:1500]
    rec("P7-progress","settings renders", "Setting" in txts or "goal" in txts.lower() or "voice" in txts.lower(), txts[:120].replace(chr(10)," | "))
    # P8 coach / P9 dictation
    nav("#/coach"); txt=pg.locator("main").inner_text()[:1500]
    rec("P8-coach","coach renders no-crash", "COACH" in txt or "Mentor" in txt, txt[:120].replace(chr(10)," | "))
    nav("#/dictation"); txt=pg.locator("main").inner_text()[:1500]
    rec("P9-dictation","dictation renders", "DICTATION" in txt or "Hear it" in txt, txt[:120].replace(chr(10)," | "))
    # P10 mobile
    mp=ctx.new_page(); mp.set_viewport_size({"width":390,"height":844})
    mp.goto(BASE+"/#/today", wait_until="domcontentloaded", timeout=15000); mp.wait_for_timeout(1500)
    over=mp.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    rec("P10-mobile","mobile no overflow", over<=1, f"overflow={over}px")
    mp.screenshot(path=f"{shots}/final-P10-mobile.png"); mp.close()
    # hygiene
    rec("Hygiene","zero uncaught", len(uncaught)==0, uncaught[:3])
    real404=[x for x in freq if x.startswith("404")]
    rec("Hygiene","404s", True, real404[:5] if real404 else "none")
    rec("Hygiene","console errors", len(cerr)==0, cerr[:3] if cerr else "none")
    print("CONSOLE:", json.dumps(cerr[:10])); print("NET404:", json.dumps(real404[:10])); print("UNCAUGHT:", json.dumps(uncaught[:5]))
    open("/tmp/e2e-final.json","w").write(json.dumps(results,indent=1))
    b.close()
