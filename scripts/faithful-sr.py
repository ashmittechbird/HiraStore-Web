"""
Faithful super-resolution: Real-ESRGAN sharpness, the original's colour and design.

Real-ESRGAN invents plausible detail, and on jewellery that can mean a stone
pattern, a bead edge or a colour the piece does not have. Three locks stop it:

  1. COLOUR — the chroma (Lab a/b) is taken entirely from the original,
     upscaled; Real-ESRGAN contributes nothing to colour.
  2. DETAIL — only Real-ESRGAN's fine detail (luminance high-pass) is used,
     and it is capped locally at 1.6x the detail a plain Lanczos upscale of the
     original has there. Where the original is smooth (inside a green stone,
     on a plain bead) the AI cannot add a pattern; where the original has
     detail, it may sharpen it.
  3. CONSISTENCY — iterative back-projection: the result is repeatedly
     downscaled, compared to the original, and corrected, until downscaling it
     reproduces the original. Nothing can survive that the original's own
     pixels contradict.

Outputs per photo: <CODE>.jpeg (long edge <= 1200) for the product page and
<CODE>.sm.jpeg (long edge <= 600) for shop cards, and a metrics line:
colour difference (CIE76 dE) between the downscaled result and the original.

Usage: faithful_sr.py <orig_dir> <esrgan_dir> <out_dir> <list.txt>
"""
import os
import sys
import cv2
import numpy as np

orig_dir, sr_dir, out_dir, lst = sys.argv[1:5]
os.makedirs(out_dir, exist_ok=True)
names = [l.strip() for l in open(lst) if l.strip()]
DETAIL_CAP = 1.6
FULL, SMALL = 1200, 600


def to_lab(bgr):
    return cv2.cvtColor(bgr.astype(np.float32) / 255.0, cv2.COLOR_BGR2Lab)


def to_bgr(lab):
    return np.clip(cv2.cvtColor(lab, cv2.COLOR_Lab2BGR) * 255.0, 0, 255)


def lstd(x, s):
    return np.sqrt(np.maximum(cv2.GaussianBlur(x * x, (0, 0), s), 1e-6))


print('code         size_in   size_out   dE_mean  dE_p99')
for fn in names:
    code = os.path.splitext(fn)[0]
    o = cv2.imread(os.path.join(orig_dir, fn))
    e = cv2.imread(os.path.join(sr_dir, code + '.png'))
    if e is None:
        e = cv2.imread(os.path.join(sr_dir, code + '.jpg'))
    h, w = o.shape[:2]
    H, W = e.shape[:2]
    scale = W / w

    o_up = cv2.resize(o, (W, H), interpolation=cv2.INTER_LANCZOS4)
    lab_o = to_lab(o_up)
    lab_e = to_lab(e)

    # 2. detail lock on luminance
    sig = 0.6 * scale                                   # one original pixel, in output pixels
    Le, Lo = lab_e[..., 0], lab_o[..., 0]
    hf_e = Le - cv2.GaussianBlur(Le, (0, 0), sig)
    hf_o = Lo - cv2.GaussianBlur(Lo, (0, 0), sig)
    win = 2.0 * scale
    gain = np.minimum(1.0, (DETAIL_CAP * lstd(hf_o, win) + 0.6) / lstd(hf_e, win))
    L = cv2.GaussianBlur(Lo, (0, 0), sig) + hf_e * gain

    # 1. colour lock
    lab = np.dstack([L, lab_o[..., 1], lab_o[..., 2]])
    out = to_bgr(lab)

    # 3. consistency lock — iterative back-projection to the original.
    # The target is the original with its JPEG blocking removed, and each
    # correction is spread smoothly: this pins colour, tone and shape to the
    # original without copying its 8x8 compression grain back in (which made
    # the first version look gritty).
    of = cv2.fastNlMeansDenoisingColored(o, None, 3, 3, 5, 15).astype(np.float32)
    for _ in range(5):
        down = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)
        err = cv2.resize(of - down, (W, H), interpolation=cv2.INTER_LINEAR)
        out = np.clip(out + cv2.GaussianBlur(err, (0, 0), 0.5 * scale), 0, 255)

    out8 = out.astype(np.uint8)
    down = cv2.resize(out8, (w, h), interpolation=cv2.INTER_AREA)
    dE = np.linalg.norm(to_lab(down) - to_lab(o), axis=2)

    def save(img, edge, path, q):
        s = min(1.0, edge / max(img.shape[:2]))
        im = cv2.resize(img, (round(img.shape[1] * s), round(img.shape[0] * s)), interpolation=cv2.INTER_AREA) if s < 1 else img
        cv2.imwrite(path, im, [cv2.IMWRITE_JPEG_QUALITY, q, cv2.IMWRITE_JPEG_PROGRESSIVE, 1, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
        return im.shape

    sf = save(out8, FULL, os.path.join(out_dir, code + '.jpeg'), 84)
    save(out8, SMALL, os.path.join(out_dir, code + '.sm.jpeg'), 80)
    print(f'{code:11s} {w}x{h}'.ljust(22) + f'{sf[1]}x{sf[0]}'.ljust(11) + f'{dE.mean():6.2f}  {np.percentile(dE, 99):6.2f}', flush=True)
