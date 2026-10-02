const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 8092;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqPath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, async () => {
  console.log('Test server running on port', PORT);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const listRes = await fetch('http://127.0.0.1:9224/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise(res => {
      const cur = id++;
      const onmsg = e => {
        const d = JSON.parse(e.data);
        if (d.id === cur) {
          ws.removeEventListener('message', onmsg);
          res(d.result);
        }
      };
      ws.addEventListener('message', onmsg);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });

    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log('[CONSOLE]', text);
      }
      if (d.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', d.params.exceptionDetails.text, d.params.exceptionDetails.exception?.description);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Navigating...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
    await new Promise(r => setTimeout(r, 4000));

    const pageState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            href: location.href,
            title: document.title,
            bodyChildren: document.body ? document.body.children.length : 0,
            hasAdBonusBtn: !!document.getElementById('adBonusBtn'),
            hasAdModal: !!document.getElementById('adModal'),
            hasAdTabGiftsBtn: !!document.getElementById('adTabGiftsBtn'),
            hasStartScreen: !!document.getElementById('startScreen'),
            startScreenClasses: document.getElementById('startScreen')?.className,
            loadingScreenClasses: document.getElementById('loadingScreen')?.className
          };
        })()
      `,
      returnByValue: true
    });

    console.log('PAGE STATE:', pageState);

    // Now test clicking adBonusBtn
    const clickAdBtn = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const startPlayBtn = document.getElementById('startPlayBtn') || document.querySelector('.start-btn');
          if (startPlayBtn) startPlayBtn.click();
          const startScreen = document.getElementById('startScreen');
          if (startScreen) startScreen.classList.add('start-screen-hidden');

          const btn = document.getElementById('adBonusBtn');
          if (!btn) return { error: 'adBonusBtn not found' };
          btn.click();
          const adModal = document.getElementById('adModal');
          return {
            clicked: true,
            adModalClasses: adModal ? adModal.className : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log('CLICK AD BTN RESULT:', clickAdBtn);

    // Now test clicking tabs
    const clickTabs = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const adTabGiftsBtn = document.getElementById('adTabGiftsBtn');
          const adTabAdsBtn = document.getElementById('adTabAdsBtn');
          const adModalGiftsContent = document.getElementById('adModalGiftsContent');
          const adModalAdsContent = document.getElementById('adModalAdsContent');

          if (!adTabGiftsBtn) return { error: 'adTabGiftsBtn not found' };

          // Click Gifts Tab
          adTabGiftsBtn.click();
          await new Promise(r => setTimeout(r, 200));

          const afterGiftsClick = {
            giftsTabActive: adTabGiftsBtn.classList.contains('active'),
            adsTabActive: adTabAdsBtn ? adTabAdsBtn.classList.contains('active') : null,
            giftsContentHidden: adModalGiftsContent ? adModalGiftsContent.classList.contains('hidden') : null,
            adsContentHidden: adModalAdsContent ? adModalAdsContent.classList.contains('hidden') : null
          };

          // Click Ads Tab
          if (adTabAdsBtn) adTabAdsBtn.click();
          await new Promise(r => setTimeout(r, 200));

          const afterAdsClick = {
            giftsTabActive: adTabGiftsBtn.classList.contains('active'),
            adsTabActive: adTabAdsBtn ? adTabAdsBtn.classList.contains('active') : null,
            giftsContentHidden: adModalGiftsContent ? adModalGiftsContent.classList.contains('hidden') : null,
            adsContentHidden: adModalAdsContent ? adModalAdsContent.classList.contains('hidden') : null
          };

          return { afterGiftsClick, afterAdsClick };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('CLICK TABS RESULT:', clickTabs);

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edge.kill();
    server.close();
    process.exit(0);
  }
});
