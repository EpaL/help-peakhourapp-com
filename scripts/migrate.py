#!/usr/bin/env python3
"""
Confluence HTML export → Starlight MDX migration.

Reads the two Confluence space exports (P5D = Documentation, P5W = Wiki) and
writes Starlight-compatible markdown into src/content/docs/{user-guide,troubleshooting}/,
preserving the original page hierarchy, co-locating images, rewriting internal
links, and generating a redirect map.

Safe to re-run: existing target files are overwritten on each invocation.

Usage:
    python3 scripts/migrate.py                 # migrate everything
    python3 scripts/migrate.py --only <slug>   # migrate one article for review
    python3 scripts/migrate.py --space P5D     # migrate just one space
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag

# --- Configuration ---------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = ROOT.parent  # /mnt/PeakHour
EXPORT_ROOT = WORKSPACE / "support.peakhourapp.com old"

SPACES = {
    "P5D": {
        "source": EXPORT_ROOT / "P5D",
        "target_dir": ROOT / "src/content/docs/user-guide",
        "section": "user-guide",
        "index_title_strip": "PeakHour 5 Documentation : ",
        # Pure wrapper pages — skip entirely and promote their children.
        "skip_pages": {
            "7012790",  # "PeakHour 5 Documentation"
            "7143445",  # "Manual"
        },
    },
    "P5W": {
        "source": EXPORT_ROOT / "P5W",
        "target_dir": ROOT / "src/content/docs/troubleshooting",
        "section": "troubleshooting",
        "index_title_strip": "PeakHour Wiki : ",
        "skip_pages": {
            "9371724",  # "PeakHour 5 Wiki Home"
            "9502721",  # "PeakHour Wiki"
        },
    },
}

# --- Data model ------------------------------------------------------------

@dataclass
class Page:
    page_id: str
    title: str
    source_file: str           # e.g., "Bandwidth-Monitor_7144228.html"
    parent_id: Optional[str] = None
    children: list[str] = field(default_factory=list)
    depth: int = 0
    order: int = 0
    slug: str = ""             # final slug (filled in later)
    rel_path: Path = field(default_factory=Path)  # path under target_dir

# --- Helpers ---------------------------------------------------------------

SLUG_RE = re.compile(r"[^a-z0-9]+")

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = SLUG_RE.sub("-", s)
    return s.strip("-")


def page_id_from_href(href: str) -> Optional[str]:
    """Extract the Confluence pageId from an href like 'Bandwidth-Monitor_7144228.html'
    or '7144175.html'. Returns the trailing numeric id."""
    m = re.search(r"(\d+)\.html(?:#.*)?$", href)
    return m.group(1) if m else None


# --- TOC parsing -----------------------------------------------------------

def parse_toc(space_key: str, space_config: dict) -> dict[str, Page]:
    """Parse the index.html of a space export and return a pageId -> Page map,
    with hierarchical relationships populated from the nested <ul> structure."""
    index_path = space_config["source"] / "index.html"
    soup = BeautifulSoup(index_path.read_text(encoding="utf-8"), "html.parser")

    pages: dict[str, Page] = {}
    order_counter = [0]

    # The TOC is inside <div class="pageSection"> after the "Available Pages:" header.
    # It's a tree of <ul>/<li>/<a>.
    page_list_section = None
    for section in soup.find_all("div", class_="pageSection"):
        header = section.find("h2", class_="pageSectionTitle")
        if header and "Available Pages" in header.get_text():
            page_list_section = section
            break

    if page_list_section is None:
        raise RuntimeError(f"Could not find Available Pages section in {index_path}")

    def walk(ul: Tag, parent_id: Optional[str], depth: int):
        for li in ul.find_all("li", recursive=False):
            a = li.find("a", recursive=False)
            if a is None:
                continue
            href = a.get("href", "")
            pid = page_id_from_href(href)
            if not pid:
                continue
            title = a.get_text(strip=True)

            page = Page(
                page_id=pid,
                title=title,
                source_file=href,
                parent_id=parent_id,
                depth=depth,
                order=order_counter[0],
            )
            order_counter[0] += 1

            if parent_id and parent_id in pages:
                pages[parent_id].children.append(pid)
            pages[pid] = page

            # Recurse into children: Confluence exports <ul> as sibling of the <a> or nested.
            for child_ul in li.find_all("ul", recursive=False):
                walk(child_ul, pid, depth + 1)

    # Top-level <ul>s live inside the pageSection
    for ul in page_list_section.find_all("ul", recursive=False):
        walk(ul, None, 0)

    return pages


# --- Slug + path planning --------------------------------------------------

def apply_skip_pages(pages: dict[str, Page], skip_ids: set[str]):
    """Remove skip-listed pages from the hierarchy, promoting their children
    to the skipped page's parent. Preserves depth/order correctly."""
    # Process skips in order of depth (shallowest first) so promotions cascade.
    to_skip = sorted((pid for pid in skip_ids if pid in pages),
                     key=lambda pid: pages[pid].depth)
    for pid in to_skip:
        page = pages[pid]
        new_parent = page.parent_id  # may be None if skipping a root
        # Reparent children
        for child_id in page.children:
            child = pages.get(child_id)
            if child is None:
                continue
            child.parent_id = new_parent
            child.depth = max(0, child.depth - 1)
            if new_parent and new_parent in pages:
                pages[new_parent].children.append(child_id)
        # Remove from parent's children list
        if new_parent and new_parent in pages:
            parent_children = pages[new_parent].children
            if pid in parent_children:
                parent_children.remove(pid)
        del pages[pid]


