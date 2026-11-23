"""Public discovery contracts reject stale routes and metadata."""
from pathlib import Path
import shutil
import tempfile
import unittest

from scripts.site_build import PAGES
from scripts.site_metadata import identity, render
from scripts.site_verify import verify_metadata

ROOT = Path(__file__).resolve().parents[1]


class MetadataTests(unittest.TestCase):
    def test_shared_metadata_escapes_authored_text(self):
        html = '<head><title>A &amp; B</title><meta name="description" content="A &quot;quote&quot;"></head>'
        rendered = render(html, "https://example.org/", "Example", "guide")
        self.assertIn('content="A &amp; B"', rendered)
        self.assertIn('content="A &quot;quote&quot;"', rendered)
        self.assertIn('href="https://example.org/guide.html"', rendered)
        with self.assertRaises(ValueError):
            identity('<link rel="canonical" href="http://example.org/">')

    def test_build_rejects_broken_discovery_contracts(self):
        mutations = (
            ("guide.html", "https://hkust-elpa.github.io/guide.html", "https://example.org/"),
            ("guide.html", 'content="website"', 'content=""'),
            ("sitemap.xml", "guide.html", "missing.html"),
            ("robots.txt", "sitemap.xml", "missing.xml"),
        )
        for filename, before, after in mutations:
            with self.subTest(filename=filename, before=before), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for name in [*(page + ".html" for page in PAGES), "sitemap.xml", "robots.txt", "assets/images/hkust-elpa.png"]:
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / "_site" / name, target)
                verify_metadata(root, PAGES)
                path = root / filename
                path.write_text(path.read_text(encoding="utf-8").replace(before, after), encoding="utf-8")
                with self.assertRaises(ValueError):
                    verify_metadata(root, PAGES)
