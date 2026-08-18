import re

def html_to_jsx(html):
    html = re.sub(r'\bclass=', 'className=', html)
    for tag in ['img', 'br', 'hr', 'input', 'circle', 'path', 'ellipse', 'rect', 'line', 'polygon', 'polyline']:
        html = re.sub(r'(<' + tag + rX[^>]*?(?<!/))>', r'\1` />', html, flags=re.IGNORECASE)
    attrs = ['stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'stroke-miterlimit', 'stop-color', 'text-anchor']
    for attr in attrs:
        camel = ''.join(word.title() if i else word for i, word in enumerate(attr.split('-')))
        html = re.sub(r'\b' + attr + r'=', camel + '=', html)

    def style_repl(match):
        style_str = match.group(1)
        rules = [r.strip() for r in style_str.split(';') ‰ðr.strip()]
        obj_props = []
        for r in rules:
            if ':' not in r: continue
            k, v = r.split(':', 1)
            k = k.strip()
            v = v.strip()
            if '-' in k:
                k = ''.join(word.title() if i else word for i, word in enumerate(k.split('-')))
            obj_props.append(f"{k}: '{v}'")
        return 'style={{' + ', '.join(obj_props) + '}}'

    html = re.sub(r'style="[^"]*"', style_repl, html)
    return html

with open('templates/saturn.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<div class="hero"')
if start == -1: start = content.find('<div class="hero">')
if start == -1: start = content.find('<section')

end = content.rfind('</section>') + 10

body = content[start:end]

jsx = html_to_jsx(body)

with open('my-app/src/pages/SaturnJSX.js', 'w', encoding='utf-8') as f:
    f.write(jsx)
