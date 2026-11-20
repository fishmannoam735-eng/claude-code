# Turns apps/web/dist-static into one index.html (JS, CSS and webp pictures inlined) for the netlify-site branch.
# Usage: pnpm --filter @pb/web build:static && python3 tools/singlefile/inline.py apps/web/dist-static out/index.html
import base64, re, sys, os
d = sys.argv[1]; out = sys.argv[2]
html = open(f'{d}/index.html').read()
assets = os.path.join(d, 'assets')
def data_uri(name):
    b = open(os.path.join(assets, name), 'rb').read()
    return 'data:image/webp;base64,' + base64.b64encode(b).decode()
def fix_imgs(text):
    for f in os.listdir(assets):
        if f.endswith('.webp'):
            text = re.sub(r'new URL\("' + re.escape(f) + r'",\s*import\.meta\.url\)\.href', '"' + data_uri(f) + '"', text)
            text = text.replace(f'"{f}"', '"' + data_uri(f) + '"')
            text = text.replace(f'./assets/{f}', data_uri(f)).replace(f'/assets/{f}', data_uri(f)).replace(f'assets/{f}', data_uri(f))
    return text
css_name = re.search(r'href="\./assets/(index-[^"]+\.css)"', html).group(1)
js_name = re.search(r'src="\./assets/(index-[^"]+\.js)"', html).group(1)
css = fix_imgs(open(os.path.join(assets, css_name)).read())
js = fix_imgs(open(os.path.join(assets, js_name)).read()).replace('</script', '<\\/script')
html = re.sub(r'\s*<link rel="stylesheet" crossorigin href="\./assets/[^"]+">', '', html)
html = re.sub(r'\s*<script type="module" crossorigin src="\./assets/[^"]+"></script>', '', html)
html = html.replace('</head>', f'  <style>{css}</style>\n</head>')
html = html.replace('</body>', f'  <script type="module">{js}</script>\n</body>')
open(out, 'w').write(html)
print(len(html), 'assets left:', html.count('./assets/'))
