# Builds data/terrain.json: real elevation around LTAC from the public AWS Terrain Tiles (terrarium encoding, SRTM-based).
# Grid N x N, coordinates in the local metres of ltac.json (x east, y north, origin RWY 03R THR), denser near the airport:
# x = sign(t) * R * |t|^P for t in [-1, 1].  Heights stored in metres AMSL (int16).
import json, math, io, os, sys, urllib.request, base64, struct
from PIL import Image
root = sys.argv[1] if len(sys.argv) > 1 else '.'
d = json.load(open(root + '/data/ltac.json'))
lat0, lon0 = d['origin']['lat'], d['origin']['lon']
Z, N, R, P = 11, 301, 60000.0, 1.8
cx, cy = 1100.0, 1400.0                      # grid centre (middle of the aerodrome)
mlat = 111132.954 - 559.822 * math.cos(2 * math.radians(lat0))
mlon = 111412.84 * math.cos(math.radians(lat0))
def ll(x, y): return lat0 + y / mlat, lon0 + x / mlon
def tile_xy(lat, lon):
    n = 2 ** Z
    return (lon + 180) / 360 * n * 256, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 256
cache = {}
def tile(tx, ty):
    k = (tx, ty)
    if k not in cache:
        fn = f'/tmp/terr_{Z}_{tx}_{ty}.png'
        if not os.path.exists(fn):
            urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png', fn)
        cache[k] = Image.open(fn).convert('RGB').load()
    return cache[k]
def elev_px(px, py):
    tx, ty = int(px // 256), int(py // 256); r, g, b = tile(tx, ty)[int(px % 256), int(py % 256)]
    return r * 256 + g + b / 256 - 32768
def elev(lat, lon):   # bilinear
    px, py = tile_xy(lat, lon); px -= 0.5; py -= 0.5; x0, y0 = math.floor(px), math.floor(py); fx, fy = px - x0, py - y0
    a = elev_px(x0, y0); b = elev_px(x0 + 1, y0); c = elev_px(x0, y0 + 1); e = elev_px(x0 + 1, y0 + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy
ax = [math.copysign(R * abs(t) ** P, t) for t in [-1 + 2 * i / (N - 1) for i in range(N)]]
H = []
for j in range(N):
    for i in range(N):
        la, lo = ll(cx + ax[i], cy + ax[j]); H.append(int(round(elev(la, lo))))
raw = struct.pack('<%dh' % len(H), *H)
out = {'source': 'AWS Terrain Tiles (terrarium, z%d; SRTM/GMTED based)' % Z, 'n': N, 'r': R, 'p': P, 'cx': cx, 'cy': cy,
       'h': base64.b64encode(raw).decode()}
json.dump(out, open(root + '/data/terrain.json', 'w'))
print('min', min(H), 'max', max(H), 'centre', H[(N // 2) * N + N // 2], 'tiles', len(cache))
