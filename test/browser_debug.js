const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 8089;

// 1. Static file server
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
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.resolve(__dirname, '..', 'scratch_edge_profile');

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    console.log('Edge tabs:', tabs.length);
    const wsUrl = tabs[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg.result);
      } else if (msg.method === 'Console.messageAdded') {
        console.log('[BROWSER CONSOLE]', msg.params.message.level, msg.params.message.text);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log('[BROWSER LOG]', msg.params.type, args);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      }
    };

    function sendCmd(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => ws.onopen = r);

    await sendCmd('Console.enable');
    await sendCmd('Runtime.enable');
    await sendCmd('Page.enable');

    console.log('Navigating to http://localhost:' + PORT);
    await sendCmd('Page.navigate', { url: `http://localhost:${PORT}/index.html` });

    await new Promise(r => setTimeout(r, 2500));

    // Evaluate test clicks in browser context
    const testResult = await sendCmd('Runtime.evaluate', {
      expression: `
        (async () => {
          const results = [];
          const adBtn = document.getElementById('adBonusBtn');
          results.push({ check: 'adBonusBtn exists', ok: !!adBtn });

          // Start screen dismiss if visible
          const startPlayBtn = document.getElementById('startPlayBtn') || document.querySelector('.start-btn');
          if (startPlayBtn) {
            startPlayBtn.click();
            await new Promise(r => setTimeout(r, 600));
          }

          // Click ad button
          adBtn.click();
          await new Promise(r => setTimeout(r, 300));

          const adModal = document.getElementById('adModal');
          results.push({
            check: 'adModal opened',
            classList: adModal.className,
            isHidden: adModal.classList.contains('hidden')
          });

          // Check tabs
          const adsTabBtn = document.getElementById('adTabAdsBtn');
          const giftsTabBtn = document.getElementById('adTabGiftsBtn');
          results.push({ check: 'adTabAdsBtn exists', ok: !!adsTabBtn });
          results.push({ check: 'adTabGiftsBtn exists', ok: !!giftsTabBtn });

          // Click gifts tab
          if (giftsTabBtn) {
            giftsTabBtn.click();
            await new Promise(r => setTimeout(r, 300));
          }

          const adsContent = document.getElementById('adModalAdsContent');
          const giftsContent = document.getElementById('adModalGiftsContent');
          results.push({
            check: 'giftsContent visible after clicking giftsTab',
            adsContentHidden: adsContent ? adsContent.classList.contains('hidden') : null,
            giftsContentHidden: giftsContent ? giftsContent.classList.contains('hidden') : null,
            giftsTabActiveClass: giftsTabBtn ? giftsTabBtn.classList.contains('active') : null
          });

          // Click Send Gift subnav
          const sendSubnavBtn = document.getElementById('giftsSubnavSendBtn');
          results.push({ check: 'giftsSubnavSendBtn exists', ok: !!sendSubnavBtn });
          if (sendSubnavBtn) {
            sendSubnavBtn.click();
            await new Promise(r => setTimeout(r, 400));
          }

          const sendView = document.getElementById('giftsSendView');
          const receiveView = document.getElementById('giftsReceiveView');
          results.push({
            check: 'sendView visible after clicking sendSubnavBtn',
            sendViewHidden: sendView ? sendView.classList.contains('hidden') : null,
            receiveViewHidden: receiveView ? receiveView.classList.contains('hidden') : null
          });

          // Check if players list loaded
          const playersList = document.getElementById('giftsPlayersList');
          results.push({
            check: 'giftsPlayersList children count',
            count: playersList ? playersList.children.length : 0,
            htmlPreview: playersList ? playersList.innerHTML.substring(0, 150) : ''
          });

          return results;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('TEST RESULTS:', JSON.stringify(testResult, null, 2));

    ws.close();
  } catch (err) {
    console.error('Debug error:', err);
  } finally {
    edge.kill();
    server.close();
    process.exit(0);
  }
});