def assign_slugs_and_paths(pages: dict[str, Page], section: str):
    """Decide each page's final slug and relative file path under the section root,
    preserving hierarchy via folder nesting. Pages with children become folders
    with an index file; leaf pages become single .mdx files."""
    used_slugs: set[Path] = set()

    def ancestor_chain(pid: str) -> list[str]:
        chain = []
        cur = pages[pid]
        while cur.parent_id:
            chain.append(cur.parent_id)
            cur = pages[cur.parent_id]
        return list(reversed(chain))

    for pid, page in pages.items():
        base_slug = slugify(page.title)
        if not base_slug:
            base_slug = f"page-{pid}"
        page.slug = base_slug

        chain = ancestor_chain(pid)
        folder_parts = [slugify(pages[a].title) or f"page-{a}" for a in chain]

        if page.children:
            rel = Path(*folder_parts, base_slug, "index.mdx")
        else:
            rel = Path(*folder_parts, f"{base_slug}.mdx")

        # de-duplicate if somehow two titles collide at same level
        n = 2
        while rel in used_slugs:
            stem = rel.stem
            if rel.name == "index.mdx":
                rel = rel.parent.with_name(f"{rel.parent.name}-{n}") / "index.mdx"
            else:
                rel = rel.with_name(f"{stem}-{n}.mdx")
            n += 1
        used_slugs.add(rel)
        page.rel_path = rel


# --- Article conversion ----------------------------------------------------

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

