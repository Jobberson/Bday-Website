#!/usr/bin/env python3
"""
Offline helpers for the birthday garden (not used by the website itself).

  python tools/garden_tools.py check
      Checks every asset path in config.js against the real files with EXACT
      casing (GitHub Pages is case-sensitive; Windows is not). Run before deploying.

  python tools/garden_tools.py brushes <scans_folder> [--out assets/brushes] [--size 512] [--soften 1.2]
      Turns photos/scans of paint on white paper into white-on-transparent brush PNGs.

  python tools/garden_tools.py layers <png_folder> [--out assets/layers] [--quality 80]
      Converts exported PNG layers to WebP (with alpha) and reports file sizes.

`brushes` and `layers` need Pillow:  python -m pip install pillow
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_EXT = ("png", "webp", "jpg", "jpeg", "gif", "svg", "avif", "mp3", "m4a", "ogg", "wav", "aac")


# ---------------------------------------------------------------------------- check
def strip_js_comments(src):
    """Remove // and /* */ comments while leaving string contents (e.g. URLs) intact."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in "'\"`":
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1])
            i = j + 1
        elif src.startswith("//", i):
            while i < n and src[i] != "\n":
                i += 1
        elif src.startswith("/*", i):
            end = src.find("*/", i + 2)
            i = n if end < 0 else end + 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def show(path):
    """Project-relative path with forward slashes, or the absolute path if outside the project."""
    rel = os.path.relpath(os.path.abspath(path), ROOT)
    return os.path.abspath(path) if rel.startswith("..") else rel.replace("\\", "/")


def exact_case_status(rel):
    """Returns (ok, message). Walks each path segment comparing directory entries exactly."""
    cur = ROOT
    parts = [p for p in rel.replace("\\", "/").split("/") if p not in ("", ".")]
    for k, part in enumerate(parts):
        try:
            entries = os.listdir(cur)
        except OSError:
            return False, "folder missing: " + "/".join(parts[:k])
        if part in entries:
            cur = os.path.join(cur, part)
            continue
        near = [e for e in entries if e.lower() == part.lower()]
        if near:
            return False, "CASE MISMATCH: config says '%s' but the file is '%s'" % (part, near[0])
        return False, "missing: '%s' not found in %s/" % (part, "/".join(parts[:k]) or ".")
    return True, "ok"


def cmd_check(_args):
    cfg_path = os.path.join(ROOT, "config.js")
    with open(cfg_path, encoding="utf-8") as f:
        src = strip_js_comments(f.read())
    pat = re.compile(r"""(['"])([^'"\n]+?\.(?:%s))\1""" % "|".join(ASSET_EXT), re.IGNORECASE)
    paths = []
    for m in pat.finditer(src):
        p = m.group(2)
        if p.startswith(("http://", "https://", "data:", "placeholder:")) or p in paths:
            continue
        paths.append(p)
    if not paths:
        print("No asset files referenced in config.js (everything is placeholder). Nothing to check.")
        return 0
    bad = 0
    for p in paths:
        ok, msg = exact_case_status(p)
        print(("  ok   " if ok else "  FAIL ") + p + ("" if ok else "  -> " + msg))
        bad += not ok
    print("\n%d file(s) checked, %d problem(s)." % (len(paths), bad))
    return 1 if bad else 0


# ---------------------------------------------------------------------------- brushes
def need_pillow():
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        sys.exit("This command needs Pillow:  python -m pip install pillow")


