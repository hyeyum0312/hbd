from pathlib import Path
from html.parser import HTMLParser
import sys,re,json,struct
class Head(HTMLParser):
    def __init__(self):
        super().__init__();self.inhead=False;self.intitle=False;self.titles=[];self.meta={};self.canonical=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='head':self.inhead=True
        if not self.inhead:return
        if tag=='title':self.intitle=True;self.titles.append('')
        if tag=='meta':
            key=a.get('property',a.get('name'))
            if key:self.meta.setdefault(key,[]).append(a.get('content'))
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
    def handle_endtag(self,tag):
        if tag=='head':self.inhead=False
        if tag=='title':self.intitle=False
    def handle_data(self,data):
        if self.intitle:self.titles[-1]+=data
TITLE='지운의 새로운 퀘스트가 도착했습니다 🚀'
DESC='PLAYER 지운 · 새로운 모험을 시작하시겠습니까?'
URL='https://hbd-jiun.vercel.app/'
IMAGE=URL+'assets/jiun-quest-og-v1.png'
def check(text,label):
    p=Head();p.feed(text)
    assert p.titles==[TITLE],(label,p.titles)
    expected={'description':DESC,'og:title':TITLE,'og:description':DESC,'og:image':IMAGE,'og:type':'website','og:url':URL,'twitter:card':'summary_large_image','twitter:title':TITLE,'twitter:description':DESC,'twitter:image':IMAGE,'og:image:width':'1200','og:image:height':'630','og:image:type':'image/png'}
    for k,v in expected.items():assert p.meta.get(k)==[v],(label,k,p.meta.get(k))
    assert p.canonical==[URL]
    print('PASS',label,'unique title and all share metadata')
path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html');s=path.read_text()
check(s,str(path))
t=json.loads(re.search(r'<script type="__bundler/template">(.*?)</script>',s,re.S)[1]);check(t,'runtime replacement HTML')
assert 'Bundled Page' not in s
helmet=re.search(r'<(?:sc-)?helmet[^>]*>(.*?)</(?:sc-)?helmet>',t,re.S)
assert not helmet or not re.search(r'<title|(?:og:|twitter:|name="description")',helmet[1])
if len(sys.argv)==1:
    check(Path('SpaceQuest.dc.html').read_text(),'source HTML')
    png=Path('assets/jiun-quest-og-v1.png').read_bytes()
    assert png[:8]==b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II',png[16:24])==(1200,630)
    print('PASS static PNG dimensions and no conflicting runtime metadata')