def clean_main_content(main: Tag, source_dir: Path, page: Page,
                        pages: dict[str, Page], image_dest_dir: Path,
                        image_rel_prefix: str,
                        link_rewriter) -> tuple[str, list[tuple[Path, Path]]]:
    """Remove Confluence-specific cruft, rewrite links and images.
    Returns (cleaned HTML string, list of (source_image, dest_image) copies)."""
    image_copies: list[tuple[Path, Path]] = []

    # Strip plugin pagetree (empty at export time)
    for div in main.find_all("div", class_="plugin_pagetree"):
        div.decompose()

    # Strip Confluence's hidden fieldsets left behind by plugins
    for fs in main.find_all("fieldset", class_="hidden"):
        fs.decompose()

    # Rewrite images: use original filename from data-linked-resource-default-alias
    # and copy to image_dest_dir.
    img_counter = 0
    used_image_names: set[str] = set()
    for img in main.find_all("img"):
        src = img.get("src", "")
        if not src or src.startswith("http"):
            continue

        # Images in attachments/<pageId>/<fileId>.ext
        src_no_query = src.split("?", 1)[0]
        src_path = (source_dir / src_no_query).resolve()

        if not src_path.exists():
            # Some images reference icons/ etc. — drop the img if we can't find it.
            img.decompose()
            continue

        # Prefer original filename from Confluence attribute; fall back to fileId.
        orig_name = img.get("data-linked-resource-default-alias") or src_path.name
        # Sanitize filename
        stem = Path(orig_name).stem
        ext = Path(orig_name).suffix.lower() or src_path.suffix.lower()
        clean_stem = slugify(stem) or f"image-{img_counter}"
        candidate = f"{clean_stem}{ext}"
        n = 2
        while candidate in used_image_names:
            candidate = f"{clean_stem}-{n}{ext}"
            n += 1
        used_image_names.add(candidate)
        img_counter += 1

        dest_path = image_dest_dir / candidate
        image_copies.append((src_path, dest_path))

        # Rewrite src to co-located relative path (either ./images/<name>
        # for index articles, or ./<stem>-images/<name> for leaf articles).
        img["src"] = f"{image_rel_prefix}{candidate}"
        # Strip all the Confluence noise attrs
        for attr in list(img.attrs):
            if attr.startswith("data-") or attr in ("loading", "class", "width", "height"):
                if attr == "class":
                    # Keep nothing — Starlight handles styling
                    del img[attr]
                elif attr in ("width", "height"):
                    # Keep width/height for layout stability
                    continue
                else:
                    del img[attr]
        # Ensure alt text — fall back to stem
        if not img.get("alt"):
            img["alt"] = Path(orig_name).stem.replace("_", " ").replace("-", " ")

    # Unwrap Confluence image wrappers (they carry classes that have no meaning outside Confluence)
    for span in main.find_all("span", class_="confluence-embedded-file-wrapper"):
        span.unwrap()

    # Simplify tables so pandoc emits GFM pipe tables rather than raw HTML.
    # Confluence wraps every cell's content in <p>...</p>, which breaks pipe-table
    # conversion. Unwrap single-<p> cells; keep multi-paragraph cells as raw HTML.
    for table in main.find_all("table"):
        # Unwrap div.table-wrap around table if present
        if table.parent and table.parent.name == "div" and \
           "table-wrap" in (table.parent.get("class") or []):
            table.parent.unwrap()
        # Strip confluence-specific classes/attrs on table/th/td
        for el in table.find_all(["table", "tr", "td", "th", "thead", "tbody", "colgroup", "col"]):
            for attr in list(el.attrs):
                if attr in ("class", "data-highlight-colour", "data-table-width",
                             "data-layout", "data-local-id", "style", "colspan", "rowspan"):
                    # Keep colspan/rowspan on td/th since GFM can't express them anyway
                    # — leaving them in will force HTML fallback rendering.
                    if attr in ("colspan", "rowspan") and \
                       el.get(attr) not in (None, "1"):
                        continue
                    del el[attr]
        # Unwrap single-<p> cells so pandoc can produce pipe tables.
        for cell in table.find_all(["td", "th"]):
            children = [c for c in cell.children
                        if not (isinstance(c, NavigableString) and not c.strip())]
            if len(children) == 1 and isinstance(children[0], Tag) \
               and children[0].name == "p":
                children[0].unwrap()

    # Rewrite internal links: <a href="Bandwidth-Monitor_7144228.html"> → new slug
    for a in main.find_all("a"):
        href = a.get("href", "")
        if not href or href.startswith(("http://", "https://", "mailto:", "#")):
            continue
        pid = page_id_from_href(href)
        if pid and pid in pages:
            new_href = link_rewriter(page, pages[pid])
            a["href"] = new_href
            # Strip confluence data-* attrs
            for attr in list(a.attrs):
                if attr.startswith("data-"):
                    del a[attr]

    # Remove <p/> empty tags pandoc dislikes
    for p in main.find_all("p"):
        if not p.get_text(strip=True) and not p.find(["img", "br"]):
            p.decompose()

    return str(main), image_copies


