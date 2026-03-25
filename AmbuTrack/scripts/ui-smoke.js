const puppeteer = require('puppeteer');

async function run(){
  const url = process.env.FRONTEND_URL || 'http://localhost:5175';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  try{
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForTimeout(500);
    // navigate to login
    await page.goto(url + '/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(500);
    // navigate to register
    await page.goto(url + '/register', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(500);
    console.log('Navigation done. Collected console logs:');
    console.log(logs.join('\n'));
  }catch(e){
    console.error('Smoke test error', e);
  }finally{
    await browser.close();
  }
}

run();
