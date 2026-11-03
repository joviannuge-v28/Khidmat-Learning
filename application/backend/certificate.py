import io
import copy
from datetime import datetime

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

DEFAULT_LAYOUT = {
    "template_path": "",
    "font_family": "Helvetica",
    "custom_texts": [],
    "text_color": "#0F172A",
    "accent_color": "#0F2942",
    "logos": [],
    "elements": {
        "header": {"x": 50, "y": 18, "size": 14, "show": True, "bold": True, "text": "PEMERINTAH KOTA DUMAI"},
        "subheader": {"x": 50, "y": 22, "size": 11, "show": True, "bold": False, "text": ""},
        "title": {"x": 50, "y": 30, "size": 38, "show": True, "bold": True, "text": "SERTIFIKAT"},
        "number": {"x": 50, "y": 36, "size": 11, "show": True, "bold": False},
        "given": {"x": 50, "y": 42, "size": 13, "show": True, "bold": False, "text": "Diberikan kepada"},
        "name": {"x": 50, "y": 49, "size": 28, "show": True, "bold": True},
        "nip": {"x": 50, "y": 54, "size": 12, "show": True, "bold": False},
        "activity": {"x": 50, "y": 60, "size": 13, "show": True, "bold": False},
        "course": {"x": 50, "y": 65, "size": 18, "show": True, "bold": True},
        "result": {"x": 50, "y": 70, "size": 12, "show": True, "bold": False},
        "signer": {"x": 77, "y": 76, "size": 11, "show": True, "bold": False},
        "qr": {"x": 12, "y": 84, "size": 70, "show": True},
    },
}


def merge_layout(saved: dict) -> dict:
    out = copy.deepcopy(DEFAULT_LAYOUT)
    saved = saved or {}
    for k in ("template_path", "text_color", "accent_color", "logos", "font_family", "custom_texts"):
        if k in saved:
            out[k] = saved[k]
    for k, v in (saved.get("elements") or {}).items():
        if k in out["elements"] and isinstance(v, dict):
            out["elements"][k].update(v)
    return out


FONTS = {"Helvetica": ("Helvetica", "Helvetica-Bold"), "Times": ("Times-Roman", "Times-Bold"), "Courier": ("Courier", "Courier-Bold"),
         "Helvetica Miring": ("Helvetica-Oblique", "Helvetica-BoldOblique"), "Times Miring": ("Times-Italic", "Times-BoldItalic")}


def font_of(name, bold=False) -> str:
    pair = FONTS.get(name or "Helvetica", FONTS["Helvetica"])
    return pair[1] if bold else pair[0]


def tanggal_id(iso: str) -> str:
    d = datetime.fromisoformat(iso)
    return f"{d.day} {BULAN[d.month - 1]} {d.year}"


def format_cert_no(fmt: str, n: int, when: datetime) -> str:
    return fmt.replace("{NO}", f"{n:03d}").replace("{TAHUN}", str(when.year)).replace("{BULAN}", ROMAWI[when.month - 1])


