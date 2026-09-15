"""Sync the editable component into the self-contained deployment HTML.
Keep bundled fonts and third-party runtime bytes intact.
"""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
source=(root/'SpaceQuest.dc.html').read_text();p=root/'index.html';bundle=p.read_text()
m=re.search(r'<script type="__bundler/template">(.*?)</script>',bundle,re.S)
t=json.loads(m[1]);pattern=r'(<script[^>]*data-dc-script[^>]*>)(.*?)(</script>)'
logic=re.search(pattern,source,re.S)[2]
t=re.sub(pattern,lambda m:m[1]+logic+m[3],t,flags=re.S)
app_css=re.search(r'<style>(.*?)</style>',source,re.S)[1]
styles=list(re.finditer(r'<style>(.*?)</style>',t,re.S))
assert len(styles)==2,'Expected bundled fonts plus app CSS'
a=styles[1];t=t[:a.start(1)]+app_css+t[a.end(1):]
p.write_text(bundle[:m.start(1)]+'\n'+json.dumps(t,ensure_ascii=False).replace('</','<\\/')+'\n  '+bundle[m.end(1):])
print('Synced SpaceQuest logic and CSS into index.html')
