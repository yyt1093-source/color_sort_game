const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 8098;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log(`Server started on http://localhost:${PORT}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const list = await (await fetch('http://127.0.0.1:9228/json/list')).json();
    const pageTab = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise(res => {
      const cur = id++;
      const fn = e => {
        const d = JSON.parse(e.data);
        if (d.id === cur) {
          ws.removeEventListener('message', fn);
          res(d.result);
        }
      };
      ws.addEventListener('message', fn);
      ws.send(JSON.stringify({ id: cur, method: m, params: p }));
    });

    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const args = d.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log('[LOG]', d.params.type, args);
      }
      if (d.method === 'Runtime.exceptionThrown') {
        console.error('[ERR]', d.params.exceptionDetails.text, d.params.exceptionDetails.exception?.description);
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('Navigating...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });

    // Wait for Page.loadEventFired
    await new Promise(r => {
      const fn = e => {
        const d = JSON.parse(e.data);
        if (d.method === 'Page.loadEventFired') {
          ws.removeEventListener('message', fn);
          r();
        }
      };
      ws.addEventListener('message', fn);
    });

    console.log('Page loaded!');
    await new Promise(r => setTimeout(r, 2000));

    const checkDom = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const adBtn = document.getElementById('adBonusBtn');
          const adModal = document.getElementById('adModal');
          const adTabGiftsBtn = document.getElementById('adTabGiftsBtn');
          const adTabAdsBtn = document.getElementById('adTabAdsBtn');
          const giftsModule = !!window.GiftsModule;
          return {
            title: document.title,
            hasAdBonusBtn: !!adBtn,
            hasAdModal: !!adModal,
            hasAdTabGiftsBtn: !!adTabGiftsBtn,
            hasAdTabAdsBtn: !!adTabAdsBtn,
            giftsModuleReady: giftsModule
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM CHECK:', JSON.stringify(checkDom, null, 2));

    // Test clicking adBonusBtn
    const testClickAdBtn = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const adBtn = document.getElementById('adBonusBtn');
          if (!adBtn) return { error: 'adBonusBtn not found' };
          adBtn.click();
          const adModal = document.getElementById('adModal');
          return {
            adModalClasses: adModal.className,
            isVisible: !adModal.classList.contains('hidden')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('TEST CLICK AD BTN:', JSON.stringify(testClickAdBtn, null, 2));

    // Test switching tabs
    const testTabs = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const giftsTab = document.getElementById('adTabGiftsBtn');
          const adsTab = document.getElementById('adTabAdsBtn');
          const giftsContent = document.getElementById('adModalGiftsContent');
          const adsContent = document.getElementById('adModalAdsContent');

          giftsTab.click();
          await new Promise(r => setTimeout(r, 200));
          const step1 = {
            giftsTabActive: giftsTab.classList.contains('active'),
            adsTabActive: adsTab.classList.contains('active'),
            giftsContentHidden: giftsContent.classList.contains('hidden'),
            adsContentHidden: adsContent.classList.contains('hidden')
          };

          adsTab.click();
          await new Promise(r => setTimeout(r, 200));
          const step2 = {
            giftsTabActive: giftsTab.classList.contains('active'),
            adsTabActive: adsTab.classList.contains('active'),
            giftsContentHidden: giftsContent.classList.contains('hidden'),
            adsContentHidden: adsContent.classList.contains('hidden')
          };

          // Switch back to Gifts tab to test subnav
          giftsTab.click();
          await new Promise(r => setTimeout(r, 200));

          const sendSubnav = document.getElementById('giftsSubnavSendBtn');
          const receiveSubnav = document.getElementById('giftsSubnavReceiveBtn');
          const sendView = document.getElementById('giftsSendView');
          const receiveView = document.getElementById('giftsReceiveView');

          sendSubnav.click();
          await new Promise(r => setTimeout(r, 200));
          const step3 = {
            sendSubnavActive: sendSubnav.classList.contains('active'),
            receiveSubnavActive: receiveSubnav.classList.contains('active'),
            sendViewHidden: sendView.classList.contains('hidden'),
            receiveViewHidden: receiveView.classList.contains('hidden')
          };

          return { step1, step2, step3 };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('TEST TABS RESULT:', JSON.stringify(testTabs, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    edge.kill();
    server.close();
    process.exit(0);
  }
});
