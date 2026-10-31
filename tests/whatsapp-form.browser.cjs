const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../Index.html'), 'utf8');
  const harness = '<!doctype html><iframe title="Apps Script sandbox" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" src="/Index.html" style="width:100%;height:1500px;border:0"></iframe>';
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if(request.url === '/api/config'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({enabled:true}));return;}
    if(request.url === '/api/evidence'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify([{name:'bukti.pdf',url:'https://drive.google.com/file/d/test/view'}]));return;}
    response.end(request.url === '/Index.html' ? html.replace('<script>', '<script>var form, review, labels;window.google={script:{run:{withSuccessHandler:function(fn){return {withFailureHandler:function(){return {getEvidenceConfiguration:function(){fn({enabled:true})},uploadEvidence:function(){fn([{name:"bukti.pdf",url:"https://drive.google.com/file/d/test/view"}])}}}}}}}};</script><script>') : harness);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
    for (const width of [390,1280]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      const errors=[]; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const frame=page.frameLocator('iframe');
      await frame.locator('#reviewButton').waitFor();
      const originalUrl=page.frames()[1].url();
      await frame.locator('#reviewButton').click();
      assert.equal(await frame.locator('#reviewDialog').isVisible(),false);
      assert.equal(await frame.locator('#requestForm').isVisible(),true);
      for (const [id,value] of Object.entries({applicant:'Petugas & Tim',requestDate:'2026-10-31',bank:'BCA',accountNumber:'0012345678',accountOwner:'Pemilik <Uji>'})) await frame.locator('#'+id).fill(value);
      await frame.getByRole('radio',{name:'Operasional',exact:true}).check();
      await frame.locator('#confirmation').check();
      await frame.locator('#evidenceFiles').setInputFiles({name:'bukti.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});
      await frame.locator('#reviewButton').click();
      assert.equal(await frame.locator('#reviewDialog').isVisible(),true);
      assert.equal(await frame.locator('#requestForm').isVisible(),false);
      assert.match(await frame.locator('#summary').innerText(),/0012345678/);
      assert.match(await frame.locator('#summary').innerText(),/Pemilik <Uji>/);
      assert.equal(await frame.locator('#summary img').count(),0);
      assert.equal(page.frames()[1].url(),originalUrl);
      await frame.locator('#editButton').click();
      assert.equal(await frame.locator('#accountNumber').inputValue(),'0012345678');
      await frame.locator('#accountNumber').fill('123-456');
      await frame.locator('#reviewButton').click();
      assert.equal(await frame.locator('#reviewDialog').isVisible(),false);
      await frame.locator('#accountNumber').fill('0012345678');
      await frame.locator('#reviewButton').click();
      await frame.locator('#whatsappButton').evaluate(() => {
        window.testWhatsAppLink='';
        HTMLAnchorElement.prototype.click=function () {window.testWhatsAppLink=this.href;};
      });
      await frame.locator('#whatsappButton').click();
      const href=await frame.locator('#status').evaluate(() => window.testWhatsAppLink);
      const url=new URL(href);assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/6288223062197');
      assert.match(url.searchParams.get('text'),/Petugas & Tim/);assert.match(url.searchParams.get('text'),/0012345678/);
      assert.equal(await frame.locator('#requestForm').isVisible(),true);
      assert.equal(page.frames()[1].url(),originalUrl);
      assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      await page.close();
    }
    // If initialization fails, neither the review button nor Enter can submit
    // personal data to a different page while waiting for the form to load.
    const page=await browser.newPage({javaScriptEnabled:false});
    await page.goto(`http://127.0.0.1:${server.address().port}/Index.html`);
    assert.equal(await page.locator('#reviewButton').isDisabled(),true);
    assert.equal(await page.locator('button[type=submit]').count(),0);
    assert.equal(await page.locator('#requestForm').getAttribute('onsubmit'),'return false;');
    console.log('PASS: iframe review/edit/validation at mobile and desktop sizes; no navigation or global-name collision; safe WhatsApp URL; initialization failure cannot activate review. No message sent.');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
