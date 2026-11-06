"""Builds the animated SVG diagrams used in the README.

Divina Machina visual language: 1 px grid, graphite drawing, Roboto Mono labels,
Bricolage Grotesque titles, slow and quiet motion. Every SVG follows
prefers-color-scheme and stands still under prefers-reduced-motion.

    python3 docs/anim/build.py
"""

import math
from pathlib import Path

OUT = Path(__file__).parent

SANS = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif"
MONO = "'Roboto Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

BASE_CSS = f"""
svg{{--bg:#FFFFFF;--ink:#30302E;--txt:#3B3B3B;--sec:#474747;--line:#C6C5C0;--draw:#8A8984;--soft:#E7E6E1}}
@media (prefers-color-scheme:dark){{
 svg{{--bg:#000000;--ink:#F2F2F2;--txt:#E7E6E1;--sec:#C6C5C0;--line:#474747;--draw:#8A8984;--soft:#30302E}}
}}
.bg{{fill:var(--bg)}} .ink{{fill:var(--ink)}} .txt{{fill:var(--txt)}} .sec{{fill:var(--sec)}}
.ln{{stroke:var(--line);stroke-width:1;fill:none}}
.lnk{{stroke:var(--ink);stroke-width:1;fill:none}}
.gr{{stroke:var(--draw);stroke-width:1;fill:none}}
.dash{{stroke-dasharray:3 4}}
.mono{{font-family:{MONO};font-size:11px;letter-spacing:.04em}}
.mono-s{{font-family:{MONO};font-size:10px;letter-spacing:.04em}}
.cap{{text-transform:uppercase}}
.h1{{font-family:{SANS};font-size:24px;letter-spacing:-.02em}}
.h2{{font-family:{SANS};font-size:16px;letter-spacing:-.01em}}
.h3{{font-family:{SANS};font-size:15px}}
.end{{text-anchor:end}} .mid{{text-anchor:middle}}
@media (prefers-reduced-motion:reduce){{ *{{animation:none!important}} }}
"""


def svg(w, h, title, desc, css, body):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="t d">
<title id="t">{title}</title>
<desc id="d">{desc}</desc>
<style>{BASE_CSS}{css}</style>
<rect class="bg" width="{w}" height="{h}"/>
{body}
</svg>
"""


def header(w, left, right, title):
    return f"""<text class="mono cap sec" x="40" y="40">{left}</text>
<text class="mono cap sec end" x="{w-40}" y="40">{right}</text>
<line class="ln" x1="40" y1="52" x2="{w-40}" y2="52"/>
<text class="h1 ink" x="40" y="96">{title}</text>"""


def footer(w, h, text):
    return f"""<line class="ln" x1="40" y1="{h-40}" x2="{w-40}" y2="{h-40}"/>
<text class="mono sec" x="40" y="{h-16}">{text}</text>"""


def pct(x):
    return f"{x:.2f}%"


def bust(cx, base, s=1.0, filled=False):
    """Head and shoulders, drawn as a line or filled with scales."""
    r = 16 * s
    d = (f"M{cx-44*s},{base} C{cx-42*s},{base-26*s} {cx-24*s},{base-34*s} {cx},{base-34*s} "
         f"C{cx+24*s},{base-34*s} {cx+42*s},{base-26*s} {cx+44*s},{base} Z")
    if not filled:
        return f'<circle class="lnk" cx="{cx}" cy="{base-58*s}" r="{r}"/><path class="lnk" d="{d}"/>'
    return (f'<circle class="ink" cx="{cx}" cy="{base-58*s}" r="{r}"/><path class="ink" d="{d}"/>'
            f'<circle cx="{cx}" cy="{base-58*s}" r="{r}" fill="url(#scales)"/><path fill="url(#scales)" d="{d}"/>')


SCALES = """<pattern id="scales" width="9" height="8" patternUnits="userSpaceOnUse">
 <path d="M0,8 A4.5,4.5 0 0 1 9,8" fill="none" stroke="var(--bg)" stroke-width="1"/></pattern>"""


# ------------------------------------------------------------------ 01 pipeline
def pipeline():
    w, h = 960, 500
    css = """
