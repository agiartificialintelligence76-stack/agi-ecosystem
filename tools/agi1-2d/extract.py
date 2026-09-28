# Take the owner's 2D art out of "agi 2d anime/agi-vtuber.html" (it keeps every layer as a WebP picture inside the page):
# writes layers/<name>.webp and meta.json into the current (work) folder. usage: python3 extract.py <path to the html>
import sys, re, json, base64, os
html = open(sys.argv[1], encoding='utf-8').read()
m = re.search(r'window\.AGI_ASSETS\s*=\s*(\{.*?\});\s*</script>', html, re.S)
if not m: sys.exit('AGI_ASSETS not found in that file')
A = json.loads(m.group(1))
os.makedirs('layers', exist_ok=True)
os.makedirs('out', exist_ok=True)
for name, url in A['img'].items():
    head, data = url.split(',', 1)
    ext = 'webp' if 'webp' in head else 'png'
    open(f'layers/{name}.{ext}', 'wb').write(base64.b64decode(data))
json.dump(A['meta'], open('meta.json', 'w'), indent=1)
print('layers:', ', '.join(sorted(A['img'])))