def html_to_markdown(html: str) -> str:
    """Convert HTML string to GitHub-flavored markdown via pandoc."""
    result = subprocess.run(
        ["pandoc",
         "--from=html",
         "--to=gfm-raw_html",     # GFM, strip raw HTML where possible
         "--wrap=none",
         "--atx-headers",          # pandoc <2.11 syntax; renamed to --markdown-headings=atx in later versions
         "-"],
        input=html,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


_IMG_TAG_RE = re.compile(
    r'<img\s+([^>]*?)src="(\./[^"]+)"([^>]*?)/?>',
    re.IGNORECASE,
)


def rewrite_html_img_tags_to_imports(md_body: str) -> tuple[str, list[str]]:
    """Find raw <img src="./..."> HTML tags in MDX and rewrite them to use
    JSX-imported asset modules, so Astro's Vite pipeline resolves the paths.

    Markdown ![](./...) works out of the box; raw <img> does not, because MDX
    treats the tag as JSX and does not run its src through the asset pipeline.

    Returns (rewritten body, list of import statements to prepend).
    """
    imports: list[str] = []
    seen: dict[str, str] = {}  # path -> import var name
    counter = [0]

    def _var_for(path: str) -> str:
        if path in seen:
            return seen[path]
        counter[0] += 1
        name = f"img{counter[0]}"
        seen[path] = name
        imports.append(f"import {name} from '{path}';")
        return name

    def _replace(m: re.Match) -> str:
        before = m.group(1).strip()
        path = m.group(2)
        after = m.group(3).strip()
        var = _var_for(path)
        attrs = " ".join(a for a in (before, after) if a)
        if attrs:
            return f'<img src={{{var}.src}} {attrs} />'
        return f'<img src={{{var}.src}} />'

    new_body = _IMG_TAG_RE.sub(_replace, md_body)
    return new_body, imports


def extract_description(markdown: str, max_len: int = 160) -> str:
    """Pull the first substantive paragraph for frontmatter description."""
    for line in markdown.splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "!", "|", "-", "*", ":::", "<")):
            continue
        # Strip markdown inline formatting for a clean description:
        # 1. Collapse [link text](url) to just the link text
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
        # 2. Drop emphasis markers, inline code, and residual bracket chars
        clean = re.sub(r"[*_`\[\]]", "", clean)
        # 3. Normalize whitespace
        clean = re.sub(r"\s+", " ", clean).strip()
        if len(clean) > 20:
            return (clean[: max_len - 1] + "…") if len(clean) > max_len else clean
    return ""


def yaml_escape(s: str) -> str:
    """Safe YAML string escaping for frontmatter."""
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


# --- Link rewriter factory -------------------------------------------------

def make_link_rewriter(all_pages_by_space: dict[str, dict[str, Page]],
                      page_to_space: dict[str, str]):
    """Return a function (source_page, target_page) -> relative href."""
    def rewrite(src: Page, tgt: Page) -> str:
        # Cross-space links become absolute to the section root.
        src_space = page_to_space.get(src.page_id)
        tgt_space = page_to_space.get(tgt.page_id)
        tgt_section = SPACES[tgt_space]["section"]
        # Build absolute URL path
        tgt_folder_parts = list(tgt.rel_path.parts)
        if tgt_folder_parts[-1] == "index.mdx":
            tgt_folder_parts = tgt_folder_parts[:-1]
        else:
            tgt_folder_parts[-1] = tgt_folder_parts[-1].removesuffix(".mdx")
        path = "/" + "/".join([tgt_section, *tgt_folder_parts]) + "/"
        return path
    return rewrite


# --- Main migration --------------------------------------------------------

