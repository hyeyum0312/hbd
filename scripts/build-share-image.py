"""Render the existing game sprites into a dependency-free, static OG PNG."""
from pathlib import Path
import re, json, random, math, struct, zlib
root = Path(__file__).resolve().parents[1]
source = (root / 'SpaceQuest.dc.html').read_text()
palette = dict(re.findall(r'(\w): "(#[0-9A-Fa-f]+)"', re.search(r'const PAL = \{(.*?)\};', source, re.S)[1]))
def sprite(name):
    return json.loads(re.search(r'const '+name+r' = (\[.*?\]);', source, re.S)[1])
w,h=400,210
pixels=[]
for y in range(h):
    row=[]
    for x in range(w):
        glow=max(0,1-math.hypot((x-200)/220,(y-105)/145))
        row.append((int(4+8*glow),int(6+13*glow),int(15+29*glow)))
    pixels.append(row)
def rect(x,y,rw,rh,color):
    if isinstance(color,str): color=tuple(bytes.fromhex(color[1:]))
    for yy in range(max(0,y),min(h,y+rh)):
        for xx in range(max(0,x),min(w,x+rw)): pixels[yy][xx]=color
def draw(name,cx,cy,scale):
    rows=sprite(name); x=round(cx-len(rows[0])*scale/2); y=round(cy-len(rows)*scale/2)
    for yy,row in enumerate(rows):
        for xx,c in enumerate(row):
            if c!='.': rect(x+xx*scale,y+yy*scale,scale,scale,palette[c])
rng=random.Random(916)
for _ in range(110):
    x,y=rng.randrange(8,w-8),rng.randrange(8,h-8)
    if 147<x<253 and 52<y<158: continue
    rect(x,y,1,1,rng.choice(['#24406E','#395276','#5E7BB0','#9FB6E0']))
for x,y in [(53,53),(124,39),(281,169),(334,76),(184,26),(224,181)]:
    rect(x-2,y,5,1,'#7CE7FF');rect(x,y-2,1,5,'#7CE7FF');rect(x,y,1,1,'#E8EEFB')
draw('PLANET',107,142,3)
draw('SHIP',294,65,3)
draw('HERO',200,105,8)
# Integer 3x scaling retains the exact hard edges of the in-game pixel map.
raw=bytearray()
for row in pixels:
    scan=b'\x00'+b''.join(bytes(color)*3 for color in row)
    raw.extend(scan*3)
def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1200,630,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
out=root/'assets/jiun-quest-og-v1.png';out.write_bytes(png)
print(f'{out}: 1200x630, {len(png)} bytes')
