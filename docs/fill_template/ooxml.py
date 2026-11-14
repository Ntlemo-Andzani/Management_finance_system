"""
WordprocessingML fragments for filling the faculty template in place.

Everything here reuses styles the template already defines, so nothing about
its look is changed:

  * body text inherits ``Normal``, which the template sets to Arial 12
  * sub-headings use the template's own ``Heading2``
  * the existing ``Heading1`` is left untouched

Code samples are the one exception to Arial: they are set in a monospaced
face, because column alignment carries meaning in code and a proportional
font destroys it.
"""
from html import escape as _esc
import os
import struct

# Page geometry read from the template: 11907 twips wide, 794 twip margins.
TEXT_WIDTH_TWIPS = 11907 - 794 * 2
EMU_PER_INCH = 914400
TWIPS_PER_INCH = 1440
TEXT_WIDTH_EMU = int(TEXT_WIDTH_TWIPS / TWIPS_PER_INCH * EMU_PER_INCH)

CODE_FONT = 'Consolas'
CODE_SIZE = 18          # half-points -> 9pt, so a long line does not wrap
CODE_FILL = 'F2F4F2'
RULE = 'BFC8C2'
ACCENT = '15305D'       # the template's own heading blue


def esc(text):
    return _esc(str(text), quote=False)