.fu{animation:fu 3.6s linear infinite}
@keyframes fu{0%{transform:translateX(0);opacity:0}8%{opacity:1}88%{opacity:1}100%{transform:translateX(300px);opacity:0}}
.fd{animation:fd 3.6s linear infinite}
@keyframes fd{0%{transform:translateX(0);opacity:0}8%{opacity:1}88%{opacity:1}100%{transform:translateX(-300px);opacity:0}}
.human{animation:human 9s ease-in-out infinite}
@keyframes human{0%,38%{opacity:1}50%,88%{opacity:0}100%{opacity:1}}
.beast{animation:beast 9s ease-in-out infinite}
@keyframes beast{0%,38%{opacity:0}50%,88%{opacity:1}100%{opacity:0}}
.cell{animation:cell 2.4s steps(1) infinite}
@keyframes cell{0%{fill:var(--bg)}50%{fill:var(--ink)}}
.inp{animation:inp 9s ease-in-out infinite}
@keyframes inp{0%{transform:translateY(0);opacity:0}6%{opacity:1}22%{transform:translateY(64px);opacity:1}26%,100%{transform:translateY(64px);opacity:0}}
"""
    body = header(w, "Decart · Lucy", "Realtime", "Camera in, transformed video out")
    g = 440
    # a person facing a screen on a stand, side view
    body += f"""
<line class="gr" x1="40" y1="{g}" x2="300" y2="{g}"/>
<rect class="gr" x="196" y="{g-216}" width="10" height="92"/>
<line class="lnk" x1="204" y1="{g-212}" x2="204" y2="{g-128}" style="stroke-width:2"/>
<circle class="ink" cx="196" cy="{g-206}" r="2.5"/>
<line class="gr" x1="201" y1="{g-124}" x2="201" y2="{g}"/>
<line class="gr" x1="176" y1="{g}" x2="226" y2="{g}"/>
<circle class="gr" cx="110" cy="{g-232}" r="12"/>
<path class="gr" d="M108,{g-219} L104,{g-120} M104,{g-120} L94,{g} M104,{g-120} L116,{g}"/>
<path class="gr" d="M107,{g-205} L134,{g-160}"/>
<line class="gr dash" x1="122" y1="{g-232}" x2="194" y2="{g-206}"/>
<text class="mono-s sec" x="40" y="{g+22}">you · a camera · a screen</text>
"""
    ix, iy, iw, ih = 330, 132, 230, 132
    cx, base = ix + iw / 2, iy + ih + 2
    body += f"""
<defs>{SCALES}<clipPath id="screen"><rect x="{ix+1}" y="{iy+1}" width="{iw-2}" height="{ih-2}"/></clipPath></defs>
<rect class="lnk" x="{ix}" y="{iy}" width="{iw}" height="{ih}"/>
<text class="mono-s sec" x="{ix}" y="{iy-10}">what you see</text>
<line class="gr dash" x1="206" y1="{g-216}" x2="{ix}" y2="{iy+ih}"/>
<g clip-path="url(#screen)">
 <g class="human">{bust(cx, base, 1.15)}<text class="mono-s sec" x="{ix+10}" y="{iy+20}">you</text></g>
 <g class="beast">{bust(cx, base, 1.15, filled=True)}<text class="mono-s sec" x="{ix+10}" y="{iy+20}">anything you prompt</text></g>
</g>
"""
    x1, x2, yu, yd = 330, 630, 330, 396
    body += f"""
<path class="gr" d="M206,{g-170} L290,{g-170} L290,{yu} L{x1},{yu}"/>
<path class="gr" d="M{x1},{yd} L270,{yd} L270,{g-150} L206,{g-150}"/>
<line class="ln" x1="{x1}" y1="{yu}" x2="{x2}" y2="{yu}"/>
<line class="ln" x1="{x1}" y1="{yd}" x2="{x2}" y2="{yd}"/>
<text class="mono-s sec" x="{x1}" y="{yu-22}">camera · 1280×720 · 30 fps</text>
<text class="mono-s sec" x="{x1}" y="{yd+34}">transformed stream, frame by frame</text>
<text class="mono-s sec end" x="{x2}" y="{yu-22}">WebRTC →</text>
<text class="mono-s sec end" x="{x2}" y="{yd+34}">← WebRTC</text>
"""
    for k in range(6):
        d = -k * 0.6
        body += f"""
<g class="fu" style="animation-delay:{d}s"><rect class="bg" x="{x1-14}" y="{yu-10}" width="28" height="20" style="stroke:var(--ink)"/>
 <circle class="lnk" cx="{x1}" cy="{yu-2}" r="3"/><path class="lnk" d="M{x1-7},{yu+10} C{x1-6},{yu+4} {x1+6},{yu+4} {x1+7},{yu+10}"/></g>
<g class="fd" style="animation-delay:{d-0.3}s"><rect class="ink" x="{x2-14}" y="{yd-10}" width="28" height="20"/>
 <rect x="{x2-14}" y="{yd-10}" width="28" height="20" fill="url(#scales)"/></g>"""
    mx, my, mw, mh = 660, 250, 260, 190
    body += f"""
