"""Typeset the site's approved manuscript text, without rewriting its contents."""
import json
import os
import sys
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, PageBreak, Spacer
from reportlab.platypus.tableofcontents import TableOfContents
from pypdf import PdfReader
import pdfplumber

source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
output = Path(sys.argv[2])
font_dir = Path(os.environ.get('PDF_FONT_DIR', str(Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts')))
for name, filename in [('Manuscript', 'times.ttf'), ('Manuscript-Bold', 'timesbd.ttf'), ('Manuscript-Italic', 'timesi.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
pdfmetrics.registerFontFamily('Manuscript', normal='Manuscript', bold='Manuscript-Bold', italic='Manuscript-Italic', boldItalic='Manuscript-Bold')

INK = colors.HexColor('#252525')
MUTED = colors.HexColor('#666666')
ACCENT = colors.HexColor('#b66b2e')
WIDTH, HEIGHT = A4
LEFT, RIGHT, TOP, BOTTOM = 25*mm, 23*mm, 24*mm, 23*mm

body = ParagraphStyle('Body', fontName='Manuscript', fontSize=11.5, leading=16, textColor=INK,
                      spaceAfter=7, allowWidows=0, allowOrphans=0, splitLongWords=False)
styles = {
    'title': ParagraphStyle('Title', parent=body, fontName='Manuscript-Bold', fontSize=32, leading=36, spaceAfter=20),
    'author': ParagraphStyle('Author', parent=body, fontSize=17, leading=23, spaceAfter=18),
    'note': ParagraphStyle('Note', parent=body, fontSize=11, leading=16, textColor=MUTED, spaceAfter=12),
    'h2': ParagraphStyle('Section', parent=body, fontName='Manuscript-Bold', fontSize=19, leading=24, spaceBefore=15, spaceAfter=14, keepWithNext=True),
    'h3': ParagraphStyle('Subheading', parent=body, fontName='Manuscript-Bold', fontSize=14, leading=19, spaceBefore=13, spaceAfter=8, keepWithNext=True),
    'toc': ParagraphStyle('ContentsEntry', parent=body, fontSize=11.5, leading=17, spaceBefore=8, spaceAfter=7, leftIndent=0, firstLineIndent=0),
}


class ManuscriptDoc(BaseDocTemplate):
    def __init__(self, filename, lang):
        self.lang = lang
        self.outline_index = 0
        super().__init__(str(filename), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT,
                         topMargin=TOP, bottomMargin=BOTTOM, pageCompression=1,
                         title='Тезисы 2020-2026' if lang=='ru' else 'Theses 2020-2026',
                         author='Руслан Назаров' if lang=='ru' else 'Ruslan Nazarov')
        frame = Frame(LEFT, BOTTOM, WIDTH-LEFT-RIGHT, HEIGHT-TOP-BOTTOM, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='Manuscript', frames=[frame], onPage=self.decorate))

    def beforeDocument(self):
        self.outline_index = 0

    def decorate(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setFont('Manuscript', 9)
        canvas.setFillColor(MUTED)
        canvas.drawString(LEFT, HEIGHT-15*mm, 'Руслан Назаров' if self.lang=='ru' else 'Ruslan Nazarov')
        canvas.drawRightString(WIDTH-RIGHT, HEIGHT-15*mm, 'Тезисы 2020-2026' if self.lang=='ru' else 'Theses 2020-2026')
        canvas.setStrokeColor(colors.HexColor('#dddddd'))
        canvas.setLineWidth(.4)
        canvas.line(LEFT, HEIGHT-18*mm, WIDTH-RIGHT, HEIGHT-18*mm)
        canvas.drawCentredString(WIDTH/2, 13*mm, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Section':
            self.outline_index += 1
            key = f'section-{self.outline_index}'
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(), key, level=0, closed=False)
            self.notify('TOCEntry', (0, flowable.getPlainText(), self.page, key))


def normalize(text):
    return ''.join(text.split())


summary = []
for item in source['documents']:
    lang = item['lang']
    ru = lang == 'ru'
    # Fail rather than silently emitting empty boxes for unsupported characters.
    for block in item['blocks']:
        font = 'Manuscript-Bold' if block['type']=='heading' else 'Manuscript'
        missing = {c for c in block['text'] if not c.isspace() and ord(c) not in pdfmetrics.getFont(font).face.charToGlyph}
        if missing:
            raise ValueError(f'Unsupported manuscript glyphs: {missing}')
    path = output / f'theses-{lang}.pdf'
    doc = ManuscriptDoc(path, lang)
    story = [Spacer(1, 34*mm), Paragraph('Тезисы 2020-2026' if ru else 'Theses 2020-2026', styles['title']),
             Paragraph('Руслан Назаров' if ru else 'Ruslan Nazarov', styles['author']),
             Paragraph('Октябрьская редакция 2026 года' if ru else 'October 2026 revision', styles['note'])]
    if source['draft']:
        story += [Spacer(1, 8*mm), Paragraph('Черновик для авторской вычитки' if ru else 'Draft for author review', styles['note'])]
    note = ('Авторские тезисы к будущей книге. Включены введение и восемь разделов и подразделов октябрьской редакции. Незавершённое предисловие исключено.' if ru else
            'Authorial theses for a forthcoming book. Includes the introduction and eight sections and subsections of the October revision. The unfinished preface is excluded.')
    story += [Spacer(1, 30*mm), Paragraph(note, styles['note'])]
    if not ru:
        story += [Paragraph('Translated with AI assistance using an author-approved glossary. The authorial claims, order and numbering are preserved.', styles['note'])]
    story += [Paragraph('https://ruslan-nazarov.github.io/' + lang + '/publications/theses-2020-2026/', styles['note']), PageBreak()]
    # This title is deliberately distinct from the actual manuscript section style.
    story += [Paragraph('Содержание' if ru else 'Contents', styles['title'])]
    contents = TableOfContents()
    contents.levelStyles = [styles['toc']]
    contents.dotsMinLevel = 0
    story += [contents, PageBreak()]
    for block in item['blocks']:
        if block['type']=='heading':
            title = block['text']
            depth = block['depth']
            story.append(Paragraph(escape(title), styles['h2' if depth==2 else 'h3']))
        else:
            story.append(Paragraph(escape(block['text']), body))
    doc.multiBuild(story)
    reader = PdfReader(path)
    with pdfplumber.open(path) as pdf:
        rendered = normalize('\n'.join(page.crop((0, 60, float(page.width), float(page.height)-55)).extract_text() or '' for page in pdf.pages[2:]))
    pos = 0
    for block in item['blocks']:
        value = normalize(block['text'])
        found = rendered.find(value, pos)
        if found < 0:
            raise ValueError(f'Text missing or reordered in {lang}: {block["text"][:120]}')
        pos = found + len(value)
    if len(reader.outline) != 9:
        raise ValueError(f'Expected nine manuscript sections in {lang}')
    summary.append({'language': lang, 'pages': len(reader.pages), 'paragraphsAndHeadings': len(item['blocks']), 'allSourceTextVerified': True, 'path': str(path)})

print(json.dumps(summary, ensure_ascii=False, indent=2))
