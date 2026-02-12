#!/usr/bin/env python3
"""
Fetch Uncovered Nate Resource Content

Queries the database for resource URLs (Notion, Google Docs) found in post
content, compares against already-scraped files in nate_substack/data/resources/,
and fetches the missing ones.

- Notion pages: CDP browser (Chrome DevTools Protocol) with 6-second JS wait
- Google Docs: Export-as-text endpoint (/export?format=txt)
- Google Sheets: Export-as-CSV endpoint (/export?format=csv)
- Google Drive folders/files: Skip (binary content)

Usage:
    python3 scripts/fetch-nate-resources.py              # Fetch all uncovered
    python3 scripts/fetch-nate-resources.py --dry-run     # Preview only
    python3 scripts/fetch-nate-resources.py --domain notion  # Notion only

CDP Browser Setup (required for Notion):
    open -na "Google Chrome" --args \
      --remote-debugging-port=9222 \
      --remote-allow-origins=http://127.0.0.1:9222 \
      --user-data-dir="/Users/jonathanedwards/.chrome-cdp-profile"
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

# Optional CDP dependencies
try:
    import requests
    from websocket import create_connection

    CDP_AVAILABLE = True
except ImportError:
    CDP_AVAILABLE = False

try:
    from markdownify import markdownify as md
    MARKDOWNIFY_AVAILABLE = True
except ImportError:
    MARKDOWNIFY_AVAILABLE = False

# Directories
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
RESOURCES_DIR = (
    PROJECT_DIR.parent / "nate_substack" / "data" / "resources"
)

# Load .env.local
ENV_FILE = PROJECT_DIR / ".env.local"

CDP_DOMAINS = ["notion.so", "notion.site"]
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def load_env():
    """Load environment variables from .env.local."""
    if not ENV_FILE.exists():
        print(f"Error: {ENV_FILE} not found")
        sys.exit(1)
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())


def normalize_url(url):
    """Extract a canonical key from a URL for dedup matching."""
    # Notion: extract 32-char hex UUID
    m = re.search(r"([a-f0-9]{32})\b", url)
    if m and "notion" in url:
        return ("notion", m.group(1))

    # Google Docs/Sheets: extract doc ID
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    if m and "google.com" in url:
        dtype = "gsheet" if "spreadsheets" in url else "gdoc"
        return (dtype, m.group(1))

    # Google Drive
    if "drive.google.com" in url:
        m = re.search(r"/(?:folders|d)/([a-zA-Z0-9_-]+)", url)
        if m:
            return ("gdrive", m.group(1))

    return ("other", url)


def url_to_filename(url, domain):
    """Generate a safe filename from a URL (matches extract_resources.py convention)."""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    parsed = urllib.parse.urlparse(url)
    path_parts = [p for p in parsed.path.split("/") if p]

    if domain in ("notion.so", "notion.site"):
        if path_parts:
            slug = path_parts[-1].split("?")[0]
            slug = re.sub(r"-[a-f0-9]{32}$", "", slug)
            return f"notion_{slug}_{url_hash}"

    elif domain == "docs.google.com":
        for i, part in enumerate(path_parts):
            if part == "d" and i + 1 < len(path_parts):
                doc_id = path_parts[i + 1][:12]
                doc_type = "gsheet" if "spreadsheets" in url else "gdoc"
                return f"{doc_type}_{doc_id}_{url_hash}"

    safe_domain = domain.replace(".", "_")
    return f"{safe_domain}_{url_hash}"


def get_domain(url):
    """Extract domain from URL."""
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    return host.replace("www.", "")


# ----- CDP Client -----


class CDPClient:
    """Chrome DevTools Protocol client for rendering JS-heavy pages."""

    def __init__(self, host="127.0.0.1", port=9222, timeout=60):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ws = None
        self.msg_id = 0
        self._connected = False

    def connect(self):
        if self._connected:
            return
        resp = requests.get(
            f"http://{self.host}:{self.port}/json/version", timeout=5
        )
        ws_url = resp.json()["webSocketDebuggerUrl"]
        self.ws = create_connection(ws_url, timeout=self.timeout)
        self._connected = True

    def send(self, method, params=None, sessionId=None):
        if not self._connected:
            self.connect()
        self.msg_id += 1
        msg = {"id": self.msg_id, "method": method, "params": params or {}}
        if sessionId:
            msg["sessionId"] = sessionId
        self.ws.send(json.dumps(msg))
        while True:
            raw = self.ws.recv()
            obj = json.loads(raw)
            if obj.get("id") == self.msg_id:
                if "error" in obj:
                    raise RuntimeError(f"{method} error: {obj['error']}")
                return obj.get("result", {})

    def recv_event_until(self, event, sessionId, timeout):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                raw = self.ws.recv()
                obj = json.loads(raw)
                if "method" in obj and obj["method"] == event:
                    if sessionId is None or obj.get("sessionId") == sessionId:
                        return obj
            except Exception:
                continue
        raise TimeoutError(f"Timeout waiting for {event}")

    def fetch_html(self, url, extra_wait=6.0):
        res = self.send("Target.createTarget", {"url": "about:blank"})
        targetId = res.get("targetId")
        if not targetId:
            raise RuntimeError("Could not create target")

        res = self.send(
            "Target.attachToTarget", {"targetId": targetId, "flatten": True}
        )
        sessionId = res.get("sessionId")
        if not sessionId:
            raise RuntimeError("Failed to attach to target")

        self.send("Page.enable", sessionId=sessionId)
        self.send("Page.navigate", {"url": url}, sessionId=sessionId)

        try:
            self.recv_event_until(
                "Page.loadEventFired", sessionId=sessionId, timeout=self.timeout
            )
        except TimeoutError:
            pass

        if extra_wait > 0:
            time.sleep(extra_wait)

        res = self.send(
            "Runtime.evaluate",
            {
                "expression": "document.documentElement.outerHTML",
                "returnByValue": True,
            },
            sessionId=sessionId,
        )
        html = res.get("result", {}).get("value", "")

        # Extract code block innerText via JS (Notion wraps tokens in spans)
        code_blocks_js = """
            (() => {
                const blocks = document.querySelectorAll('[class*="notion-code-block"]');
                const results = [];
                blocks.forEach(b => {
                    // Use innerText which the browser renders correctly
                    let text = b.innerText || '';
                    results.push(text);
                });
                return JSON.stringify(results);
            })()
        """
        try:
            cb_res = self.send(
                "Runtime.evaluate",
                {"expression": code_blocks_js, "returnByValue": True},
                sessionId=sessionId,
            )
            code_block_texts = json.loads(
                cb_res.get("result", {}).get("value", "[]")
            )
        except Exception:
            code_block_texts = []

        try:
            self.send("Target.closeTarget", {"targetId": targetId})
        except Exception:
            pass

        return html, code_block_texts

    def close(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self._connected = False


_cdp_client = None


def get_cdp_client(host="127.0.0.1", port=9222):
    global _cdp_client
    if not CDP_AVAILABLE:
        return None
    if _cdp_client is None:
        try:
            _cdp_client = CDPClient(host, port)
            _cdp_client.connect()
        except Exception as e:
            print(f"  [CDP] Could not connect: {e}")
            return None
    return _cdp_client


def check_cdp_available(host="127.0.0.1", port=9222):
    if not CDP_AVAILABLE:
        return False
    try:
        resp = requests.get(
            f"http://{host}:{port}/json/version", timeout=2
        )
        return resp.status_code == 200
    except Exception:
        return False


# ----- Content Extraction -----


def html_to_text(html):
    """Convert HTML to clean text (fallback when markdownify unavailable)."""
    html = re.sub(
        r"<noscript[^>]*>.*?</noscript>", "", html, flags=re.DOTALL | re.IGNORECASE
    )
    html = re.sub(
        r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE
    )
    html = re.sub(
        r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE
    )
    html = re.sub(r"<svg[^>]*>.*?</svg>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    for old, new in [
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#39;", "'"),
    ]:
        text = text.replace(old, new)
    return text


def preprocess_notion_html(html, code_block_texts=None):
    """Convert Notion-specific HTML elements to standard HTML before markdown conversion.

    code_block_texts: list of strings extracted via JS innerText from CDP.
    These are the properly rendered code block contents (Notion wraps each token in spans,
    so BS4's get_text() fragments the text — JS innerText gets it right).
    """
    lang_labels = {
        "javascript", "python", "plain text", "text", "html", "css",
        "json", "typescript", "bash", "shell", "xml", "yaml", "markdown",
        "sql", "java", "c", "c++", "ruby", "go", "rust", "swift", "kotlin",
        "php", "r", "scala", "dart", "lua", "perl", "powershell",
    }

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # Find all Notion code blocks
        code_blocks = soup.find_all("div", class_=lambda c: c and "notion-code-block" in c)

        for i, block in enumerate(code_blocks):
            # Use JS-extracted text if available (properly rendered by the browser)
            if code_block_texts and i < len(code_block_texts):
                text = code_block_texts[i]
            else:
                # Fallback to BS4 get_text
                text = block.get_text()

            # Remove language label from first line
            lines = text.split("\n")
            if lines and lines[0].strip().lower() in lang_labels:
                lines = lines[1:]
            text = "\n".join(lines).strip()

            # Replace the div with a proper <pre><code> block
            new_tag = soup.new_tag("pre")
            code_tag = soup.new_tag("code")
            code_tag.string = text
            new_tag.append(code_tag)
            block.replace_with(new_tag)

        # Handle Notion callout blocks → blockquote
        callouts = soup.find_all("div", class_=lambda c: c and "notion-callout-block" in c)
        for callout in callouts:
            text = callout.get_text(separator="\n").strip()
            new_tag = soup.new_tag("blockquote")
            new_tag.string = text
            callout.replace_with(new_tag)

        return str(soup)
    except ImportError:
        return html


def html_to_markdown(html, code_block_texts=None):
    """Convert HTML to markdown, preserving formatting structure."""
    # Strip non-content tags
    for tag in ["noscript", "script", "style", "svg", "nav", "footer", "header"]:
        html = re.sub(
            rf"<{tag}[^>]*>.*?</{tag}>", "", html, flags=re.DOTALL | re.IGNORECASE
        )

    # Convert Notion-specific elements to standard HTML
    html = preprocess_notion_html(html, code_block_texts=code_block_texts)

    if MARKDOWNIFY_AVAILABLE:
        result = md(
            html,
            heading_style="ATX",
            bullets="-",
            strip=["img", "button", "input", "form", "iframe"],
            code_language="",
        )
    else:
        # Fallback to plain text
        result = html_to_text(html)

    # Clean up Notion page chrome
    # Remove "Skip to content" and sign-up banners
    lines = result.split("\n")
    cleaned = []
    skip_patterns = [
        r"^\s*Skip to content\s*$",
        r"^\s*\[Skip to content\]",
        r"^\s*You.re almost there",
        r"^\s*\[?Sign up or login\]?",
        r"^\s*Share\s*$",
        r"^\s*Made with\s",
        r"^\s*Try Notion\s*$",
    ]
    for line in lines:
        if any(re.match(p, line, re.IGNORECASE) for p in skip_patterns):
            continue
        cleaned.append(line)

    result = "\n".join(cleaned)

    # Collapse 3+ blank lines to 2
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def fetch_notion(url, cdp_host, cdp_port):
    client = get_cdp_client(cdp_host, cdp_port)
    if not client:
        return None, "CDP browser not available"
    try:
        html, code_block_texts = client.fetch_html(url, extra_wait=6.0)
        if len(html) < 500:
            return None, "Page did not load"
        text = html_to_markdown(html, code_block_texts=code_block_texts)
        if len(text) < 200:
            return None, "No meaningful content found"
        return text, None
    except Exception as e:
        return None, f"CDP error: {str(e)}"


def fetch_gdoc(url):
    headers = {"User-Agent": USER_AGENT}
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    if not m:
        return None, "Could not extract doc ID"
    doc_id = m.group(1)

    if "spreadsheets" in url:
        export_url = f"https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv"
    else:
        export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"

    try:
        req = urllib.request.Request(export_url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace"), None
    except urllib.error.HTTPError as e:
        if e.code == 403:
            return None, "Access denied (requires login)"
        return None, f"HTTP {e.code}: {e.reason}"
    except Exception as e:
        return None, f"Error: {str(e)}"


def fetch_resource(url, domain, cdp_host, cdp_port):
    if domain in CDP_DOMAINS:
        return fetch_notion(url, cdp_host, cdp_port)
    elif "docs.google.com" in url:
        return fetch_gdoc(url)
    else:
        return None, f"Unsupported domain: {domain}"


# ----- DB Queries -----


def get_db_resource_urls():
    """Query DB for resource URLs in post content."""
    supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    api_url = f"{supabase_url}/rest/v1/project_assets?asset_type=eq.post&select=id,project_id,asset_id,name,content&limit=500"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    req = urllib.request.Request(api_url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        posts = json.loads(resp.read())

    notion_re = re.compile(r"https?://(?:www\.)?notion\.(?:so|site)/[^\s\)\">\]]+")
    gdocs_re = re.compile(
        r"https?://docs\.google\.com/(?:document|spreadsheets)/d/[^\s\)\">\]]+",
    )

    urls = {}
    for post in posts:
        content = post.get("content", "") or ""
        for u in notion_re.findall(content) + gdocs_re.findall(content):
            u = u.rstrip(").,;")
            key = normalize_url(u)
            if key not in urls:
                urls[key] = {
                    "url": u,
                    "post_asset_id": post["asset_id"],
                    "project_id": post["project_id"],
                    "post_name": post["name"],
                }
    return urls


def get_scraped_keys():
    """Build set of already-scraped URL keys from resource .json files."""
    keys = {}
    for jf in RESOURCES_DIR.glob("*.json"):
        if jf.name == "manifest.json":
            continue
        try:
            meta = json.loads(jf.read_text())
            u = meta.get("url", "")
            key = normalize_url(u)
            keys[key] = {
                "url": u,
                "file": jf.stem,
                "content_length": meta.get("content_length", 0),
            }
        except Exception:
            pass
    return keys


# ----- Main -----


def rescrape_notion(args):
    """Re-scrape all Notion resources with markdown conversion and update DB."""
    print("=== Re-scrape Notion Resources (HTML → Markdown) ===\n")

    if not MARKDOWNIFY_AVAILABLE:
        print("ERROR: markdownify not installed. pip install markdownify")
        sys.exit(1)

    # Get all Notion assets from DB
    print("Querying DB for Notion assets...")
    assets = get_notion_asset_urls()
    print(f"  Found {len(assets)} Notion assets in DB\n")

    if not assets:
        print("Nothing to re-scrape!")
        return

    # Check CDP
    cdp_available = check_cdp_available(args.cdp_host, args.cdp_port)
    if not cdp_available:
        print("ERROR: CDP browser not available.")
        print('Launch Chrome with:')
        print('  open -na "Google Chrome" --args \\')
        print('    --remote-debugging-port=9222 \\')
        print('    --remote-allow-origins=http://127.0.0.1:9222 \\')
        print('    --user-data-dir="/Users/jonathanedwards/.chrome-cdp-profile"')
        sys.exit(1)

    if args.dry_run:
        print("** DRY RUN — no files or DB records will be updated **\n")
        for a in assets:
            url = a.get("published_url", "")
            print(f"  {a['name'][:60]}  →  {url[:60]}")
        print(f"\nWould re-scrape {len(assets)} Notion pages")
        return

    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)

    success = 0
    failed = 0

    for i, asset in enumerate(assets, 1):
        url = asset.get("published_url", "")
        if not url:
            print(f"[{i}/{len(assets)}] SKIP — no published_url: {asset['name'][:50]}")
            continue

        domain = get_domain(url)
        print(f"[{i}/{len(assets)}] {asset['name'][:50]}...")

        content, error = fetch_notion(url, args.cdp_host, args.cdp_port)

        if error:
            print(f"  FAILED: {error}")
            failed += 1
            continue

        # Save to file
        filename = url_to_filename(url, domain)
        txt_path = RESOURCES_DIR / f"{filename}.txt"
        json_path = RESOURCES_DIR / f"{filename}.json"

        txt_path.write_text(content or "", encoding="utf-8")

        # Update or create JSON metadata
        meta = {}
        if json_path.exists():
            try:
                meta = json.loads(json_path.read_text())
            except Exception:
                pass
        meta.update({
            "url": url,
            "domain": domain,
            "extracted_at": datetime.now().isoformat(),
            "content_length": len(content or ""),
            "method": "cdp",
            "format": "markdown",
        })
        json_path.write_text(json.dumps(meta, indent=2))

        # Update DB
        try:
            update_db_asset_content(asset["id"], content)
            print(f"  OK ({len(content or '')} chars) — file + DB updated")
            success += 1
        except Exception as e:
            print(f"  File saved but DB update failed: {e}")
            failed += 1

        # Rate limit
        if i < len(assets):
            time.sleep(2.0)

    print(f"\n=== Results ===")
    print(f"  Updated: {success}")
    print(f"  Failed: {failed}")


def get_notion_asset_urls():
    """Get all Notion promptkit/guide assets from DB with their published_url."""
    supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    api_url = (
        f"{supabase_url}/rest/v1/project_assets"
        f"?asset_type=in.(promptkit,guide)"
        f"&platform=eq.notion"
        f"&select=id,name,published_url,content"
        f"&limit=500"
    )
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    req = urllib.request.Request(api_url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def update_db_asset_content(asset_id, content):
    """Update a project_asset's content in the database."""
    supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    api_url = f"{supabase_url}/rest/v1/project_assets?id=eq.{asset_id}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    body = json.dumps({"content": content}).encode("utf-8")
    req = urllib.request.Request(api_url, data=body, headers=headers, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return resp.status


def main():
    parser = argparse.ArgumentParser(
        description="Fetch uncovered Nate resource content",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument(
        "--domain",
        help="Only fetch from domain (notion, gdoc, gsheet)",
    )
    parser.add_argument(
        "--rescrape",
        action="store_true",
        help="Re-scrape all Notion resources with markdown conversion and update DB",
    )
    parser.add_argument("--cdp-host", default="127.0.0.1")
    parser.add_argument("--cdp-port", type=int, default=9222)
    args = parser.parse_args()

    load_env()

    if args.rescrape:
        rescrape_notion(args)
        return

    print("=== Fetch Uncovered Nate Resources ===\n")

    # Get URLs from DB and scraped files
    print("Querying DB for resource URLs in post content...")
    db_urls = get_db_resource_urls()
    print(f"  Found {len(db_urls)} unique resource URLs\n")

    print("Scanning existing scraped resources...")
    scraped_keys = get_scraped_keys()
    print(f"  Found {len(scraped_keys)} already scraped\n")

    # Find uncovered
    uncovered = {k: v for k, v in db_urls.items() if k not in scraped_keys}

    # Filter by domain if specified
    if args.domain:
        uncovered = {k: v for k, v in uncovered.items() if k[0] == args.domain}

    # Skip Google Drive (binary content)
    uncovered = {k: v for k, v in uncovered.items() if k[0] != "gdrive"}

    print(f"Uncovered resources to fetch: {len(uncovered)}")
    by_type = {}
    for k in uncovered:
        by_type[k[0]] = by_type.get(k[0], 0) + 1
    for t, c in sorted(by_type.items()):
        print(f"  {t}: {c}")
    print()

    if not uncovered:
        print("Nothing to fetch!")
        return

    if args.dry_run:
        print("** DRY RUN — no files will be saved **\n")

    # Check CDP for Notion
    needs_cdp = any(k[0] == "notion" for k in uncovered)
    cdp_available = (
        check_cdp_available(args.cdp_host, args.cdp_port) if needs_cdp else False
    )

    if needs_cdp and not cdp_available:
        notion_count = sum(1 for k in uncovered if k[0] == "notion")
        print(f"Warning: {notion_count} Notion resources require CDP browser.")
        print('Launch Chrome with:')
        print('  open -na "Google Chrome" --args \\')
        print('    --remote-debugging-port=9222 \\')
        print('    --remote-allow-origins=http://127.0.0.1:9222 \\')
        print('    --user-data-dir="/Users/jonathanedwards/.chrome-cdp-profile"')
        print()

    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)

    extracted = 0
    failed = 0
    skipped_cdp = 0

    items = sorted(uncovered.items(), key=lambda x: x[1]["url"])

    for i, (key, info) in enumerate(items, 1):
        url = info["url"]
        domain = get_domain(url)
        rtype = key[0]

        # Skip Notion if no CDP
        if rtype == "notion" and not cdp_available:
            skipped_cdp += 1
            continue

        # Extract link_text from post content
        link_text = url  # fallback

        filename = url_to_filename(url, domain)
        print(f"[{i}/{len(items)}] [{rtype}] {url[:80]}...")

        if args.dry_run:
            print(f"  -> {filename}.txt")
            continue

        content, error = fetch_resource(url, domain, args.cdp_host, args.cdp_port)

        if error:
            print(f"  FAILED: {error}")
            failed += 1
        else:
            txt_path = RESOURCES_DIR / f"{filename}.txt"
            json_path = RESOURCES_DIR / f"{filename}.json"

            txt_path.write_text(content or "", encoding="utf-8")

            meta = {
                "url": url,
                "domain": domain,
                "link_text": link_text,
                "source_post": {
                    "asset_id": info["post_asset_id"],
                    "title": info["post_name"],
                },
                "extracted_at": datetime.now().isoformat(),
                "content_length": len(content or ""),
                "method": "cdp" if rtype == "notion" else "http",
            }
            json_path.write_text(json.dumps(meta, indent=2))

            print(f"  OK ({len(content or '')} chars)")
            extracted += 1

        # Rate limit
        delay = 2.0 if rtype == "notion" else 0.5
        if i < len(items):
            time.sleep(delay)

    print(f"\n=== Results ===")
    print(f"  Extracted: {extracted}")
    print(f"  Failed: {failed}")
    if skipped_cdp:
        print(f"  Skipped (needs CDP): {skipped_cdp}")
    print(f"\nFiles saved to: {RESOURCES_DIR}")


if __name__ == "__main__":
    main()
