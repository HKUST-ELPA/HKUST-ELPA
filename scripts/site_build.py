"""Build ELPA from three HTML entrypoints with homepage-owned information views."""
import json
from html import escape
import re
import shutil
import subprocess
import sys

PAGES = ("index", "guide", "practice", "sources", "submit", "community")
SOURCE_FILES = ("index.html", "practice.html", "submit.html", "community.html")
SOURCE_DIRS = ("question-bank", "data")
CONTENT_PAGES = {
    "guide": ("考试与备考指南｜HKUST-ELPA",
              "HKUST-ELPA 非官方口语考试指南：常规 ELPA 与 Fast Track 流程、备考经验和练习入口。",
              ("./question-bank/taxonomy.js", "./assets/js/guide.js")),
    "sources": ("资料来源｜HKUST-ELPA",
                "HKUST-ELPA 非官方题目来源、资料说明与维护入口。", ()),
}


def replace_once(html, pattern, replacement):
    updated, count = re.subn(pattern, lambda _: replacement, html, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Unexpected HTML structure: " + pattern)
    return updated


def navigation(nav, page):
    nav = nav.replace(' class="active"', '').replace(' aria-current="page"', '')
    if page == "submit":
        return nav.replace('class="elpa-nav-submit nav-contribute"',
                           'class="elpa-nav-submit nav-contribute" aria-current="page"')
    target = f'<a href="./{page}.html"'
    if target not in nav:
        raise ValueError("Missing navigation target: " + page)
    return nav.replace(target, target + ' class="active" aria-current="page"')



def render_guide_advice(page, root):
    """Build reviewed advice cards from the canonical records before first paint."""
    entries = json.loads((root / "question-bank/advice.json").read_text(encoding="utf-8"))
    taxonomy = json.loads((root / "question-bank/taxonomy.json").read_text(encoding="utf-8"))
    regular = [entry for entry in entries if entry["campus"] == "gz" and entry["track"] == "regular"]

    def label(group, key):
        names = group[key]
        return '<span data-i18n-en="' + escape(names["en"], quote=True) + '">' + escape(names["zh"]) + '</span>'

    cards = []
    for entry in entries:
        track = entry["track"]
        phase = entry["phase"]
        tags = entry.get("tags", [])
        chips = []
        campus = entry["campus"]
        if campus in taxonomy["campuses"]:
            chips.append('<span data-i18n-en="' + escape(
                taxonomy["campuses"][campus]["en"],
                quote=True) + '">' +
                taxonomy["campuses"][campus]["zh"] + '</span>')
        if phase in taxonomy["advicePhases"]:
            chips.append(label(taxonomy["advicePhases"], phase))
        chips.extend(label(taxonomy["adviceTags"], tag)
                     for tag in tags if tag in taxonomy["adviceTags"])
        chips_html = "".join('<span class="elpa-advice-chip">' + chip + "</span>" for chip in chips)
        source_html = ""
        issue = entry.get("issueNumber")
        if type(issue) is int and issue > 0:
            source_html = ('<a class="elpa-advice-source" target="_blank" rel="noopener noreferrer" '
                           'href="https://github.com/HKUST-ELPA/HKUST-ELPA/issues/' + str(issue)
                           + '" data-i18n-en="Original post">原始分享</a>')
        cards.append(
            '<article class="elpa-advice-card" data-track="' + escape(track, quote=True)
            + '" data-campus="' + escape(campus, quote=True)
            + '" data-phase="' + escape(phase, quote=True)
            + '" data-tags="' + escape(",".join(tags), quote=True) + '"'
            + (' hidden' if campus != "gz" or track != "regular" else "") + '>'
            + '<div class="elpa-advice-chips">' + chips_html + '</div>'
            + '<h3>' + escape(entry["title"]) + '</h3>'
            + '<p class="elpa-advice-content">' + escape(entry["body"]) + '</p>'
            + source_html + '</article>'
        )

    page = replace_once(
        page, r'<div id="guideAdviceList" class="elpa-advice-grid"></div>',
        '<div id="guideAdviceList" class="elpa-advice-grid">' + "".join(cards) + '</div>'
    )
    for key, names, values, initial in (
        ("advicePhaseFilter", taxonomy["advicePhases"],
         {entry["phase"] for entry in regular}, ("全部阶段", "All Stages")),
        ("adviceTagFilter", taxonomy["adviceTags"],
         {tag for entry in regular for tag in entry.get("tags", [])}, ("全部主题", "All Topics")),
    ):
        previous = f'<select id="{key}"><option value="" data-i18n-en="{initial[1]}">{initial[0]}</option></select>'
        options = "".join(
            '<option value="' + escape(code, quote=True) + '">' + label(names, code) + '</option>'
            for code in names if code in values
        )
        if page.count(previous) != 1:
            raise ValueError("Unexpected guide filter: " + key)
        page = page.replace(previous, f'<select id="{key}"><option value="" data-i18n-en="{initial[1]}">{initial[0]}</option>'
                            + options + '</select>')
    section = '<section class="elpa-advice-section" id="sec-advice" hidden'
    if page.count(section) != 1:
        raise ValueError("Missing advice section")
    page = page.replace(section, '<section class="elpa-advice-section" id="sec-advice"')
    if regular:
        page = page.replace('id="guideAdviceFilters" class="elpa-advice-filters" hidden',
                            'id="guideAdviceFilters" class="elpa-advice-filters"')
    else:
        page = page.replace('id="guideAdviceEmpty" class="elpa-advice-empty" hidden',
                            'id="guideAdviceEmpty" class="elpa-advice-empty"')
    return page

def build(root, destination, options):
    destination.mkdir()
    homepage = (root / "index.html").read_text(encoding="utf-8")
    nav = re.search(r'<nav class="elpa-nav"[\s\S]*?</nav>', homepage)
    footer = re.search(r'<footer class="elpa-footer"[\s\S]*?</footer>', homepage)
    if not nav or not footer:
        raise ValueError("Homepage must define navigation and footer")
    clean_homepage, count = re.subn(
        r'\s*<template data-page="(?:guide|sources)">[\s\S]*?</template>',
        '', homepage,
    )
    if count != len(CONTENT_PAGES):
        raise ValueError("Expected one content template per information page")
    for page in PAGES:
        if page in CONTENT_PAGES:
            title, description, scripts = CONTENT_PAGES[page]
            fragment = re.search(
                r'<template data-page="' + page + r'">\s*(<main id="main">[\s\S]*?</main>)\s*</template>',
                homepage,
            )
            if not fragment:
                raise ValueError("Missing information page in homepage: " + page)
            html = replace_once(clean_homepage, r'<main id="main">[\s\S]*?</main>', fragment.group(1))
            html = replace_once(html, r'<title>.*?</title>', '<title>' + title + '</title>')
            html = replace_once(html, r'<meta name="description" content="[^"]*">',
                                '<meta name="description" content="' + description + '">')
            html = re.sub(r'<link rel="(?:preload|prefetch)"[^>]*>\s*', '', html)
            html = html.replace('class="elpa-body elpa-home"', 'class="elpa-body"', 1)
            tags = '\n'.join('<script src="' + name + '"></script>' for name in scripts)
            html = html.replace('<script src="./assets/js/index.js"></script>', tags, 1)
            if page == "guide":
                html = render_guide_advice(html, root)
        else:
            html = clean_homepage if page == "index" else (root / (page + ".html")).read_text(encoding="utf-8")
        if page != "index":
            html = replace_once(html, r'<nav class="elpa-nav"[\s\S]*?</nav>|<!-- shared-nav -->',
                                navigation(nav.group(0), page))
            html = replace_once(html, r'<footer class="elpa-footer"[\s\S]*?</footer>|<!-- shared-footer -->',
                                footer.group(0))
        (destination / (page + ".html")).write_text(html, encoding="utf-8")
    # Pagefind indexes a static representation of each reviewed question.
    # Practice remains the only user-facing question route and data owner.
    questions = json.loads((root / "question-bank/questions.json").read_text(encoding="utf-8"))
    appearances = json.loads((root / "question-bank/appearances.json").read_text(encoding="utf-8"))
    records = destination / "search-records"
    records.mkdir()
    for key, bank_data in questions["banks"].items():
        campus = key.split("-")[0].lower()
        track = "regular" if key.endswith("-R") else "fast-track"
        for item in bank_data["items"]:
            question_id = f'{key}-{item["num"]:04d}'
            terms = {item["term"]} if item.get("term") else set()
            terms.update(entry["term"] for entry in appearances.get(question_id, []) if entry.get("term"))
            filters = [f'<span data-pagefind-filter="term:{escape(term, quote=True)}"></span>'
                       for term in sorted(terms)]
            filters += [f'<span data-pagefind-filter="session:{escape(entry["term"] + "|" + entry["examStage"], quote=True)}"></span>'
                        for entry in appearances.get(question_id, []) if entry.get("term") and entry.get("examStage")]
            parts = [("main", item)]
            seen = {(item["en"], item.get("cn", ""))}
            for kind, entries in (("sub", item.get("subs", []) + [part for entry in appearances.get(question_id, []) for part in entry.get("subs", [])]),
                                  ("alt", item.get("alternatives", []) + [part for entry in appearances.get(question_id, []) for part in entry.get("alternatives", [])])):
                for part in entries:
                    identity = (part.get("en", ""), part.get("cn", ""))
                    if not any(identity) or identity in seen:
                        continue
                    seen.add(identity)
                    parts.append((kind, part))
            link = f'../practice.html?campus={campus}&amp;track={track}&amp;question={question_id}'
            for position, (kind, part) in enumerate(parts):
                title = escape(part.get("en") or part.get("cn", ""))
                record = (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
                          f'<meta name="robots" content="noindex"><title>{title}｜HKUST-ELPA</title>'
                          f'<meta data-pagefind-filter="campus:{campus}">'
                          f'<meta data-pagefind-filter="track:{track}"></head><body>'
                          f'<main data-pagefind-body><h1>{title}</h1>'
                          + (f'<p>{escape(part.get("cn", ""))}</p>' if part.get("cn") else '')
                          + f'<a href="{link}">在题库中练习</a></main>' + ''.join(filters) + '</body></html>')
                (records / f'{question_id}-{kind}-{position}.html').write_text(record, encoding="utf-8")
    for name in ("submission-config.js", "elpa_data.json"):
        shutil.copy2(root / "data" / name, destination / name)
    shutil.copytree(root / "assets", destination / "assets")
    bank = destination / "question-bank"
    bank.mkdir()
    for document in (root / "question-bank").glob("*.md"):
        shutil.copy2(document, bank / document.name)
    subprocess.run([
        sys.executable, str(root / "scripts/build-question-data.py"),
        "--input", str(root / "question-bank"), "--output", str(bank),
    ], check=True)
    search = subprocess.run([sys.executable, "-m", "pagefind", "--site", str(destination),
                             "--force-language", "zh"], cwd=root, capture_output=True,
                            encoding="utf-8", errors="replace")
    if search.returncode:
        sys.stderr.write(search.stdout + search.stderr)
        raise subprocess.CalledProcessError(search.returncode, "pagefind")
    if not (destination / "pagefind/pagefind.js").is_file():
        raise ValueError("Pagefind did not generate a usable index")
    return ([f"{len(PAGES)} 个页面 / pages", "题库已验证 / question data verified"], [])
