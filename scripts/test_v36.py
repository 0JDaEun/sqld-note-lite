from pathlib import Path
from playwright.sync_api import sync_playwright
import json,traceback
R=Path(__file__).resolve().parents[1];fixture=(R/'qa/v36_fixture.html').read_text()
errs=[];reports=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 for width in [360,390,430,768,1440]:
  page=browser.new_page(viewport={'width':width,'height':844})
  page.on('pageerror',lambda e:errs.append(str(e)))
  page.evaluate("location.hash='#home'")
  page.set_content(fixture,wait_until='domcontentloaded',timeout=35000)
  try:
   page.locator('#v3-stat-total').wait_for(state='visible',timeout=18000)
   assert page.locator('#v3-stat-total').inner_text()=='300'
   assert page.locator('.v36-home-mock').is_visible()
   assert page.locator('#home').is_visible()
   page.locator('.v36-home-mock').click()
   page.locator('[data-mock-start]').wait_for(state='visible',timeout=14000)
   assert page.locator('.v36-start').is_visible()
   assert page.locator('#home').is_hidden()
   page.locator('[data-mock-start]').click()
   assert page.locator('.v36-navigation button').count()==50
   assert page.locator('.v36-option').count()==4
   assert page.locator('.v36-progress').inner_text().startswith('문제 1 / 50')
   meta=page.evaluate("JSON.parse(localStorage.getItem('sqld_mock_exam_v1'))")
   assert len(meta['entries'])==50
   allbank=page.evaluate("window.sqldBankForMock().map(q=>({id:q.id,subject:q.subject}))")
   byId={x['id']:x['subject'] for x in allbank}
   assert all(byId[e['id']]=='데이터 모델링' for e in meta['entries'][:10])
   assert all(byId[e['id']]=='SQL 기본 및 활용' for e in meta['entries'][10:])
   assert len({e['id'] for e in meta['entries']})==50
   page.locator('.v36-option').first.click()
   assert page.locator('.v36-navigation button.answered').count()==1
   page.locator('[data-mock-flag]').click()
   assert page.locator('.v36-navigation button.flagged').count()==1
   page.locator('[data-mock-next]').click()
   assert '문제 2 / 50' in page.locator('.v36-progress').inner_text()
   page.set_content(fixture,wait_until='domcontentloaded',timeout=35000)
   assert '문제 2 / 50' in page.locator('.v36-progress').inner_text(), 'resume after reload'
   page.locator('[data-mock-jump="0"]').click()
   assert page.locator('.v36-option.picked').count()==1
   assert page.locator('.v36-flag.on').count()==1
   page.locator('[data-mock-jump="10"]').click()
   assert '2과목' in page.locator('.v36-topline').inner_text()
   page.on('dialog',lambda d:d.accept())
   before=page.evaluate("localStorage.getItem('sqld_v3_guest_v1')")
   page.locator('[data-mock-submit]').click()
   assert page.locator('.v36-result-head').is_visible()
   assert page.locator('.v36-reviewed').count()==50
   assert page.locator('.v36-score-part').count()==2
   assert page.evaluate("localStorage.getItem('sqld_v3_guest_v1')")==before
   # 15 advanced cases and no layout overflow
   page.evaluate("location.hash='#c01'")
   page.locator('#c01').wait_for(state='visible',timeout=12000)
   page.locator('#c01 [data-stage-btn="1"]').click()
   page.locator('#c01 .v36-advanced').wait_for(state='visible',timeout=12000)
   assert page.locator('.v36-advanced').count()==15
   assert page.locator('#c01 .v36-advanced table').count()==1
   page.evaluate("location.hash='#quick-reference'")
   page.locator('.v35-concept-card').first.wait_for(state='visible',timeout=12000)
   assert page.locator('.v35-concept-card').count()==30
   over=page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
   assert over<=1,(width,over)
   reports.append({'width':width,'passed':True,'overflow':over,'mock':'50 questions, score, reload resume','advanced':15})
   if width in [390,1440]:
    page.evaluate("location.hash='#mock'")
    page.screenshot(path=str(R/'qa'/f'v36_exam_results_{width}.png'),full_page=False,animations='disabled')
   page.close()
  except Exception as e:
   print('ERROR viewport',width,str(e));page.screenshot(path=str(R/'qa'/f'v36_failure_{width}.png'),full_page=False,animations='disabled');traceback.print_exc();raise
 # test timeout: synthetic storage update, render via reload
 page=browser.new_page(viewport={'width':390,'height':844})
 page.evaluate("location.hash='#mock'")
 page.set_content(fixture,wait_until='domcontentloaded',timeout=35000)
 page.locator('[data-mock-start]').click()
 page.evaluate("const k='sqld_mock_exam_v1';const v=JSON.parse(localStorage.getItem(k));v.expiresAt=Date.now()-1000;localStorage.setItem(k,JSON.stringify(v))")
 page.set_content(fixture,wait_until='domcontentloaded',timeout=35000)
 assert '제한 시간이 종료' in page.locator('.v36-result-head').inner_text()
 print('timeout auto-submit check: PASS')
 print('RESULT',json.dumps(reports,ensure_ascii=False))
 print('JS_ERRORS',errs)
 assert not errs,errs
 browser.close()