<rect class="lnk" x="{mx}" y="{my}" width="{mw}" height="{mh}"/>
<line class="gr" x1="{x2}" y1="{yu}" x2="{mx}" y2="{yu}"/>
<line class="gr" x1="{x2}" y1="{yd}" x2="{mx}" y2="{yd}"/>
<text class="mono-s cap sec" x="{mx+16}" y="{my+24}">Decart model</text>
<text class="h1 ink" x="{mx+16}" y="{my+54}">Lucy 2.6</text>
<text class="mono-s txt" x="{mx+16}" y="{my+78}">realtime video editing</text>
<text class="mono-s txt" x="{mx+16}" y="{my+94}">every frame, as it arrives</text>
"""
    gx, gy = mx + 16, my + 116
    for r in range(3):
        for c in range(10):
            delay = -((r * 10 + c) * 0.08)
            body += (f'<rect class="cell bg" x="{gx+c*22}" y="{gy+r*20}" width="14" height="12" '
                     f'style="stroke:var(--line);animation-delay:{delay:.2f}s"/>')
    body += f"""
<text class="mono-s cap sec" x="{mx}" y="{my-92}">Your app</text>
<line class="ln" x1="{mx}" y1="{my-84}" x2="{mx+mw}" y2="{my-84}"/>
<text class="mono-s txt" x="{mx+16}" y="{my-62}">prompt</text>
<text class="mono-s txt" x="{mx+144}" y="{my-62}">reference image</text>
<line class="gr" x1="{mx+60}" y1="{my-52}" x2="{mx+60}" y2="{my}"/>
<line class="gr" x1="{mx+190}" y1="{my-52}" x2="{mx+190}" y2="{my}"/>
<circle class="inp ink" cx="{mx+60}" cy="{my-56}" r="3"/>
<circle class="inp ink" cx="{mx+190}" cy="{my-56}" r="3" style="animation-delay:-.4s"/>
"""
    body += footer(w, h, "Change the prompt or the image mid-session. No reconnect, the next frames follow.")
    return svg(w, h, "Realtime video with Decart",
               "Animated diagram. A camera sends frames over WebRTC to Decart's Lucy model, which also receives "
               "a prompt and an optional reference image, and streams every frame back transformed.", css, body)


# -------------------------------------------------------------------- 02 tokens
def tokens():
    w, h = 960, 480
    lanes = [("Browser", "your page", 150), ("Your server", "/api/realtime-token", 480), ("Decart", "platform + realtime", 810)]
    cycle = 12
    B, S, D = 150, 480, 810
    steps = [
        # (y, x_from, x_to, label, note, window start %, end %)
        (206, B, S, "01 · POST { model }", "when the user clicks Start", 0, 18),
        (250, S, D, "02 · tokens.create()", "60 s · one model · this origin · session cap", 22, 40),
        (294, D, B, "03 · short-lived apiKey", "the permanent key never leaves your server", 44, 62),
        (346, B, D, "04 · realtime.connect(camera, { model })", "WebRTC session opened with the token", 66, 92),
    ]
    css = ""
    body = header(w, "Client tokens", "Security", "Your API key never reaches the browser")
    for name, sub, x in lanes:
        body += f"""
<line class="ln" x1="{x-110}" y1="128" x2="{x+110}" y2="128"/>
<text class="mono-s cap sec mid" x="{x}" y="148">{name}</text>
<text class="mono-s txt mid" x="{x}" y="164">{sub}</text>
<line class="gr dash" x1="{x}" y1="176" x2="{x}" y2="372"/>"""
    # the key that stays home
    kx, ky = S - 60, 396
    body += f"""
<circle class="lnk" cx="{kx+8}" cy="{ky}" r="7"/>
<line class="lnk" x1="{kx+15}" y1="{ky}" x2="{kx+40}" y2="{ky}"/>
<line class="lnk" x1="{kx+32}" y1="{ky}" x2="{kx+32}" y2="{ky+7}"/>
<line class="lnk" x1="{kx+38}" y1="{ky}" x2="{kx+38}" y2="{ky+5}"/>
<text class="mono-s txt" x="{kx+52}" y="{ky+4}">DECART_API_KEY stays here</text>
"""
    for i, (y, xa, xb, label, note, a, b) in enumerate(steps):
        left = min(xa, xb)
        right = max(xa, xb)
        arrow = 6 if xb > xa else -6
        css += f"""
