#!/usr/bin/env python3
"""Reproducible v3.5 release gate for SQLD NOTE data, links and baseline stability."""
from pathlib import Path
from collections import Counter
import hashlib,json,re,sys,sqlite3
ROOT=Path(__file__).resolve().parents[1]
BASELINE=ROOT/'questions/baseline_v34.json'
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8'))
q=read('questions/bank.json');baseline=read('questions/baseline_v34.json');original=q[:baseline['baseline_count']]
sy=read('content/syllabus.json');qr=read('content/quick_reference.json');su=read('content/supplements.json');m=read('questions/manifest.json')
assert len(original)==226 and [z['id'] for z in original]==baseline['baseline_ids'],'Baseline IDs changed'
assert hashlib.sha256(json.dumps(original,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()==baseline['sha256_of_canonical_json'],'Baseline question objects changed'
assert len(q)==247 and len(set(z['id'] for z in q))==247
assert all(q[i]['id']==f'qv3_{i+1:04d}' for i in range(247))
assert len(su)==13 and len({z['id'] for z in su})==13
assert len(sy['items'])==30 and len(qr['cards'])==30
assert Counter(z['part'] for z in sy['items'])=={'model':10,'basic':8,'usage':8,'manage':4}
assert {z['id'] for z in sy['items']}=={z['id'] for z in qr['cards']}
assert all(z['frequency']['status']=='unmeasured' and z['frequency']['rounds_seen'] is None for z in sy['items'])
assert all(z['official_scope'] for z in sy['items'])
assert all(z['mini_example']['table']['rows'] and len(z['mini_example']['table']['columns']) for z in qr['cards'])
assert all(len(row)==len(z['mini_example']['table']['columns']) for z in qr['cards'] for row in z['mini_example']['table']['rows'])
for x in sy['items']:
 assert (x['lesson_ref'] is None or re.fullmatch(r'c\d\d',x['lesson_ref']))
 assert (x['supplement_ref'] is None or x['supplement_ref'] in {z['id'] for z in su}),(x['title'],x['supplement_ref'])
 assert x['lesson_ref'] or x['supplement_ref'],('No deep link',x['title'])
 assert len([z for z in q if z['topic'] in x['practice_topics']])>=2,('No independent problems',x['title'])
for item in q:
 assert len(item['choices'])==4 and len(item['option_explanations'])==4
 assert len(set(item['choices']))==4,item['id']
 assert isinstance(item['answer'],int) and 0<=item['answer']<4
 assert item['verified'] is True
 assert item['topic'] and item['stem'] and item['explanation']
 assert re.fullmatch('qv3_[a-z0-9_]{1,64}',item['id'])
assert m['count']==m['total_questions']==len(q)
assert m['baseline_question_count']==226 and m['added_question_count']==21
assert m['options_explained_count']==len(q)
assert m['quick_reference_count']==30 and m['supplement_count']==13 and m['core_lessons_count']==15
assert sum(m['by_subject'].values())==len(q)
assert sum(m['by_topic'].values())==len(q)
assert sum(m['difficulty_distribution'].values())==len(q)
assert sum(m['verification_methods'].values())==len(q)
assert m['verification_methods']==dict(Counter(z['verification_method'] for z in q))
assert m['sql_verified_count']==125
html=(ROOT/'index.html').read_text();script=(ROOT/'assets/v3.js').read_text();css=(ROOT/'assets/v3.css').read_text()
assert 'S등급' not in html
assert html.count('class="lesson"')==15
assert 'sqld_note_snapshots' in html and 'sqld_question_states' in script
assert "const K_GUEST='sqld_v3_guest_v1'" in script # do not invalidate local progress
assert 'quick-reference' in html and 'content/quick_reference.json' in script
assert 'v35-quick-open' in css
assert '#quick-reference' in html
print('OK: 30/30 coverage cards, examples with mini tables and valid deep links')
print('OK: 13 supplements, 15 original chapters, 247 unique questions')
print('OK: 226 baseline questions preserved byte-for-byte at JSON object level')
print('OK: original local key and Supabase table wiring preserved')
print('OK: all frequency fields unmeasured; no unsupported S-grade label')
print('OK: manifest totals and explanation arrays verified')
print('Counts:',dict(Counter(z['subject'] for z in q)))
print('Methods:',dict(Counter(z['verification_method'] for z in q)))
