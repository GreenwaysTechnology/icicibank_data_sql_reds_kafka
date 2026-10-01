"""Build Kafka_Connect_Lab_Guide.pdf from the Markdown chapters in ./guide.

Markdown -> one styled HTML page (python-markdown) -> PDF (headless Chrome / Edge).
Theme: the Kafka pack's "Graphite & Tangerine" (Bahnschrift, Segoe UI, Consolas).

    python build_pdf.py            # writes Kafka_CLI_Lab_Guide.pdf (and .html for checking)

Needs:  pip install markdown
Admonitions use the  !!! kind "Title"  syntax with a 4-space indented body; kinds:
note, tip, warning, solution.

A line  <!-- include: path/to/File.java -->  (path relative to this folder) is
replaced by that file as a fenced code block, so the listings in the book are
always the code in the project.
"""
import html
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
GUIDE = ROOT / "guide"
OUT_PDF = ROOT / "Kafka_Connect_Lab_Guide.pdf"
OUT_HTML = ROOT / "_capture" / "Kafka_Connect_Lab_Guide.html"

TITLE = "Apache Kafka Connect Lab Guide"
EDITION = "Kafka Connect 4.3.1 on Docker  ·  October 2026"

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

MD_EXT = ["fenced_code", "tables", "sane_lists"]

ADM_RE = re.compile(r'^!!!\s+(\w+)(?:\s+"([^"]*)")?\s*$')
LABEL = {"note": "Note", "tip": "Tip", "warning": "Watch out", "solution": "Solution"}


INCLUDE_RE = re.compile(r"^<!--\s*include:\s*(\S+)\s*-->\s*$", re.M)
FENCE = {".java": "java", ".yml": "yaml", ".yaml": "yaml", ".xml": "xml", ".json": "json",
         ".ps1": "powershell", ".http": "http", ".properties": "properties", ".sql": "sql",
         ".sh": "connect"}


def includes(md_text):
    """Replace  <!-- include: path -->  with that file as a code block, captioned with its name."""
    def one(m):
        path = ROOT / m.group(1)
        code = path.read_text(encoding="utf-8").rstrip("\n")
        return (f'<p class="file">{html.escape(path.name)}</p>\n\n'
                f'```{FENCE.get(path.suffix, "text")}\n{code}\n```')
    return INCLUDE_RE.sub(one, md_text)


def render(md_text):
    """Markdown -> HTML, with !!! admonitions rendered separately and put back."""
    lines = md_text.replace("\r\n", "\n").split("\n")
    out, blocks, i = [], [], 0
    while i < len(lines):
        m = ADM_RE.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue
        kind, title = m.group(1), m.group(2) or LABEL.get(m.group(1), m.group(1).title())
        i += 1
        body = []
        while i < len(lines) and (lines[i].startswith("    ") or not lines[i].strip()):
            body.append(lines[i])
            i += 1
        while body and not body[-1].strip():          # trailing blank lines belong outside
            body.pop()
            i -= 1
        inner = render(textwrap.dedent("\n".join(body)))
        blocks.append(f'<div class="adm {kind}"><div class="adm-title">{html.escape(title)}</div>'
                      f'<div class="adm-body">{inner}</div></div>')
        out += ["", f"ADMONITION{len(blocks) - 1}END", ""]
    result = markdown.markdown("\n".join(out), extensions=MD_EXT)
    for n, b in enumerate(blocks):
        result = result.replace(f"<p>ADMONITION{n}END</p>", b)
    return result


def polish(body):
    """Small HTML touches: shell comments dimmed, code-block labels."""
    def comments(m):
        cls, code = m.group(1), m.group(2)
        if cls in ("language-kafka", "language-powershell", "language-connect",
                   "language-properties"):
            code = re.sub(r"^(#.*)$", r'<span class="cm">\1</span>', code, flags=re.M)
        elif cls == "language-yaml":
            code = re.sub(r"((?:^|\s)#.*)$", r'<span class="cm">\1</span>', code, flags=re.M)
        elif cls == "language-java":
            code = re.sub(r"(/\*.*?\*/)", r'<span class="cm">\1</span>', code, flags=re.S)
            code = re.sub(r"((?:^|\s)//.*)$", r'<span class="cm">\1</span>', code, flags=re.M)
        elif cls == "language-sql":
            code = re.sub(r"((?:^|\s)--.*)$", r'<span class="cm">\1</span>', code, flags=re.M)
        elif cls == "language-xml":
            code = re.sub(r"(&lt;!--.*?--&gt;)", r'<span class="cm">\1</span>', code, flags=re.S)
        return f'<pre class="{cls}"><code class="{cls}">{code}</code></pre>'
    body = re.sub(r'<pre><code class="(language-[\w-]+)">(.*?)</code></pre>', comments, body,
                  flags=re.S)
    body = re.sub(r'<pre><code>', '<pre class="language-output"><code>', body)
    return body


