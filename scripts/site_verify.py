"""Verify local references in the complete static artifact before publication."""
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit
from xml.etree import ElementTree as ET
from .site_metadata import identity, page_url


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.meta = {}
        self.canonicals = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            if key in self.meta:
                raise ValueError(f"Duplicate metadata: {key}")
            if key:
                self.meta[key] = attrs.get("content", "")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if attrs.get("id"):
            if attrs["id"] in self.ids:
                raise ValueError(f"Duplicate HTML id: {attrs['id']}")
            self.ids.add(attrs["id"])
        for name in ("src", "href"):
            if attrs.get(name):
                self.links.append(attrs[name])


def verify(root):
    root = root.resolve()
    pages = {path: Page(path.read_text(encoding="utf-8")) for path in root.rglob("*.html")}
    if root / "index.html" not in pages:
        raise ValueError("Build did not produce index.html")
    for path, page in pages.items():
        if path.parent.name == "search-records" and page.meta.get("robots") != "noindex":
            raise ValueError("Search records must remain noindex")
        route = "/" + path.relative_to(root).as_posix()
        for link in page.links:
            url = urlsplit(urljoin("https://preview.invalid" + route, link))
            if url.netloc != "preview.invalid" or url.scheme != "https":
                continue
            target = (root / unquote(url.path).lstrip("/")).resolve()
            if not target.is_relative_to(root):
                raise ValueError(f"{route}: path escapes artifact: {link}")
            if target.is_dir():
                target /= "index.html"
            if not target.is_file():
                raise ValueError(f"{route}: missing local resource: {link}")
            if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                raise ValueError(f"{route}: missing anchor: {link}")
    return len(pages)


def verify_metadata(root, routes):
    pages = {path: Page(path.read_text(encoding="utf-8")) for path in root.rglob("*.html")}
    origin, name = identity((root / "index.html").read_text(encoding="utf-8"))
    for route in routes:
        page = pages[root / (route + ".html")]
        expected = page_url(origin, route)
        if page.canonicals != [expected] or page.meta.get("og:url") != expected:
            raise ValueError(f"{route}: incorrect canonical or social URL")
        for key in ("title", "description", "image", "image:alt"):
            if not page.meta.get("og:" + key) or page.meta.get("og:" + key) != page.meta.get("twitter:" + key):
                raise ValueError(f"{route}: inconsistent social {key}")
        if page.meta.get("description") != page.meta.get("og:description") or "noindex" in page.meta.get("robots", ""):
            raise ValueError(f"{route}: incorrect indexable page description or robots")
        if page.meta.get("og:site_name") != name:
            raise ValueError(f"{route}: inconsistent site identity")
        for key, value in (("og:type", "website"), ("og:locale", "zh_CN"),
                           ("twitter:card", "summary"), ("og:image:type", "image/png"),
                           ("og:image:width", "512"), ("og:image:height", "512")):
            if page.meta.get(key) != value:
                raise ValueError(f"{route}: incorrect {key}")
        image = page.meta["og:image"]
        if not image.startswith(origin) or not (root / image.removeprefix(origin)).is_file():
            raise ValueError(f"{route}: missing social image")
    locations = [node.text for node in ET.parse(root / "sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    if sorted(locations) != sorted(page_url(origin, route) for route in routes):
        raise ValueError("Sitemap must contain exactly the public canonical routes")
    if (root / "robots.txt").read_text(encoding="utf-8").splitlines() != ["User-agent: *", "Allow: /", "Sitemap: " + origin + "sitemap.xml"]:
        raise ValueError("Incorrect robots discovery rules")
