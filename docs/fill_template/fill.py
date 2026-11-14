"""
Fills the faculty template in place.

The template itself is not restructured: its cover page, headings, guidance
text, Table of Contents field, headers, footers and branding images are all
left exactly as supplied. This script only

  * writes the four cover-table values into the empty cells, and
  * appends content beneath each heading that was already there.

Run from this directory:  python3 fill.py
"""
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ooxml import Media, run, para, h2   # noqa: E402
import content as C                      # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = '/tmp/claude-0/-home-claude/8cb83916-4b53-5580-b498-72a397551dbf/scratchpad/tpl'
UNPACKED = os.path.join(SCRATCH, 'unpacked')
OUT = os.path.join(HERE, '..', '..', 'Deliverable2_Application_Development_Andzani_Ntlemo.docx')

STUDENT = 'Andzani Ntlemo'
STUDENT_NO = 'EDUV4820290'
PROJECT = 'KhupFin Microfinance Management System'
SUBMITTED = 'Block 4, Week 6'

# The empty second cell of each cover-table row, identified by its paragraph id.
COVER_CELLS = {
    '17454F47': STUDENT,
    '186CB213': STUDENT_NO,
    '6533AB14': PROJECT,
    '2326EE46': SUBMITTED,
}


def fill_cover(xml):
    """Write a value into each empty cover-table cell."""
    for para_id, value in COVER_CELLS.items():
        pattern = re.compile(
            r'(<w:p w14:paraId="%s".*?</w:pPr>)(</w:p>)' % para_id, re.S
        )
        if not pattern.search(xml):
            raise SystemExit(f'cover cell {para_id} not found or not empty')
        xml = pattern.sub(
            lambda m: m.group(1) + run(value, b=True) + m.group(2), xml, count=1
        )
    return xml


def insert_after(xml, anchor_text, payload, *, style=None):
    """
    Insert `payload` immediately after the paragraph whose visible text starts
    with `anchor_text`. Anchoring on text keeps this readable and makes a
    failure obvious rather than silent.
    """
    paras = [m for m in re.finditer(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S)]
    for m in paras:
        block = m.group(0)
        if style and f'w:val="{style}"' not in block:
            continue
        text = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', block, re.S))
        text = re.sub(r'\s+', ' ', text).strip()
        if text.startswith(anchor_text):
            return xml[:m.end()] + payload + xml[m.end():]
    raise SystemExit(f'anchor not found: {anchor_text!r}')


def register_media(media):
    """Copy images in and add a relationship for each."""
    media_dir = os.path.join(UNPACKED, 'word', 'media')
    os.makedirs(media_dir, exist_ok=True)
    rels_path = os.path.join(UNPACKED, 'word', '_rels', 'document.xml.rels')
    rels = open(rels_path).read()

    added = []
    for rid, name, src in media.items:
        shutil.copy(src, os.path.join(media_dir, name))
        added.append(
            f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/'
            f'officeDocument/2006/relationships/image" Target="media/{name}"/>'
        )
    rels = rels.replace('</Relationships>', ''.join(added) + '</Relationships>')
    open(rels_path, 'w').write(rels)
    return len(added)


def main():
    if not os.path.isdir(UNPACKED):
        raise SystemExit(f'unpacked template missing at {UNPACKED}')

    doc_path = os.path.join(UNPACKED, 'word', 'document.xml')
    xml = open(doc_path).read()

    # Pick up where the template's own relationship ids leave off.
    rels = open(os.path.join(UNPACKED, 'word', '_rels', 'document.xml.rels')).read()
    next_rid = max(int(n) for n in re.findall(r'Id="rId(\d+)"', rels)) + 1
    media = Media(next_rid)

    print('Filling the template')

    # ---- cover table ----
    xml = fill_cover(xml)
    print(f'  cover table      4 values written')

    # ---- 1.1 Coding: after the last of the a-e guidance list ----
    xml = insert_after(xml, 'Sample MySQL code', C.section_coding(media),
                       style='ListParagraph')
    print('  1.1 Coding       inserted')

    # ---- 1.2 Full-Stack Integration ----
    xml = insert_after(xml, 'You must complete and submit your application',
                       C.section_integration(media))
    print('  1.2 Integration  inserted')

    # ---- 1.3 Code Quality ----
    xml = insert_after(xml, 'Clean, readable, modular code',
                       C.section_quality(media))
    print('  1.3 Code quality inserted')

    # ---- 1.4 Security & Performance ----
    xml = insert_after(xml, 'Strong security (input validation',
                       C.section_security(media))
    print('  1.4 Security     inserted')

    # ---- User Manual: the template's contents page lists one, but the body
    #      has no heading for it, so one is added in the template's own style.
    manual = (
        para([run('User Manual', b=True)], style='Heading1', before=320, after=160)
        + C.section_manual(media)
    )
    # Place it before the closing section properties so it ends the document.
    # The body-level sectPr is the LAST one in the file. Searching forward
    # finds a sectPr nested inside an earlier w:pPr instead, which would splice
    # paragraphs into the middle of another element.
    tail = xml.rindex('</w:body>')
    body_sect = xml.rindex('<w:sectPr', 0, tail)
    xml = xml[:body_sect] + manual + xml[body_sect:]
    print('  User Manual      inserted')

    open(doc_path, 'w').write(xml)
    n = register_media(media)
    print(f'  images           {n} embedded')

    # ---- repack ----
    out = os.path.abspath(OUT)
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(['zip', '-XrDq', out, '.'], cwd=UNPACKED, check=True)
    size = os.path.getsize(out) / 1024 / 1024
    print(f'\nWritten: {out}\nSize:    {size:.2f} MB')


if __name__ == '__main__':
    main()
