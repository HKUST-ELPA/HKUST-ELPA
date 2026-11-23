"""Homepage-owned identity shared by every published route and discovery file."""
from html import escape, unescape
from html.parser import HTMLParser
import re
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET


def identity(homepage):
    class Identity(HTMLParser):
        canonical = ""
        name = ""

        def handle_starttag(self, tag, attributes):
            attrs = dict(attributes)
            if tag == "link" and attrs.get("rel") == "canonical":
                self.canonical = attrs.get("href", "")
            if tag == "meta" and attrs.get("property") == "og:site_name":
                self.name = attrs.get("content", "")

    parsed = Identity()
    parsed.feed(homepage)
    url = urlsplit(parsed.canonical)
    if url.scheme != "https" or not url.netloc or url.path != "/" or url.query or url.fragment:
        raise ValueError("Homepage canonical must be an HTTPS origin with a trailing slash")
    if not parsed.name:
        raise ValueError("Homepage must define og:site_name")
    return parsed.canonical, parsed.name


def page_url(origin, page):
    return origin + ("" if page == "index" else page + ".html")


def render(html, origin, name, page):
    title = unescape(re.search(r'<title>(.*?)</title>', html).group(1))
    description = unescape(re.search(r'<meta name="description" content="([^"]+)">', html).group(1))
    html = re.sub(r'<link rel="canonical"[^>]*>|<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>', '', html)
    url = page_url(origin, page)
    image = origin + "assets/images/hkust-elpa.png"
    values = {
        "og:site_name": unescape(name), "og:title": title, "og:description": description,
        "og:type": "website", "og:url": url, "og:locale": "zh_CN",
        "og:image": image, "og:image:type": "image/png", "og:image:width": "512",
        "og:image:height": "512", "og:image:alt": unescape(name),
        "twitter:card": "summary", "twitter:title": title, "twitter:description": description,
        "twitter:image": image, "twitter:image:alt": unescape(name),
    }
    tags = [f'<link data-page-metadata rel="canonical" href="{escape(url, quote=True)}">']
    tags += [f'<meta data-page-metadata {"name" if key.startswith("twitter:") else "property"}="{key}" content="{escape(value, quote=True)}">'
             for key, value in values.items()]
    return html.replace('</head>', '\n'.join(tags) + '\n</head>')


def write_discovery(destination, origin, pages):
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    sitemap = ET.Element("{" + namespace + "}urlset")
    for page in pages:
        entry = ET.SubElement(sitemap, "{" + namespace + "}url")
        ET.SubElement(entry, "{" + namespace + "}loc").text = page_url(origin, page)
    ET.ElementTree(sitemap).write(destination / "sitemap.xml", encoding="utf-8", xml_declaration=True)
    (destination / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: " + origin + "sitemap.xml\n", encoding="utf-8")