def _qr(c, url, x, y, size=80):
    widget = qr.QrCodeWidget(url)
    b = widget.getBounds()
    d = Drawing(size, size, transform=[size / (b[2] - b[0]), 0, 0, size / (b[3] - b[1]), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def _image(c, data, x, y, w, h):
    if not data:
        return False
    try:
        c.drawImage(ImageReader(io.BytesIO(data)), x, y, w, h, preserveAspectRatio=True, mask="auto")
        return True
    except Exception:
        return False


def _color(v, fallback):
    try:
        return HexColor(v or fallback)
    except Exception:
        return HexColor(fallback)


def element_texts(*, app_name, name, nip, course_title, score, completed_at, cert_no, activity_kind, layout):
    el = layout["elements"]
    result = f"pada tanggal {tanggal_id(completed_at)}" if activity_kind == "zoom" or score is None \
        else f"dengan nilai akhir {score} pada tanggal {tanggal_id(completed_at)}"
    return {
        "header": el["header"].get("text") or "PEMERINTAH KOTA DUMAI",
        "subheader": el["subheader"].get("text") or app_name,
        "title": el["title"].get("text") or "SERTIFIKAT",
        "number": f"Nomor: {cert_no}",
        "given": el["given"].get("text") or "Diberikan kepada",
        "name": name,
        "nip": f"NIP. {nip or '-'}",
        "activity": "Telah mengikuti Webinar Zoom" if activity_kind == "zoom" else "Telah menyelesaikan pelatihan",
        "course": course_title[:90],
        "result": result,
    }


def build_layout_certificate(*, layout, app_name, name, nip, course_title, score, completed_at, cert_no, verify_url,
                             signer_name, signer_title, signer_pangkat="", signer_nip="", template_bytes=None, signature_bytes=None, logo_images=None,
                             activity_kind="course") -> bytes:
    page = landscape(A4)
    if template_bytes:
        try:
            iw, ih = ImageReader(io.BytesIO(template_bytes)).getSize()
            page = landscape(A4) if iw >= ih else A4
        except Exception:
            template_bytes = None
    w, h = page
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=page)
    c.setTitle(f"Sertifikat {cert_no}")
    accent = _color(layout.get("accent_color"), "#0F2942")
    text = _color(layout.get("text_color"), "#0F172A")

    if template_bytes:
        c.drawImage(ImageReader(io.BytesIO(template_bytes)), 0, 0, w, h, mask="auto")
    else:
        c.setFillColor(HexColor("#FFFDF7"))
        c.rect(0, 0, w, h, fill=1, stroke=0)
        c.setStrokeColor(accent)
        c.setLineWidth(6)
        c.rect(20, 20, w - 40, h - 40)
        c.setStrokeColor(HexColor("#D97706"))
        c.setLineWidth(1.5)
        c.rect(32, 32, w - 64, h - 64)

    for lg, data in zip(layout.get("logos") or [], logo_images or []):
        lw = w * float(lg.get("w", 8)) / 100
        cx, cy = w * float(lg.get("x", 50)) / 100, h * (1 - float(lg.get("y", 10)) / 100)
        _image(c, data, cx - lw / 2, cy - lw / 2, lw, lw)

    el = layout["elements"]
    texts = element_texts(app_name=app_name, name=name, nip=nip, course_title=course_title, score=score,
                          completed_at=completed_at, cert_no=cert_no, activity_kind=activity_kind, layout=layout)
    base_font = layout.get("font_family") or "Helvetica"
    for key, val in texts.items():
        e = el[key]
        if not e.get("show", True):
            continue
        size = float(e.get("size", 12))
        c.setFillColor(accent if key in ("title", "header") and not template_bytes else text)
        c.setFont(font_of(e.get("font") or base_font, e.get("bold")), size)
        c.drawCentredString(w * float(e["x"]) / 100, h * (1 - float(e["y"]) / 100) - size * 0.35, val)

    for t in layout.get("custom_texts") or []:
        if not t.get("show", True) or not str(t.get("text", "")).strip():
            continue
        size = float(t.get("size", 12))
        c.setFillColor(_color(t.get("color"), layout.get("text_color") or "#0F172A"))
        c.setFont(font_of(t.get("font") or base_font, t.get("bold")), size)
        c.drawCentredString(w * float(t.get("x", 50)) / 100, h * (1 - float(t.get("y", 50)) / 100) - size * 0.35, str(t["text"])[:200])

    s = el["signer"]
    if s.get("show", True):
        k = float(s.get("size", 11)) / 11
        sf = s.get("font") or base_font
        sx, sy = w * float(s["x"]) / 100, h * (1 - float(s["y"]) / 100)
        c.setFillColor(text)
        c.setFont(font_of(sf), 11 * k)
        c.drawCentredString(sx, sy, f"Dumai, {tanggal_id(completed_at)}")
        c.drawCentredString(sx, sy - 15 * k, signer_title)
        _image(c, signature_bytes, sx - 60 * k, sy - 66 * k, 120 * k, 42 * k)
        c.setStrokeColor(HexColor("#475569"))
        c.setLineWidth(0.8)
        c.line(sx - 100 * k, sy - 70 * k, sx + 100 * k, sy - 70 * k)
        c.setFont(font_of(sf, True), 11 * k)
        c.drawCentredString(sx, sy - 84 * k, signer_name)
        c.setFont(font_of(sf), 10 * k)
        if signer_pangkat:
            c.drawCentredString(sx, sy - 97 * k, signer_pangkat)
        if signer_nip:
            c.drawCentredString(sx, sy - (110 if signer_pangkat else 97) * k, f"NIP. {signer_nip}")

    q = el["qr"]
    if q.get("show", True):
        size = float(q.get("size", 70))
        qx, qy = w * float(q["x"]) / 100, h * (1 - float(q["y"]) / 100)
        _qr(c, verify_url, qx - size / 2, qy - size / 2, size)

    c.showPage()
    c.save()
    return buf.getvalue()
