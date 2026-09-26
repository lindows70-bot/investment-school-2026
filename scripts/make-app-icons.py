# 로고 SVG(public/logo-icon.svg)를 폰 앱 설치용 PNG 아이콘(192·512·maskable 512·apple-touch 180)으로 굽는 스크립트
#
# 실행: python scripts/make-app-icons.py   (PyMuPDF 필요 — `import fitz`)
# 결과: public/icons/icon-192.png · icon-512.png · icon-maskable-512.png · apple-touch-icon.png
#
# 왜 셋이 다른가
#  · icon-192/512 — 로고 그대로(둥근 모서리 바깥은 투명). 안드로이드 설치 목록·스플래시용.
#  · maskable 512 — 안드로이드 런처가 원·물방울 등으로 **잘라낸다**. 안전 영역은 가운데 지름 80% 원이라
#    로고를 70%로 줄여(안전 영역 80% 안에 여유를 두고) 가운데 두고, 바깥은 로고 배경색으로 꽉 채운다(투명이면 잘린 가장자리가 검게 뜬다).
#  · apple-touch 180 — iOS 는 투명 부분을 검정으로 칠하고 자기 모서리를 따로 씌운다 → 배경색으로 꽉 채운다.
# 배경색은 하드코딩하지 않고 로고 SVG 의 배경 사각형 fill 에서 읽는다(로고를 바꾸면 따라온다).
import os
import re
import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'logo-icon.svg')
OUT = os.path.join(ROOT, 'public', 'icons')

svg_text = open(SRC, encoding='utf-8').read()
m = re.search(r'<rect[^>]*fill="#([0-9A-Fa-f]{6})"', svg_text)
if not m:
    raise SystemExit('로고 배경 사각형 fill 을 찾지 못했습니다')
BG = tuple(int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4))

# ⚠️ MuPDF 는 rgba() 색을 모른다 — 그대로 열면 반투명 흰 선이 전부 **검정**으로 그려졌다(실측).
#    fill/stroke="rgba(r,g,b,a)" 를 "#rrggbb" + *-opacity="a" 로 풀어서 연다(원본 SVG 는 그대로 둔다).
def _rgba(mt: 're.Match') -> str:
    attr, r, g, b, a = mt.group(1), *(int(float(x)) for x in mt.group(2, 3, 4)), mt.group(5)
    return f'{attr}="#{r:02x}{g:02x}{b:02x}" {attr}-opacity="{a}"'


svg_fixed = re.sub(r'(fill|stroke)="rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)"', _rgba, svg_text)
logo = fitz.open(stream=svg_fixed.encode('utf-8'), filetype='svg')   # MuPDF 는 SVG 를 한 쪽짜리 문서로 연다
logo_pdf = fitz.open('pdf', logo.convert_to_pdf())
W = logo[0].rect.width                      # 38pt 정사각형


def plain(size: int, name: str) -> None:
    """로고 그대로(투명 모서리 유지)"""
    pix = logo[0].get_pixmap(matrix=fitz.Matrix(size / W, size / W), alpha=True)
    save(pix, size, name)


def filled(size: int, scale: float, name: str) -> None:
    """배경색으로 꽉 채운 정사각형 위에 로고를 scale 배로 가운데 배치"""
    doc = fitz.open()
    page = doc.new_page(width=size, height=size)
    page.draw_rect(page.rect, color=None, fill=BG, width=0)
    inset = size * (1 - scale) / 2
    page.show_pdf_page(fitz.Rect(inset, inset, size - inset, size - inset), logo_pdf, 0)
    pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
    save(pix, size, name)


def save(pix: 'fitz.Pixmap', size: int, name: str) -> None:
    if (pix.width, pix.height) != (size, size):
        raise SystemExit(f'{name}: 크기 {pix.width}x{pix.height} ≠ {size}x{size}')
    pix.save(os.path.join(OUT, name))
    print(f'{name}: {pix.width}x{pix.height}')


os.makedirs(OUT, exist_ok=True)
plain(192, 'icon-192.png')
plain(512, 'icon-512.png')
filled(512, 0.7, 'icon-maskable-512.png')
filled(180, 1.0, 'apple-touch-icon.png')
