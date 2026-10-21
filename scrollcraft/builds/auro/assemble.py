"""Assemble the AURO landing page.

dist/      standalone site: index.html with the three middle acts pasted in, plus css/js/assets/engine.
artifact/  the same page as a claude.ai Artifact fragment (no doctype/html/head/body; the host wraps it).
"""
import os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'dist')
ART = os.path.join(HERE, 'artifact')
COPY = ['scrollcraft.js', 'scrollcraft.css', 'css', 'js', 'assets']


def build_page():
    html = open(os.path.join(HERE, 'index.html'), encoding='utf-8').read()
    for n in (2, 3, 4):
        part = open(os.path.join(HERE, 'partials', f'act{n}.html'), encoding='utf-8').read().strip()
        marker = f'<!--ACT{n}-->'
        if marker not in html:
            raise SystemExit(f'missing marker {marker} in index.html')
        html = html.replace(marker, part)
    return html


def fresh(dirpath, html):
    if os.path.exists(dirpath):
        shutil.rmtree(dirpath)
    os.makedirs(dirpath)
    for item in COPY:
        src = os.path.join(HERE, item)
        dst = os.path.join(dirpath, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.exists(src):
            shutil.copy2(src, dst)
    open(os.path.join(dirpath, 'index.html'), 'w', encoding='utf-8').write(html)


def to_fragment(html):
    """Strip the document wrapper; keep head content and body content in order."""
    head = re.search(r'<head[^>]*>(.*?)</head>', html, re.S | re.I).group(1)
    body_m = re.search(r'<body([^>]*)>(.*?)</body>', html, re.S | re.I)
    body_attrs, body = body_m.group(1), body_m.group(2)
    head = re.sub(r'<meta[^>]+(charset|name="viewport")[^>]*>\s*', '', head, flags=re.I)
    title = re.search(r'<title>.*?</title>', head, re.S | re.I)
    head_rest = head.replace(title.group(0), '') if title else head
    html_attrs = re.search(r'<html([^>]*)>', html, re.I).group(1)
    lang = re.search(r'lang="([^"]+)"', html_attrs)
    direction = re.search(r'dir="([^"]+)"', html_attrs)
    cls = re.search(r'class="([^"]+)"', body_attrs)
    boot = ('<script>(function(){var d=document.documentElement;'
            + (f'd.lang="{lang.group(1)}";' if lang else '')
            + (f'd.dir="{direction.group(1)}";' if direction else '')
            + (f'document.addEventListener("DOMContentLoaded",function(){{document.body.className+=" {cls.group(1)}";}});' if cls else '')
            + '})();</script>')
    return (title.group(0) if title else '') + '\n' + boot + '\n' + head_rest.strip() + '\n' + body.strip() + '\n'


if __name__ == '__main__':
    page = build_page()
    fresh(DIST, page)
    fresh(ART, to_fragment(page))
    n = sum(len(fs) for _, _, fs in os.walk(ART))
    print('dist and artifact written;', n, 'files in artifact')