def cmd_brushes(args):
    need_pillow()
    from PIL import Image, ImageDraw, ImageFilter, ImageOps

    os.makedirs(args.out, exist_ok=True)
    files = sorted(f for f in os.listdir(args.src) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")))
    if not files:
        sys.exit("No images found in " + args.src)
    for name in files:
        img = Image.open(os.path.join(args.src, name))
        img = ImageOps.exif_transpose(img).convert("L")
        # Estimate paper white and darkest pigment from the histogram.
        hist = img.histogram()
        total = sum(hist)

        def percentile(q):
            acc = 0
            for v, c in enumerate(hist):
                acc += c
                if acc >= total * q:
                    return v
            return 255

        white, dark = percentile(0.90), percentile(0.01)
        span = max(1, white - dark)
        floor = args.floor
        # Luminance -> alpha: paper becomes transparent, pigment opaque.
        lut = []
        for v in range(256):
            a = (white - v) / span
            a = 0.0 if a <= floor else min(1.0, (a - floor) / (1 - floor))
            lut.append(int(round(a * 255)))
        alpha = img.point(lut)
        alpha = alpha.filter(ImageFilter.MedianFilter(3))  # remove specks / paper noise
        box = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
        if not box:
            print("  skip %s (no paint found)" % name)
            continue
        alpha = alpha.crop(box)
        # Pad to a square with a margin, then resize.
        w, h = alpha.size
        side = int(max(w, h) * 1.28)  # room so the feathered border never clips the paint
        sq = Image.new("L", (side, side), 0)
        sq.paste(alpha, ((side - w) // 2, (side - h) // 2))
        sq = sq.resize((args.size, args.size), Image.LANCZOS)
        if args.soften > 0:
            sq = sq.filter(ImageFilter.GaussianBlur(args.soften))
        # Feather the border so no stamp ever shows a hard square edge.
        edge = Image.new("L", (args.size, args.size), 0)
        m = int(args.size * 0.06)
        ImageDraw.Draw(edge).rectangle([m, m, args.size - m, args.size - m], fill=255)
        edge = edge.filter(ImageFilter.GaussianBlur(m / 2))
        from PIL import ImageChops
        sq = ImageChops.multiply(sq, edge)
        out = Image.new("RGBA", (args.size, args.size), (255, 255, 255, 0))
        out.putalpha(sq)
        base = os.path.splitext(name)[0].lower().replace(" ", "-")
        dest = os.path.join(args.out, base + ".png")
        out.save(dest, optimize=True)
        print("  %s -> %s" % (name, show(dest)))
    print("\nAdd the paths to `brushes: [...]` in config.js.")
    return 0


# ---------------------------------------------------------------------------- layers
def cmd_layers(args):
    need_pillow()
    from PIL import Image

    os.makedirs(args.out, exist_ok=True)
    files = sorted(f for f in os.listdir(args.src) if f.lower().endswith(".png"))
    if not files:
        sys.exit("No PNG files found in " + args.src)
    for name in files:
        img = Image.open(os.path.join(args.src, name)).convert("RGBA")
        note = "" if img.size == (2048, 2048) else "  (warning: %dx%d, expected 2048x2048)" % img.size
        base = os.path.splitext(name)[0].lower().replace(" ", "-")
        dest = os.path.join(args.out, base + ".webp")
        img.save(dest, "WEBP", quality=args.quality, method=6, alpha_quality=90)
        kb = os.path.getsize(dest) / 1024
        warn = "  <- large, try --quality 70" if kb > 500 else ""
        print("  %-28s %6.0f KB%s%s" % (show(dest), kb, warn, note))
    print("\nFile names were lower-cased. Use these exact paths in config.js, then run `check`.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="verify asset paths in config.js (exact casing)")
    b = sub.add_parser("brushes", help="paint scans -> brush PNGs")
    b.add_argument("src")
    b.add_argument("--out", default=os.path.join(ROOT, "assets", "brushes"))
    b.add_argument("--size", type=int, default=512)
    b.add_argument("--soften", type=float, default=1.2, help="edge blur in px (0 = none)")
    b.add_argument("--floor", type=float, default=0.06, help="ignore faint paper texture below this")
    lyr = sub.add_parser("layers", help="PNG layers -> WebP")
    lyr.add_argument("src")
    lyr.add_argument("--out", default=os.path.join(ROOT, "assets", "layers"))
    lyr.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()
    return {"check": cmd_check, "brushes": cmd_brushes, "layers": cmd_layers}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
