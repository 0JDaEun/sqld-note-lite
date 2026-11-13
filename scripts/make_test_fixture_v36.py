from pathlib import Path
import base64,json
R=Path(__file__).resolve().parents[1];s=(R/'index.html').read_text()
s=s.replace('<link rel="stylesheet" href="/assets/v3.css">','<style>\n'+(R/'assets/v3.css').read_text()+'\n</style>')
s=s.replace('<script src="/assets/v3.js" defer></script>','<script>\n'+(R/'assets/v3.js').read_text()+'\n</script>')
s=s.replace('<script src="/assets/mock.js" defer></script>','<script>\n'+(R/'assets/mock.js').read_text()+'\n</script>')
files=['questions/bank.json','content/supplements.json','content/deepdives.json','content/visuals.json','content/execution_traces.json','content/syllabus.json','content/quick_reference.json','content/advanced_cases.json']
encoded={ '/'+f:base64.b64encode((R/f).read_bytes()).decode('ascii') for f in files }
shim='''<script>window.fetch=async function(url){const m=%s;const data=m[String(url)];if(data){const bytes=Uint8Array.from(atob(data),x=>x.charCodeAt(0));return new Response(bytes,{status:200,headers:{'Content-Type':'application/json;charset=utf-8'}});}throw new Error('External fetch disabled in test fixture: '+url);};</script>'''%json.dumps(encoded)
storage='''<script>(function(){let mem={};try{mem=JSON.parse(window.name||'{}')}catch(e){};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);window.name=JSON.stringify(mem)},removeItem:k=>{delete mem[k];window.name=JSON.stringify(mem)}}});})();</script>'''
s=s.replace('</head>',storage+shim+'</head>')
(R/'qa/v36_fixture.html').write_text(s)
print('fixture bytes',len(s),'fetch mocks',len(files))
