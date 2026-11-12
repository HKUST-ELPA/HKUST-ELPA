"""End-to-end checks against the portable static site using Python Playwright."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES_PREFIX = "/HKUST-ELPA"
WIDTHS = (320, 375, 390, 430, 700, 768, 1024, 1280)


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, raw):
        path = urlsplit(raw).path
        if path.startswith(PAGES_PREFIX + "/"):
            path = path[len(PAGES_PREFIX):]
        return super().translate_path(path)

    def log_request(self, *_):
        pass


def mock_externals(page):
    page.route("https://img.shields.io/**",
               lambda route: route.fulfill(status=200, content_type="image/svg+xml",
                                           body='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'))
    page.route("https://challenges.cloudflare.com/**",
               lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
    page.route("https://hkust-elpa-submissions.futseyi.workers.dev/**",
               lambda route: route.abort())


def page_context(browser, width, scripts=True, motion="reduce"):
    context = browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1050},
        is_mobile=width < 600, has_touch=width < 600,
        java_script_enabled=scripts, reduced_motion=motion,
        accept_downloads=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    mock_externals(page)
    return context, page, errors


def assert_layout(page, label):
    dimensions = page.evaluate(
        "({width:document.documentElement.clientWidth, full:document.documentElement.scrollWidth})"
    )
    assert dimensions["full"] <= dimensions["width"] + 2, (label, dimensions)
    assert page.locator(".elpa-nav").count() == 1, label
    assert page.locator(".elpa-footer").count() == 1, label


def assert_intro_alignment(page, content):
    positions = page.evaluate("""selector => {
      const heading = document.querySelector('.elpa-subhero-inner').getBoundingClientRect();
      const body = document.querySelector(selector);
      return {heading: heading.left,
              content: body.getBoundingClientRect().left + parseFloat(getComputedStyle(body).paddingLeft)};
    }""", content)
    assert abs(positions["heading"] - positions["content"]) <= 1, positions


def click_nav(page, name):
    if page.viewport_size["width"] <= 900:
        page.locator("#menu-toggle").click()
    page.locator(f'.elpa-nav a[href="./{name}.html"]').click()


def check_content(browser, base, width):
    context, page, errors = page_context(browser, width)
    try:
        page.goto(base + "/index.html", wait_until="load")
        assert page.locator(".elpa-home-journey li").count() == 4
        assert page.locator(".elpa-home-feature").count() == 4
        assert page.locator(".elpa-home-help[open]").count() == 0
        assert_layout(page, "home")
        assert_intro_alignment(page, ".elpa-home-main")
        page.goto(base + "/sources.html", wait_until="load")
        assert page.locator(".elpa-resource-tag").count() == 4
        assert page.locator("#official-sources").is_visible()
        assert_layout(page, "sources")
        assert_intro_alignment(page, ".elpa-main")
        page.evaluate("window.__sameDocument = true")
        click_nav(page, "sources")
        assert page.evaluate("window.__sameDocument"), "Revisiting current route should not reload"
        page.goto(base + "/guide.html", wait_until="load")
        assert page.locator("#regularGuide").is_visible()
        assert not page.locator("#fastGuide").is_visible()
        page.locator("#guideFastTab").click()
        assert page.locator("#fastGuide").is_visible()
        assert page.locator("#guideFastTab").get_attribute("aria-pressed") == "true"
        assert "track=fast-track" in page.locator("#fastGuide .elpa-guide-practice").get_attribute("href")
        page.locator("#guideRegularTab").click()
        assert page.locator("#regularGuide").is_visible()
        page.evaluate("document.documentElement.dataset.theme = 'dark'")
        guide_colors = page.evaluate("""() => ({
          panelBorder: getComputedStyle(document.querySelector('#regularGuide')).borderTopWidth,
          stepBorder: getComputedStyle(document.querySelector('#regularGuide .elpa-guide-steps-detailed li')).borderLeftWidth,
          active: getComputedStyle(document.querySelector('#guideRegularTab')).backgroundColor,
          switch: getComputedStyle(document.querySelector('.elpa-guide-switch')).backgroundColor
        })""")
        assert guide_colors["panelBorder"] == guide_colors["stepBorder"] == "0px"
        assert guide_colors["switch"] != guide_colors["active"]
        assert_layout(page, "guide")
        assert_intro_alignment(page, ".elpa-guide-main")
        page.goto(base + "/community.html", wait_until="load")
        assert_layout(page, "community")
        assert_intro_alignment(page, ".community-content")
        page.goto(base + "/practice.html", wait_until="load")
        page.locator("#bankD .qcard").first.wait_for(timeout=20000)
        assert page.locator("#practiceLauncher").is_visible()
        assert_layout(page, "practice")
        assert page.locator(".toolbar").evaluate("node => getComputedStyle(node).position") == "static"
        page.locator("#practiceLauncher").click()
        assert page.locator("#timerPanel").is_visible()
        page.locator("#practiceLauncher").click()
        page.evaluate("document.documentElement.dataset.theme = 'dark'")
        page.locator("#recordsMenuBtn").click()
        practice_colors = page.evaluate("""() => ({
          panel: getComputedStyle(document.querySelector('.records-menu-panel')).backgroundColor,
          progress: getComputedStyle(document.querySelector('.progress-card')).backgroundColor,
          translation: getComputedStyle(document.querySelector('.translation-toggle')).backgroundColor
        })""")
        assert practice_colors["panel"] == practice_colors["progress"] == practice_colors["translation"]
        page.locator("#recordsMenuBtn").click()
        buttons = page.locator("#bankD .qcard").first.locator(".q-actions button").evaluate_all(
            "items => items.map(b => ({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))"
        )
        assert len(buttons) >= 2 and all(b["w"] >= 60 and b["h"] >= 32 for b in buttons)
        if width == 390:
            check_practice(page, base)
        assert not errors, (browser.browser_type.name, width, errors)
        print(f"{browser.browser_type.name}: UI passed at {width}px")
    finally:
        context.close()


def check_practice(page, base):
    page.locator("#searchOpen").click()
    page.locator("#searchInput").fill("supply chain")
    page.locator("#searchResults .search-result").first.wait_for(timeout=20000)
    page.locator("#searchResults .search-result").first.click()
    page.wait_for_url("**question=GZ-R-0026")
    assert page.locator("#q-GZ-R-0026.search-target").is_visible()
    page.locator("#searchOpen").click()
    page.locator("#searchInput").fill("What was your degree")
    page.locator("#searchResults .search-result-kind").first.wait_for(timeout=20000)
    assert "小问" in page.locator("#searchResults .search-result-kind").first.inner_text()
    page.locator("#searchClose").click()
    note = page.locator("#bankD .qcard .qnote").first
    note.locator(".note-toggle").click()
    note.locator("textarea").fill("Regression note from Python Playwright")
    page.reload(wait_until="load")
    page.locator("#bankD .qcard").first.wait_for()
    note = page.locator("#bankD .qcard .qnote").first
    note.locator(".note-toggle").click()
    assert note.locator("textarea").input_value() == "Regression note from Python Playwright"
    page.locator("#practiceLauncher").evaluate("button => button.click()")
    assert page.locator("#timerPanel").is_visible()
    assert page.locator("#timerDisplay").inner_text() == "01:00"
    page.locator("#timerDrill").click()
    page.locator(".qcard.drill-active").first.wait_for(timeout=10000)
    assert not page.locator("#timerPanel").is_visible()
    page.locator("#practiceLauncher").evaluate("button => button.click()")
    page.locator("#timerStartPause").click()
    page.wait_for_function("!document.getElementById('timerPanel').classList.contains('show')")
    page.locator("#practiceLauncher").evaluate("button => button.click()")
    page.locator("#timerStartPause").click()
    page.locator("#timerReset").click()
    page.goto(base + "/submit.html?kind=advice", wait_until="load")
    assert_intro_alignment(page, ".contrib-main")
    assert page.locator(".contrib-panel").evaluate(
        "el => getComputedStyle(el).borderTopWidth") == "0px"
    assert page.locator("#submissionTurnstile").is_visible()
    page.evaluate("document.documentElement.dataset.theme = 'dark'")
    controls = page.evaluate("""() => {
      const year = document.querySelector('#submissionYear');
      const slot = document.querySelector('#submissionSlot');
      const style = getComputedStyle(year);
      return {surface: style.backgroundColor,
              yearTop: year.getBoundingClientRect().top,
              slotTop: slot.getBoundingClientRect().top};
    }""")
    assert controls["surface"] == page.evaluate(
        "() => { const el = document.createElement('div'); el.style.background = getComputedStyle(document.documentElement).getPropertyValue('--surface'); document.body.append(el); const color = getComputedStyle(el).backgroundColor; el.remove(); return color; }")
    if page.viewport_size["width"] > 600:
        assert abs(controls["yearTop"] - controls["slotTop"]) <= 2
    page.locator("#submissionYear").fill("2026")
    page.locator("#submissionSlot").select_option(index=1)
    page.locator("#mainEn").fill("What is your favorite learning strategy?")
    page.locator("#mainCn").fill("你最喜欢的学习方法是什么？")
    page.locator("#includeAdvice").check()
    page.locator("#adviceTags input").first.check()
    page.locator("#adviceTitle").fill("Python browser test")
    page.locator("#adviceBody").fill("An original preparation strategy recorded only for a local preview.")
    page.locator("#previewButton").click()
    assert page.locator("#previewPanel").is_visible()
    page.locator("#adviceBody").fill("An updated strategy recorded only for a local preview.")
    assert not page.locator("#previewPanel").is_visible()
    page.locator("#previewButton").click()
    assert "updated strategy" in page.locator("#previewPanel").inner_text()
    page.reload(wait_until="load")
    assert page.locator("#adviceTitle").input_value() == "Python browser test"
    page.goto(base + "/submit.html?question=GZ-R-0026&intent=supplement", wait_until="load")
    assert page.locator("#linkedQuestion").is_visible()
    page.locator("#campusGz").click()
    assert page.locator("#linkedQuestion").is_visible()
    page.locator("#campusHk").click()
    assert not page.locator("#linkedQuestion").is_visible()


def check_navigation(browser, origin):
    for prefix in ("", PAGES_PREFIX):
        for width in (390, 1440):
            for motion in ("reduce", "no-preference"):
                context, page, errors = page_context(browser, width, motion=motion)
                try:
                    base = origin + prefix
                    page.goto(base + "/sources.html", wait_until="load")
                    assert_layout(page, "source reload")
                    page.reload(wait_until="load")
                    page.evaluate("window.__sameDocument = true")
                    for _ in range(3):
                        click_nav(page, "sources")
                        assert page.evaluate("window.__sameDocument")
                    for name in ("guide", "sources", "practice", "sources", "index", "sources"):
                        click_nav(page, name)
                        page.wait_for_url("**/" + name + ".html")
                        assert_layout(page, "navigation")
                        assert page.evaluate(
                            "getComputedStyle(document.querySelector('main')).viewTransitionName === 'none'"
                        )
                    assert not errors, (prefix, width, motion, errors)
                    page.goto(base + "/guide.html", wait_until="load")
                    page.evaluate("window.__persistentShell = document.querySelector('.elpa-nav')")
                    page.evaluate("window.__persistentFooter = document.querySelector('.elpa-footer')")
                    click_nav(page, "practice")
                    page.wait_for_url("**/practice.html")
                    page.locator("#bankD .qcard").first.wait_for(timeout=20000)
                    assert page.evaluate("""() => document.querySelector('.elpa-nav') === window.__persistentShell
                        && document.querySelector('.elpa-footer') === window.__persistentFooter""")
                    page.go_back()
                    page.wait_for_url("**/guide.html*")
                    assert page.locator("#regularGuide").is_visible()
                    assert page.evaluate("document.querySelector('.elpa-nav') === window.__persistentShell")
                    page.reload(wait_until="load")
                    assert page.locator("#regularGuide").is_visible()
                    assert_layout(page, "guide reload")
                    if width == 1440:
                        for name in ("guide", "practice"):
                            page.goto(base + "/" + name + ".html", wait_until="domcontentloaded")
                            before = page.locator(".elpa-footer").evaluate("node => node.getBoundingClientRect().top")
                            page.wait_for_load_state("load")
                            page.wait_for_timeout(100)
                            after = page.locator(".elpa-footer").evaluate("node => node.getBoundingClientRect().top")
                            assert abs(after - before) < 8, (name, "footer shifted after initial render", before, after)
                        page.evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})")
                        page.wait_for_function("window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2")
                        lines = page.evaluate("""() => ({sidebar:document.querySelector('.sidebar-bottom').getBoundingClientRect().top,
                            footer:document.querySelector('.footer-bottom').getBoundingClientRect().top})""")
                        assert abs(lines["sidebar"] - lines["footer"]) < 12, lines
                finally:
                    context.close()


def check_without_scripts(browser, origin):
    context, page, _ = page_context(browser, 390, scripts=False)
    try:
        page.goto(origin + "/index.html", wait_until="load")
        page.goto(origin + "/sources.html", wait_until="load")
        page.wait_for_url("**/sources.html")
        assert page.locator("#official-sources").is_visible()
        page.goto(origin + "/guide.html", wait_until="load")
        reviewed = json.loads((ROOT / "question-bank/advice.json").read_text(encoding="utf-8"))
        assert page.locator("#guideAdviceList article").count() == len(reviewed)
        assert page.locator("#sec-advice").is_visible()
    finally:
        context.close()


def check_language_and_community(browser, origin):
    context, page, errors = page_context(browser, 390)
    try:
        page.goto(origin + "/index.html", wait_until="load")
        assert page.locator(".elpa-en-inline:visible, .elpa-en-sub:visible, .elpa-en-summary:visible").count() == 0
        page.locator("#menu-toggle").click()
        page.locator("#language-toggle").click()
        assert page.locator('html').get_attribute('lang') == 'en'
        assert page.locator(".elpa-en-inline:visible, .elpa-en-sub:visible, .elpa-en-summary:visible").count() == 0
        assert page.locator('.elpa-nav a[href="./index.html"]').inner_text() == 'Home'
        page.locator('.elpa-nav a[href="./community.html"]').click()
        page.wait_for_url("**/community.html")
        assert page.locator("#founder-title").inner_text() == "Project Maintainer"
        assert "FuTseYi (Shine)" in page.locator(".community-person-name").first.inner_text()
        assert page.locator(".community-role").first.inner_text() == "Founder"
        assert page.locator(".community-person-info p").first.inner_text() == "Fall 2026 · MPhil in AI"
        assert page.locator(".community-person").count() == 2
        assert page.locator(".community-person-links svg").count() == 3
        assert "Dongye LIU (Dylan)" in page.locator(".community-person").last.inner_text()
        assert "2026 · MPhil" in page.locator(".community-person").last.inner_text()
        assert page.locator('.community-contact a[href="mailto:hello@futseyi.com"]').is_visible()
        icons = page.locator(".community-contact svg").evaluate_all(
            "items => items.map(icon => [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height])"
        )
        assert icons == [[16, 16], [16, 16]], icons
        assert page.locator('html').get_attribute('lang') == 'en'
        assert_layout(page, "community English")
        page.reload(wait_until="load")
        assert page.locator('html').get_attribute('lang') == 'en'
        page.locator("#menu-toggle").click()
        page.locator("#language-toggle").click()
        assert "FuTseYi (Shine)" in page.locator(".community-person-name").first.inner_text()
        assert page.locator(".community-role").first.inner_text() == "Founder"
        assert not errors, (browser.browser_type.name, errors)
    finally:
        context.close()



def check_extended_behaviors(browser, origin):
    context, page, errors = page_context(browser, 390)
    try:
        reviewed = json.loads((ROOT / "question-bank/advice.json").read_text(encoding="utf-8"))
        regular = [entry for entry in reviewed if entry.get("track", "regular") == "regular"]
        speaking = [entry for entry in regular if "speaking-strategy" in entry.get("tags", [])]
        fast = [entry for entry in reviewed if entry.get("track") == "fast-track"]
        page.goto(origin + "/guide.html", wait_until="load")
        assert page.locator("#guideAdviceList article").count() == len(regular)
        assert page.locator("#guideAdviceFilters").is_visible()
        page.locator("#adviceTagFilter").select_option("speaking-strategy")
        assert page.locator("#guideAdviceList article").count() == len(speaking)
        page.locator("#adviceTagFilter").select_option("")
        page.locator("#guideFastTab").click()
        assert page.locator("#guideAdviceList article").count() == len(fast)
        assert page.locator("#guideAdviceFilters").is_visible() == bool(fast)
        assert page.locator("#guideAdviceEmpty").is_visible() == (not fast)
        assert "campus=gz&track=fast-track&experience=1" in page.locator("#guideAdviceShare").get_attribute("href")

        page.goto(origin + "/practice.html?campus=hk", wait_until="load")
        for track in ("regular", "fast-track"):
            page.locator(f'[data-track="{track}"]').click()
            assert page.locator("#categoryEmpty").is_visible()
            assert page.locator("#timerDrill").is_disabled()
        page.locator('[data-campus="gz"]').click()
        assert not page.locator("#categoryEmpty").is_visible()
        assert page.locator("#timerDrill").is_enabled()
        page.locator("#searchOpen").click()
        page.locator("#searchInput").fill("no-matching-question-for-draw")
        page.get_by_text("没有找到匹配题目").wait_for()
        page.locator("#searchClear").click()
        page.locator("#searchClose").click()
        assert page.locator("#timerDrill").is_enabled()

        page.goto(origin + "/practice.html?track=fast-track", wait_until="load")
        page.locator("#bankD .qcard").first.wait_for()
        questions = page.locator("#bankD .q-title > .en,#bankPast .q-title > .en").all_text_contents()
        assert questions
        page.locator("#searchOpen").click()
        page.locator("#searchInput").fill("no-matching-question-for-export")
        page.locator("#searchClose").click()
        page.locator("#recordsMenuBtn").click()
        with page.expect_download() as download:
            page.locator("#recordsExportBtn").click()
        markdown = Path(download.value.path()).read_text(encoding="utf-8")
        import re
        exported = [re.sub(r"^### \d+\. ", "", line) for line in markdown.splitlines()
                    if re.match(r"^### \d+\. ", line)]
        assert exported == questions, "Markdown export must preserve the displayed question order"

        page.goto(origin + "/submit.html?question=GZ-R-0026&intent=supplement", wait_until="load")
        page.locator("#campusGz").click()
        page.locator("#submissionSlot").select_option(index=1)
        page.locator("#supplementEn").fill("Draft-only alternative wording")
        page.locator("#addFollowup").click()
        page.locator('#followupList [data-lang="en"]').first.fill("First draft follow-up")
        page.locator("#addFollowup").click()
        page.locator('#followupList [data-lang="en"]').last.fill("Second draft follow-up")
        page.locator("#includeAdvice").check()
        page.locator("#adviceTags input").first.check()
        page.locator("#adviceTitle").fill("Recoverable advice draft")
        page.locator("#adviceBody").fill("Recoverable advice text from an isolated local browser test.")
        page.reload(wait_until="load")
        assert page.locator("#includeAdvice").is_checked()
        assert page.locator("#adviceTitle").input_value() == "Recoverable advice draft"
        assert page.locator("#questionFields").is_visible()
        assert page.locator("#supplementEn").input_value() == "Draft-only alternative wording"
        assert page.locator('#followupList [data-lang="en"]').count() == 2
        assert not errors, (browser.browser_type.name, errors)
        print(f"{browser.browser_type.name}: advice, export, draft and empty-category regressions passed")
    finally:
        context.close()


def main():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "_site"))
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            for engine in (playwright.chromium, playwright.webkit):
                browser = engine.launch(headless=True)
                try:
                    for width in WIDTHS:
                        check_content(browser, origin, width)
                    check_navigation(browser, origin)
                    check_without_scripts(browser, origin)
                    check_language_and_community(browser, origin)
                    check_extended_behaviors(browser, origin)
                finally:
                    browser.close()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


if __name__ == "__main__":
    main()