CSS = r"""
@page {
  size: A4;
  margin: 17mm 15mm 17mm 15mm;
  @top-left { content: "APACHE KAFKA  ·  CONNECT LAB GUIDE"; font: 600 7.5pt 'Segoe UI', sans-serif;
              letter-spacing: .12em; color: #A8A29E; }
  @top-right { content: "Kafka Connect 4.3.1 · Docker"; font: 7.5pt 'Segoe UI', sans-serif; color: #A8A29E; }
  @bottom-right { content: counter(page); font: 8pt 'Bahnschrift SemiBold', 'Segoe UI', sans-serif;
                  color: #EA580C; }
  @bottom-left { content: "Outputs captured from Kafka Connect on a 3-broker Apache Kafka 4.3.1 cluster";
                 font: 7.5pt 'Segoe UI', sans-serif; color: #A8A29E; }
}
@page cover { margin: 0; @top-left { content: none; } @top-right { content: none; }
              @bottom-right { content: none; } @bottom-left { content: none; } }
:root { --ink:#1C1917; --mid:#44403C; --mute:#78716C; --faint:#A8A29E; --line:#E7E5E0; --card:#F7F6F3;
        --tan:#EA580C; --tan-dk:#C2410C; --tan-bg:#FFEDD5; --cyan:#0E7490; --cyan-bg:#D9F2F7;
        --gold:#A16207; --gold-bg:#FEF9C3; --indigo:#4F46E5; --indigo-bg:#E0E7FF; --graphite:#18181B;
        --green:#15803D; --green-bg:#DCFCE7; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.6pt; line-height: 1.5; color: var(--ink);
       margin: 0; }

/* cover */
.cover { page: cover; height: 297mm; background: var(--graphite); color: #fff; position: relative;
         overflow: hidden; break-after: page; }
.cover .edge { position: absolute; left: 0; top: 0; bottom: 0; width: 9mm; background: var(--tan); }
.cover .inner { position: absolute; left: 26mm; right: 20mm; top: 48mm; }
.cover .kicker { font: 600 10pt 'Segoe UI'; letter-spacing: .32em; color: #FB923C; }
.cover h1 { font: 38pt/1.1 'Bahnschrift SemiBold', 'Segoe UI', sans-serif; margin: 10mm 0 5mm; color: #fff;
            border: 0; }
.cover .sub { font-size: 14pt; color: #D6D3D1; max-width: 140mm; }
.cover .chips { margin-top: 12mm; }
.cover .chip { display: inline-block; border: 1.2pt solid #C2410C; color: #FDBA74; border-radius: 12pt;
               padding: 2.5pt 11pt; margin: 0 5pt 6pt 0; font: 600 9pt Consolas, monospace; }
.cover .toc { margin-top: 16mm; column-count: 2; column-gap: 12mm; }
.cover .toc div { font-size: 9.6pt; color: #E7E5E4; padding: 2mm 0; border-bottom: .6pt solid #3F3F46;
                  break-inside: avoid; display: flex; }
.cover .toc b { color: #FB923C; font-family: 'Bahnschrift SemiBold'; font-weight: normal;
                flex: 0 0 9mm; }
.cover .cells { position: absolute; left: 26mm; bottom: 26mm; }
.cover .cells span { display: inline-block; width: 9mm; height: 6mm; margin-right: 1.6mm; border-radius: 1mm;
                     background: #27272A; color: #78716C; font: 7pt Consolas; text-align: center;
                     line-height: 6mm; }
.cover .cells span.h1 { background: #7C2D12; color: #fff; } .cover .cells span.h2 { background: #C2410C; color:#fff; }
.cover .cells span.h3 { background: #EA580C; color: #fff; } .cover .cells span.h4 { background: #FB923C; color:#fff; }
.cover .foot { position: absolute; left: 26mm; bottom: 14mm; font-size: 9pt; color: #A8A29E; }

/* chapters */
.chapter { break-before: page; }
.chapter:first-of-type { break-before: auto; }
h1 { font: 22pt/1.15 'Bahnschrift SemiBold', 'Segoe UI', sans-serif; color: var(--graphite); margin: 0 0 4mm;
     padding: 0 0 3mm; border-bottom: 2.4pt solid var(--tan); }
h2 { font: 13.5pt/1.25 'Bahnschrift SemiBold', 'Segoe UI', sans-serif; color: var(--graphite);
     margin: 7mm 0 2.5mm; padding-left: 3mm; border-left: 3.2pt solid var(--tan); break-after: avoid; }
h3 { font: 11pt 'Bahnschrift SemiBold', 'Segoe UI', sans-serif; color: var(--tan-dk); margin: 5mm 0 2mm;
     break-after: avoid; }
p { margin: 1.6mm 0 2.2mm; }
ul, ol { margin: 1.5mm 0 2.5mm; padding-left: 6mm; }
li { margin: .8mm 0; }
strong { color: var(--graphite); }
a { color: var(--cyan); text-decoration: none; }
code { font-family: Consolas, monospace; font-size: 8.6pt; background: var(--card); border: .5pt solid var(--line);
       border-radius: 2pt; padding: 0 2pt; color: var(--tan-dk); }

/* code blocks */
pre { margin: 2mm 0 3mm; border-radius: 3pt; padding: 4.4mm 3.5mm 2.6mm; position: relative; line-height: 1.32;
      white-space: pre-wrap; overflow-wrap: anywhere; break-inside: auto; }
pre code { display: block; background: none; border: 0; padding: 0; color: inherit; font-size: 8.1pt;
            line-height: 1.32; }
pre::before { position: absolute; top: 0; right: 0; font: 600 6.5pt 'Segoe UI', sans-serif;
              letter-spacing: .1em; padding: 1pt 6pt; border-radius: 0 3pt 0 3pt; }
pre.language-kafka { background: var(--graphite); color: #E7E5E4; border-left: 3pt solid var(--tan); }
pre.language-kafka::before { content: "KAFKA1 SHELL"; background: var(--tan); color: #fff; }
pre.language-powershell { background: #0F2537; color: #E2E8F0; border-left: 3pt solid #38BDF8; }
pre.language-powershell::before { content: "POWERSHELL"; background: #0369A1; color: #fff; }
pre.language-java, pre.language-yaml, pre.language-xml { background: #1C1B22; color: #E7E5E4;
                                                         border-left: 3pt solid #22D3EE; }
pre.language-java::before { content: "JAVA"; background: var(--cyan); color: #fff; }
pre.language-yaml::before { content: "YAML"; background: var(--cyan); color: #fff; }
pre.language-xml::before { content: "XML"; background: var(--cyan); color: #fff; }
pre.language-java .cm, pre.language-yaml .cm, pre.language-xml .cm { color: #8A9AA3; }
pre.language-connect { background: #1F2A1E; color: #E7E5E4; border-left: 3pt solid #84CC16; }
pre.language-connect::before { content: "CONNECT1 SHELL"; background: #4D7C0F; color: #fff; }
pre.language-sql { background: #172033; color: #E2E8F0; border-left: 3pt solid #818CF8; }
pre.language-sql::before { content: "PSQL"; background: var(--indigo); color: #fff; }
pre.language-properties { background: #1C1B22; color: #E7E5E4; border-left: 3pt solid #22D3EE; }
pre.language-properties::before { content: "PROPERTIES"; background: var(--cyan); color: #fff; }
pre.language-connect .cm, pre.language-sql .cm, pre.language-properties .cm { color: #8A9AA3; }
pre.language-json, pre.language-http { background: #fff; color: var(--mid); border: .6pt solid var(--line);
                                        border-left: 3pt solid var(--indigo); }
pre.language-json::before { content: "JSON"; background: var(--indigo); color: #fff; }
pre.language-http::before { content: "HTTP"; background: var(--indigo); color: #fff; }
pre.language-text { background: #fff; color: var(--ink); border: .6pt solid var(--line);
                    border-left: 3pt solid var(--tan); line-height: 1.22; white-space: pre; overflow: hidden; }
pre.language-text code { font-size: 7.6pt; line-height: 1.22; }
pre.language-text::before { content: "DIAGRAM"; background: var(--tan-bg); color: var(--tan-dk); }
.adm pre.language-output code { font-size: 7.1pt; }   /* wide CLI tables fit inside a solution box */
p.file { font: 600 8.2pt Consolas, monospace; color: var(--cyan); margin: 4mm 0 -1mm; }
pre.language-output { background: var(--card); color: var(--mid); border: .6pt solid var(--line);
                      border-left: 3pt solid var(--faint); }
pre.language-output::before { content: "OUTPUT"; background: var(--line); color: var(--mute); }
pre.language-output code { font-size: 7.6pt; }
.cm { color: #8A8580; font-style: italic; }
pre.language-powershell .cm { color: #7DA2C3; }

/* tables */
table { border-collapse: collapse; width: 100%; margin: 2mm 0 3.5mm; font-size: 8.6pt; break-inside: auto; }
th { background: var(--graphite); color: #fff; text-align: left; font-weight: 600; padding: 1.6mm 2.2mm; }
td { border-bottom: .6pt solid var(--line); padding: 1.4mm 2.2mm; vertical-align: top; }
tr:nth-child(even) td { background: #FBFAF8; }
td code, th code { font-size: 7.9pt; }

/* admonitions */
.adm { margin: 3mm 0 4mm; border-radius: 3pt; padding: 2.4mm 3.6mm 1.2mm; break-inside: auto; }
.adm-title { font: 600 7.8pt 'Segoe UI', sans-serif; letter-spacing: .12em; text-transform: uppercase;
             margin-bottom: 1mm; }
.adm.note { background: var(--indigo-bg); border-left: 3pt solid var(--indigo); }
.adm.note .adm-title { color: var(--indigo); }
.adm.tip { background: var(--cyan-bg); border-left: 3pt solid var(--cyan); }
.adm.tip .adm-title { color: var(--cyan); }
.adm.warning { background: var(--gold-bg); border-left: 3pt solid var(--gold); }
.adm.warning .adm-title { color: var(--gold); }
.adm.solution { background: #fff; border: .8pt solid #BBF7D0; border-left: 3pt solid var(--green);
                padding-top: 2.8mm; }
.adm.solution .adm-title { color: var(--green); }
.adm.solution .adm-title::before { content: "\2714  "; }
.adm pre.language-output { background: #fff; }
.adm.solution pre.language-output { background: var(--card); }

/* "Task" paragraphs */
p.task { background: var(--tan-bg); border-left: 3pt solid var(--tan); padding: 2mm 3mm; border-radius: 3pt; }
"""