def migrate_space(space_key: str, pages: dict[str, Page],
                  all_pages_by_space: dict[str, dict[str, Page]],
                  page_to_space: dict[str, str],
                  only: Optional[str] = None) -> list[tuple[str, str]]:
    """Migrate one space. Returns a list of (old_url_path, new_url_path) redirects."""
    config = SPACES[space_key]
    source_dir: Path = config["source"]
    target_dir: Path = config["target_dir"]
    section: str = config["section"]

    link_rewriter = make_link_rewriter(all_pages_by_space, page_to_space)
    redirects: list[tuple[str, str]] = []

    total = 0
    for pid, page in pages.items():
        if only and page.slug != only:
            continue

        # Paths
        article_target = target_dir / page.rel_path
        article_target.parent.mkdir(parents=True, exist_ok=True)
        # Index articles (folder/index.mdx) can use a shared images/ folder next to them.
        # Leaf articles (folder/name.mdx) need a per-article images folder so siblings
        # don't collide. Both the filesystem path and the markdown reference must agree.
        if article_target.name == "index.mdx":
            image_dest_dir = article_target.parent / "images"
            image_rel_prefix = "./images/"
        else:
            image_dest_dir = article_target.parent / f"{page.rel_path.stem}-images"
            image_rel_prefix = f"./{page.rel_path.stem}-images/"

        # Parse article HTML
        src_html = (source_dir / page.source_file).read_text(encoding="utf-8")
        soup = BeautifulSoup(src_html, "html.parser")
        main = soup.find("div", id="main-content")
        if main is None:
            print(f"  ! skip {page.source_file}: no main-content", file=sys.stderr)
            continue

        cleaned_html, image_copies = clean_main_content(
            main, source_dir, page, {**pages, **{k: v for k, v in
                {pid2: p for other_pages in all_pages_by_space.values()
                 for pid2, p in other_pages.items()}.items() if k not in pages}},
            image_dest_dir, image_rel_prefix, link_rewriter,
        )

        # Copy images
        if image_copies:
            image_dest_dir.mkdir(parents=True, exist_ok=True)
            for src_img, dest_img in image_copies:
                shutil.copy2(src_img, dest_img)

        # Convert HTML → Markdown
        try:
            md_body = html_to_markdown(cleaned_html)
        except subprocess.CalledProcessError as e:
            print(f"  ! pandoc failed on {page.source_file}: {e.stderr}", file=sys.stderr)
            continue

        description = extract_description(md_body)

        # Raw <img src="./..."> tags in MDX don't resolve through Astro's
        # asset pipeline — only markdown ![]() does. Inside <table>/<td> we
        # can't use markdown, so convert each <img> to a JSX import + usage.
        md_body, img_imports = rewrite_html_img_tags_to_imports(md_body)

        # Build frontmatter
        fm_lines = [
            "---",
            f"title: {yaml_escape(page.title)}",
        ]
        if description:
            fm_lines.append(f"description: {yaml_escape(description)}")
        fm_lines += [
            f"sidebar:",
            f"  order: {page.order}",
            "status: needs-review",
            "---",
            "",
            "import NeedsReview from '@/components/NeedsReview.astro';",
        ]
        fm_lines += img_imports
        fm_lines += [
            "",
            "<NeedsReview />",
            "",
            "",
        ]

        article_target.write_text("\n".join(fm_lines) + md_body.lstrip() + "\n",
                                  encoding="utf-8")

        # Build redirect entry
        old_path = f"/wiki/spaces/{space_key}/pages/{pid}/{page.source_file.removesuffix('.html')}"
        new_path = "/" + section + "/" + "/".join(
            part for part in page.rel_path.parts if part != "index.mdx"
        ).removesuffix(".mdx") + "/"
        redirects.append((old_path, new_path))

        total += 1

    print(f"  migrated {total} articles from {space_key}")
    return redirects


# --- Entry point -----------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", choices=list(SPACES.keys()),
                    help="Migrate only this space (default: all)")
    ap.add_argument("--only", help="Migrate only this slug (useful for spot checks)")
    args = ap.parse_args()

    print("Parsing TOCs...")
    all_pages_by_space: dict[str, dict[str, Page]] = {}
    page_to_space: dict[str, str] = {}
    for space_key, config in SPACES.items():
        if args.space and args.space != space_key:
            continue
        pages = parse_toc(space_key, config)
        apply_skip_pages(pages, config.get("skip_pages", set()))
        assign_slugs_and_paths(pages, config["section"])
        all_pages_by_space[space_key] = pages
        for pid in pages:
            page_to_space[pid] = space_key
        print(f"  {space_key}: {len(pages)} pages")

    print("\nMigrating articles...")
    all_redirects: list[tuple[str, str]] = []
    for space_key, pages in all_pages_by_space.items():
        all_redirects += migrate_space(
            space_key, pages, all_pages_by_space, page_to_space, only=args.only
        )

    # Write redirects (only in full-run mode)
    if not args.only:
        redirects_file = ROOT / "public/_redirects"
        existing = redirects_file.read_text(encoding="utf-8")
        marker = "# --- AUTO-GENERATED REDIRECTS BELOW ---"
        header = existing.split(marker)[0] + marker + "\n"
        generated = "\n".join(f"{old}  {new}  301" for old, new in all_redirects) + "\n"
        redirects_file.write_text(header + generated, encoding="utf-8")
        print(f"\nWrote {len(all_redirects)} redirects to public/_redirects")

    print("\nDone.")


if __name__ == "__main__":
    main()