# ---------------------------------------------------------------- runs ----
def run(text, *, b=False, i=False, mono=False, size=None, color=None):
    """One text run. Arial 12 unless told otherwise (Normal supplies Arial)."""
    rpr = []
    if mono:
        rpr.append(f'<w:rFonts w:ascii="{CODE_FONT}" w:hAnsi="{CODE_FONT}" w:cs="{CODE_FONT}"/>')
    else:
        rpr.append('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>')
    if b:
        rpr.append('<w:b/>')
    if i:
        rpr.append('<w:i/>')
    if color:
        rpr.append(f'<w:color w:val="{color}"/>')
    sz = size if size is not None else (CODE_SIZE if mono else 24)
    rpr.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    return (f'<w:r><w:rPr>{"".join(rpr)}</w:rPr>'
            f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')


def para(content, *, style=None, after=120, before=0, align=None,
         ind_left=0, shd=None, keep=False, border_bottom=False):
    """
    A paragraph. ``content`` is a string (one plain run) or a list of runs
    already rendered by run().
    """
    if isinstance(content, str):
        content = [run(content)]
    # OOXML fixes the order of pPr's children; out of order, Word rejects the
    # file. The sequence below is the schema's: pStyle, keepNext, pBdr, shd,
    # spacing, ind, jc.
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if keep:
        ppr.append('<w:keepNext/>')
    if border_bottom:
        ppr.append(f'<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" '
                   f'w:color="{RULE}"/></w:pBdr>')
    if shd:
        ppr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    ppr.append(f'<w:spacing w:before="{before}" w:after="{after}" w:line="259" '
               f'w:lineRule="auto"/>')
    if ind_left:
        ppr.append(f'<w:ind w:left="{ind_left}"/>')
    if align:
        ppr.append(f'<w:jc w:val="{align}"/>')
    return f'<w:p><w:pPr>{"".join(ppr)}</w:pPr>{"".join(content)}</w:p>'


def body(text, **kw):
    return para(text, **kw)


def rich(parts, **kw):
    """Mixed runs: strings are plain, dicts carry {t, b, i, mono}."""
    runs = []
    for p in parts:
        if isinstance(p, str):
            runs.append(run(p))
        else:
            runs.append(run(p['t'], b=p.get('b', False), i=p.get('i', False),
                            mono=p.get('mono', False)))
    return para(runs, **kw)


def h2(text):
    """The template's own Heading2 — Arial bold 14, so it matches its look."""
    return para([run(text, b=True, size=28)], style='Heading2',
                before=260, after=120, keep=True)


def h3(text):
    return para([run(text, b=True, size=24)], before=200, after=80, keep=True)


def bullets(items):
    """Indented bullets drawn with a literal marker plus a hanging indent."""
    out = []
    for it in items:
        parts = [it] if isinstance(it, str) else it
        runs = [run('• ')]
        for p in parts:
            if isinstance(p, str):
                runs.append(run(p))
            else:
                runs.append(run(p['t'], b=p.get('b', False), mono=p.get('mono', False)))
        out.append(
            f'<w:p><w:pPr>'
            f'<w:spacing w:after="80" w:line="259" w:lineRule="auto"/>'
            f'<w:ind w:left="567" w:hanging="283"/></w:pPr>'
            f'{"".join(runs)}</w:p>'
        )
    return ''.join(out)


def code(lines, caption=None):
    """A shaded monospaced block, with the source file named above it."""
    out = []
    if caption:
        out.append(para([run(caption, b=True, mono=True, size=18, color=ACCENT)],
                        before=140, after=40, keep=True))
    if isinstance(lines, str):
        lines = lines.split('\n')
    for n, ln in enumerate(lines):
        out.append(para([run(ln if ln else ' ', mono=True)],
                        shd=CODE_FILL, after=0, before=(40 if n == 0 else 0),
                        ind_left=113))
    out.append(para([run(' ', size=12)], after=120))
    return ''.join(out)


# -------------------------------------------------------------- tables ----
def table(headers, rows, widths):
    """Data table with a shaded header row, matching the template's borders."""
    total = sum(widths)

    def cell(text, w, *, head=False, mono=False):
        shd = ('<w:shd w:val="clear" w:color="auto" w:fill="DCE3EC"/>'
               if head else '')
        content = text if isinstance(text, dict) else {'t': text}
        # Table text is body text, so it stays Arial 12 like the rest of the
        # document; only code-ish cells drop to the monospaced face.
        r = run(content['t'], b=head, mono=content.get('mono', False) or mono,
                size=24 if not content.get('mono') else 18)
        return (
            f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{shd}'
            # CT_TcMar fixes this order: top, left, bottom, right.
            f'<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
            f'<w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>'
            f'<w:vAlign w:val="center"/></w:tcPr>'
            f'<w:p><w:pPr><w:spacing w:after="0" w:line="259" w:lineRule="auto"/></w:pPr>'
            f'{r}</w:p></w:tc>'
        )

    b = (f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>'
         f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>'
         f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>'
         f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>'
         f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>'
         f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="{RULE}"/>')

    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    head_row = ('<w:tr><w:trPr><w:tblHeader/></w:trPr>'
                + ''.join(cell(h, widths[i], head=True) for i, h in enumerate(headers))
                + '</w:tr>')
    data_rows = ''.join(
        '<w:tr>' + ''.join(cell(c, widths[i]) for i, c in enumerate(r)) + '</w:tr>'
        for r in rows
    )
    return (
        f'<w:tbl><w:tblPr><w:tblW w:w="{total}" w:type="dxa"/>'
        f'<w:tblBorders>{b}</w:tblBorders></w:tblPr>'
        f'<w:tblGrid>{grid}</w:tblGrid>{head_row}{data_rows}</w:tbl>'
        # a gap so the next paragraph is not flush against the bottom border
        + para([run(' ', size=12)], after=120)
    )


# -------------------------------------------------------------- images ----
def jpeg_size(path):
    """Read a JPEG's pixel dimensions without pulling in an image library."""
    with open(path, 'rb') as fh:
        data = fh.read()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w, h
        i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
    raise ValueError(f'not a JPEG: {path}')


class Media:
    """Collects images and hands out relationship ids."""

    def __init__(self, next_rid):
        self.next_rid = next_rid
        self.items = []          # (rid, filename, source path)
        self._docpr = 1000

    def add(self, src):
        name = os.path.basename(src)
        for rid, fn, _ in self.items:
            if fn == name:
                return rid
        rid = f'rId{self.next_rid}'
        self.next_rid += 1
        self.items.append((rid, name, src))
        return rid

    def picture(self, src, *, max_w_in=6.6, max_h_in=4.3):
        """A centred image scaled to fit the text column and one page."""
        rid = self.add(src)
        px_w, px_h = jpeg_size(src)
        w_in = max_w_in
        h_in = px_h * w_in / px_w
        if h_in > max_h_in:
            h_in = max_h_in
            w_in = px_w * h_in / px_h
        cx, cy = int(w_in * EMU_PER_INCH), int(h_in * EMU_PER_INCH)
        self._docpr += 1
        pid = self._docpr
        return (
            # spacing must precede jc — CT_PPrBase fixes the order.
            '<w:p><w:pPr><w:spacing w:before="120" w:after="60"/>'
            '<w:jc w:val="center"/></w:pPr>'
            '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/>'
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
            f'<wp:docPr id="{pid}" name="Picture {pid}"/>'
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks '
            'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:nvPicPr><pic:cNvPr id="{pid}" name="Picture {pid}"/>'
            '<pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/>'
            '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
            f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
            '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
        )

    def figure(self, src, caption, **kw):
        return self.picture(src, **kw) + para(
            [run(caption, i=True, size=20)], align='center', after=200
        )