def cover(chapters):
    toc = "".join(f"<div><b>{n}</b><span>{html.escape(t)}</span></div>" for n, t in chapters)
    cells = "".join(f'<span class="{c}">{i}</span>' for i, c in
                    enumerate(["", "", "", "", "", "", "", "", "h1", "h2", "h3", "h4"]))
    chips = "".join(f'<span class="chip">{c}</span>' for c in
                    ("FILESTREAM", "JDBC", "POSTGRESQL", "SMT", "PREDICATES", "DLQ", "REST API",
                     "WORKERS"))
    return f"""<section class="cover"><div class="edge"></div><div class="inner">
<div class="kicker">APACHE KAFKA TRAINING  ·  CONNECT LAB</div>
<h1>Apache Kafka<br>Connect Lab Guide</h1>
<div class="sub">Move data between files, PostgreSQL and Kafka with free connectors only - FileStream
and JDBC - then transform it with SMTs, catch bad records in a dead letter queue, and scale the
Connect cluster. Every output was captured on the CLI lab's three-broker Kafka 4.3.1 cluster.</div>
<div class="chips">{chips}</div>
<div class="toc">{toc}</div></div>
<div class="cells">{cells}</div>
<div class="foot">{EDITION}</div></section>"""


def main():
    files = sorted(GUIDE.glob("*.md"))
    parts, chapters = [], []
    for f in files:
        text = includes(f.read_text(encoding="utf-8"))
        title = re.search(r"^# (.+)$", text, re.M).group(1)
        num, _, name = title.partition(" · ")
        chapters.append((num.replace("Lab ", ""), name))
        body = polish(render(text))
        body = re.sub(r"<p><strong>Task:</strong>", '<p class="task"><strong>Task:</strong>', body)
        parts.append(f'<section class="chapter">{body}</section>')
    page = (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{TITLE}</title>"
            f"<style>{CSS}</style></head><body>{cover(chapters)}{''.join(parts)}</body></html>")
    OUT_HTML.parent.mkdir(exist_ok=True)
    OUT_HTML.write_text(page, encoding="utf-8")

    browser = next((b for b in BROWSERS if Path(b).exists()), None)
    if not browser:
        sys.exit("Chrome or Edge not found - open the HTML file and print it to PDF instead.")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        f"--user-data-dir={Path(tmp) / 'profile'}", f"--print-to-pdf={OUT_PDF}",
                        OUT_HTML.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
    print(f"{OUT_PDF.name}: {OUT_PDF.stat().st_size // 1024} KB, {len(files)} chapters")


if __name__ == "__main__":
    main()