.st{i}{{animation:st{i} {cycle}s linear infinite}}
@keyframes st{i}{{0%,{pct(max(a-1,0))}{{opacity:.3}}{pct(a+1)},{pct(b+4)}{{opacity:1}}{pct(b+8)},100%{{opacity:.3}}}}
.dt{i}{{offset-path:path('M{xa},{y} L{xb},{y}');offset-rotate:0deg;animation:dt{i} {cycle}s linear infinite}}
@keyframes dt{i}{{0%,{pct(a)}{{offset-distance:0%;opacity:0}}{pct(a+0.5)}{{opacity:1}}{pct(b)}{{offset-distance:100%;opacity:1}}{pct(b+0.5)},100%{{offset-distance:100%;opacity:0}}}}"""
        style = "stroke:var(--ink);stroke-width:1.5" if i == 3 else ""
        mid = (left + right) / 2 if i != 2 else (B + S) / 2
        body += f"""
<g class="st{i}">
 <line class="gr" x1="{xa}" y1="{y}" x2="{xb}" y2="{y}" style="{style}"/>
 <path class="lnk" d="M{xb-arrow},{y-4} L{xb},{y} L{xb-arrow},{y+4}" style="{style}"/>
 <text class="mono-s ink mid" x="{mid}" y="{y-8}">{label}</text>
 <text class="mono-s sec mid" x="{mid}" y="{y+16}">{note}</text>
</g>
<circle class="dt{i} ink" r="3.5" cx="0" cy="0"/>"""
    body += footer(w, h, "apiKeyProvider asks for a fresh token before every connect and reconnect.")
    return svg(w, h, "Client token flow",
               "Animated sequence. The browser asks your server for a token, the server mints a short-lived token "
               "with Decart using the permanent key, returns it, and the browser opens the realtime session with it.",
               css, body)


# ------------------------------------------------------------------- 03 session
def session():
    w, h = 960, 360
    cells = [
        ("preflight", "Network check", "free, no session", 120),
        ("token", "Fresh token", "60 s life", 100),
        ("camera", "Model's size", "1280×720 · 30 fps", 140),
        ("connect", "First state", "prompt + image", 120),
        ("generating", "Billed seconds", "$0.02/s on Lucy 2.6", 240),
        ("stop", "Disconnect", "cap or Stop", 120),
    ]
    total = sum(c[3] for c in cells)
    x0, y0, ch = 60, 128, 92
    cycle, travel = 20, 95.0
    css = f"""
.ph{{animation:ph {cycle}s linear infinite}}
@keyframes ph{{0%{{transform:translateX(0)}}{travel}%,100%{{transform:translateX({total}px)}}}}
"""
    body = header(w, "One session", "Lifecycle", "From click to bill, in the order the starter runs it")
    x = x0
    gen_x = None
    for i, (state, es, note, cw) in enumerate(cells):
        a = travel * (x - x0) / total
        b = travel * (x - x0 + cw) / total
        css += f"""
.a{i}{{animation:a{i} {cycle}s linear infinite}}
@keyframes a{i}{{0%,{pct(max(a-0.01,0))}{{opacity:0}}{pct(a+0.01)},{pct(b)}{{opacity:1}}{pct(b+0.01)},100%{{opacity:0}}}}
.t{i}{{animation:t{i} {cycle}s linear infinite}}
@keyframes t{i}{{0%,{pct(max(a-0.01,0))}{{opacity:.4}}{pct(a+0.01)},{pct(b)}{{opacity:1}}{pct(b+0.01)},100%{{opacity:.4}}}}"""
        body += f"""
<rect class="ln" x="{x}" y="{y0}" width="{cw}" height="{ch}"/>
<line class="a{i}" x1="{x}" y1="{y0}" x2="{x+cw}" y2="{y0}" style="stroke:var(--ink);stroke-width:3"/>
<g class="t{i}">
 <text class="mono-s sec" x="{x+10}" y="{y0+22}">{state}</text>
 <text class="h3 ink" x="{x+10}" y="{y0+50}">{es}</text>
</g>
<text class="mono-s sec" x="{x+10}" y="{y0+ch+22}">{note}</text>"""
        if state == "generating":
            gen_x, gen_w, ga, gb = x, cw, a, b
        x += cw
    # cost bar inside the generating cell
    css += f"""
.bar{{transform-box:fill-box;transform-origin:left;animation:bar {cycle}s linear infinite}}
@keyframes bar{{0%,{pct(ga)}{{transform:scaleX(0)}}{pct(gb)},100%{{transform:scaleX(1)}}}}"""
    body += f"""
