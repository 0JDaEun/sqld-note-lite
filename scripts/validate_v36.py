#!/usr/bin/env python3
"""SQLD NOTE v3.6 release gate. Original 247 must remain byte-identical at object level."""
from pathlib import Path
from collections import Counter
import json,hashlib,re,sqlite3,sys
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
old=json.loads(Path('/mnt/data/sqld_v35_release/questions/bank.json').read_text()) if Path('/mnt/data/sqld_v35_release/questions/bank.json').exists() else None
q=read('questions/bank.json');m=read('questions/manifest.json');sy=read('content/syllabus.json');qr=read('content/quick_reference.json');su=read('content/supplements.json');adv=read('content/advanced_cases.json')
base=read('questions/baseline_v35.json')
canonical=lambda x:hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
assert len(q)==300 and len({v['id'] for v in q})==300
assert q[246]['id']=='qv3_0247' and q[-1]['id']=='qv3_0300'
assert base['count']==247 and canonical(q[:247])==base['sha256_canonical_json'],'Original 247 questions changed'
if old is not None:assert old==q[:247]
assert [v['id'] for v in q]==[f'qv3_{i:04d}' for i in range(1,301)]
assert Counter(v['subject'] for v in q)=={'데이터 모델링':60,'SQL 기본 및 활용':240}
assert len(sy['items'])==30 and len(qr['cards'])==30 and len(su)==13
assert len(adv)==15 and [z['chapter'] for z in adv]==list(range(1,16))
assert all(len(x['comparison']['rows'])>=2 for x in adv)
assert all(len(x['mini_example']['table']['rows'])>0 for x in qr['cards'])
assert all(v['verified'] and len(v['choices'])==4 and len(set(v['choices']))==4 and 0<=v['answer']<4 and len(v['option_explanations'])==4 for v in q)
assert all(v['verification_method'] in ['editorial_review','sql_executed'] for v in q[247:])
assert all(v.get('frequency','미집계')=='미집계' for v in q[247:])
assert sum(v['subject']=='데이터 모델링' for v in q[247:])==16
assert sum(v['verification_method']=='sql_executed' for v in q[247:])==37
assert all(v.get('steps') and len(v['steps'])>=2 for v in q[247:])
for k in ['by_subject','by_topic','difficulty_distribution','verification_methods']:
 field={'by_subject':'subject','by_topic':'topic','difficulty_distribution':'difficulty','verification_methods':'verification_method'}[k]
 assert m[k]==dict(Counter(v[field] for v in q)),k
assert m['version']=='3.6' and m['count']==300 and m['sql_verified_count']==162
assert m['baseline_question_count']==247 and m['added_question_count']==53
assert m['mock_exam']=={'questions':50,'duration_minutes':90,'model':10,'sql':40,'pass_total':60,'min_subject_percent':40}
scanned=0
for item in q[247:]:
 if item['verification_method']!='sql_executed':continue
 connection=sqlite3.connect(':memory:')
 for t in item['input_tables']:
  columns=[f'"{name}" '+ ('TEXT' if any(isinstance(r[j],str) for r in t['rows']) else 'INTEGER') for j,name in enumerate(t['columns'])]
  connection.execute('CREATE TABLE "'+t['name']+'" ('+','.join(columns)+')')
  connection.executemany('INSERT INTO "'+t['name']+'" VALUES ('+','.join('?' for _ in t['columns'])+')',t['rows'])
 statements=[statement.strip() for statement in item['sql'].split(';') if statement.strip()]
 for stmt in statements[:-1]:connection.execute(stmt)
 cur=connection.execute(statements[-1]);rows=cur.fetchall()
 assert len(rows)==1 and len(rows[0])==1,(item['id'],rows)
 value=rows[0][0]
 assert item['execution_output']['rows']==[list(x) for x in rows],item['id']
 assert item['choices'][item['answer']]==str(value) if value is not None else item['choices'][item['answer']]=='NULL',item['id']
 assert item['result_table']['rows']==[[value]],item['id']
 scanned+=1
 connection.close()
assert scanned==37
html=(ROOT/'index.html').read_text();js=(ROOT/'assets/v3.js').read_text();mock=(ROOT/'assets/mock.js').read_text()
assert html.count('class="lesson"')==15
assert 'id="mock-app"' in html and 'assets/mock.js' in html and 'assets/v3.js' in html
assert 'quick-reference' in html and 'content/advanced_cases.json' in js
assert "const K_GUEST='sqld_v3_guest_v1'" in js
assert 'sqld_question_states' in js
assert 'sqld_mock_exam_v1' in mock and '90*60*1000' in mock and "diversify(model,10" in mock and "diversify(sql,40" in mock
assert 'sqld_mock_history_v1' in mock and 'correct[0]>=4' in mock and 'correct[1]>=16' in mock
print('PASS 300 questions (model 60, SQL 240): original 247 unchanged')
print('PASS 37 new SQL items reexecuted and answer/result tables match, total 162 SQL verified')
print('PASS 15 advanced comparisons, 30 overview, 13 supplements')
print('PASS original Supabase/local storage keys preserved; mock exam local-only separate')
print('PASS exam rules 50 questions/90 minutes/10+40/60% total and 40% each')
print('Difficulty:',Counter(v['difficulty'] for v in q))