<rect class="ln" x="{gen_x+10}" y="{y0+66}" width="{gen_w-20}" height="8"/>
<rect class="ink bar" x="{gen_x+10}" y="{y0+66}" width="{gen_w-20}" height="8"/>
<text class="mono-s sec" x="{gen_x+10}" y="{y0+ch+40}">60 s ≈ $1.20 · fast mode ×2</text>"""
    body += f'<line class="ph" x1="{x0}" y1="{y0-10}" x2="{x0}" y2="{y0+ch+6}" style="stroke:var(--ink);stroke-width:1.5"/>'
    body += f'<circle class="ph ink" cx="{x0}" cy="{y0-10}" r="3.5"/>'
    body += footer(w, h, "Only generating seconds are billed. The starter stops on a cap, a hidden tab or a closed page.")
    return svg(w, h, "Session lifecycle",
               "Animated timeline of one session. Preflight, fresh token, camera at the model's size, connect with "
               "the first state, billed generation with a cost bar, and disconnect.", css, body)


# ------------------------------------------------------------------ 04 obsidian
def obsidian():
    w, h = 960, 380
    stations = [
        ("01", "Xochimilco", "the legend of", "La Llorona"),
        ("02", "Concept", "three animals", "three black fountains"),
        ("03", "Pedestals", "400×1000 mm", "moss and flowers"),
        ("04", "Code", "React + Lucy 2.1", "WebRTC + Netlify"),
        ("05", "Base Milano", "April 21–26, 2026", "rewritten nightly"),
        ("06", "Grazie Milano", "2,600 generations", "in six days"),
    ]
    x0, step, y = 40, 146, 210
    travel = 80.0
    span = step * (len(stations) - 1)
    css = f"""
.prog{{stroke:var(--ink);stroke-width:1;fill:none;stroke-dasharray:{span};stroke-dashoffset:{span};animation:prog 18s linear infinite}}
@keyframes prog{{0%{{stroke-dashoffset:{span}}}{travel}%,94%{{stroke-dashoffset:0;opacity:1}}100%{{stroke-dashoffset:0;opacity:0}}}}
.dot{{animation:dot 18s linear infinite}}
@keyframes dot{{0%{{transform:translateX(0);opacity:1}}{travel}%,94%{{transform:translateX({span}px);opacity:1}}100%{{transform:translateX({span}px);opacity:0}}}}
"""
    body = header(w, "INST-01 | Obsidian Reflections", "Case study", "From a legend to a live mirror")
    body += f'\n<line class="ln" x1="{x0}" y1="{y}" x2="{w-40}" y2="{y}"/>'
    body += f'\n<line class="prog" x1="{x0}" y1="{y}" x2="{x0+span}" y2="{y}"/>'
    for i, (idx, name, n1, n2) in enumerate(stations):
        x = x0 + i * step
        t = travel * i / (len(stations) - 1)
        a, b = max(t - 0.3, 0), t + 1.2
        css += f"""
.s{i}{{animation:s{i} 18s linear infinite}}
@keyframes s{i}{{0%,{pct(a)}{{opacity:.28}}{pct(b)},94%{{opacity:1}}100%{{opacity:.28}}}}
.c{i}{{animation:c{i} 18s linear infinite}}
@keyframes c{i}{{0%,{pct(a)}{{fill:var(--bg)}}{pct(b)},94%{{fill:var(--ink)}}100%{{fill:var(--bg)}}}}"""
        body += f"""
<g class="s{i}">
 <text class="mono sec" x="{x}" y="{y-22}">{idx}</text>
 <text class="h2 ink" x="{x}" y="{y+40}">{name}</text>
 <text class="mono txt" x="{x}" y="{y+64}">{n1}</text>
 <text class="mono txt" x="{x}" y="{y+82}">{n2}</text>
</g>
<circle class="c{i}" cx="{x}" cy="{y}" r="4.5" style="stroke:var(--ink)"/>"""
    body += f'\n<circle class="dot ink" cx="{x0}" cy="{y}" r="6"/>'
    body += footer(w, h, "Milan Design Week 2026 · We Will Design · Base Milano · Divina Machina × Decart")
    return svg(w, h, "Obsidian Reflections case study",
               "Animated timeline in six stations, from the legend of La Llorona in Xochimilco to 2,600 generations "
               "at Base Milano.", css, body)


if __name__ == "__main__":
    for name, fn in [("01-pipeline", pipeline), ("02-tokens", tokens), ("03-session", session), ("04-obsidian", obsidian)]:
        (OUT / f"{name}.svg").write_text(fn(), encoding="utf-8")
        print("ok", name)
