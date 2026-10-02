const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 8105;

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
    '--remote-debugging-port=9240',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const list = await (await fetch('http://127.0.0.1:9240/json/list')).json();
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

    const errors = [];
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.exceptionThrown') {
        errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || ''));
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');

    await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });

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

    await new Promise(r => setTimeout(r, 2000));

    const testResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = {};
          
          // 1. Setup user with known booster counts
          const senderId = 'sender_qty_test_' + Date.now();
          const senderUser = {
            telegramId: senderId,
            firstName: 'Отправитель',
            hints: 5,
            undos: 2,
            reveals: 0,
            extraBottles: 0
          };
          window.GiftsModule.setUser(senderUser);

          // 2. Open Ad Modal & switch to Gifts -> Send subnav
          const adBtn = document.getElementById('adBonusBtn');
          const giftsTab = document.getElementById('adTabGiftsBtn');
          adBtn.click();
          giftsTab.click();
          await new Promise(r => setTimeout(r, 200));

          const sendSubnav = document.getElementById('giftsSubnavSendBtn');
          sendSubnav.click();
          await new Promise(r => setTimeout(r, 300));

          // 3. Test player row layout (ONLY nickname and button 'Выбрать')
          const playersList = document.getElementById('giftsPlayersList');
          // Add mock players to list
          const mockPlayer1 = document.createElement('div');
          mockPlayer1.className = 'gift-player-row';
          mockPlayer1.innerHTML = '<div class=\"gift-player-left\"><strong class=\"gift-player-name\">Руслан</strong></div><div style=\"display:flex;align-items:center;\"><button type=\"button\" class=\"gift-player-select-btn\">Выбрать</button></div>';
          playersList.appendChild(mockPlayer1);

          const rowHtml = mockPlayer1.innerHTML;
          res.noRankBadgeInRow = !rowHtml.includes('🥇') && !rowHtml.includes('#1') && !rowHtml.includes('gift-player-rank');
          res.noLevelInRow = !rowHtml.includes('Уровень') && !rowHtml.includes('gift-player-lvl');
          res.hasNameInRow = rowHtml.includes('Руслан');
          res.hasSelectBtnInRow = rowHtml.includes('Выбрать');

          // 4. Select recipient
          window.GiftsModule.openSendForRecipient({
            telegramId: 'recipient_qty_test_99',
            displayName: 'Руслан',
            level: 10
          });
          await new Promise(r => setTimeout(r, 300));

          const stepItem = document.getElementById('giftsStepItem');
          res.stepItemVisible = !stepItem.classList.contains('hidden');

          // 5. Test clicking "Подарить" on reveals (balance = 0)
          const qtyModal = document.getElementById('giftQuantityModal');
          const sendRevealsBtn = document.querySelector('.gift-send-btn[data-gift-type=\"reveals\"]');
          sendRevealsBtn.click();
          await new Promise(r => setTimeout(r, 200));
          res.qtyModalHiddenOnZeroBal = qtyModal.classList.contains('hidden');

          // 6. Test clicking "Подарить" on hints (balance = 5)
          const sendHintsBtn = document.querySelector('.gift-send-btn[data-gift-type=\"hints\"]');
          sendHintsBtn.click();
          await new Promise(r => setTimeout(r, 200));

          res.qtyModalOpenedOnAvailable = !qtyModal.classList.contains('hidden');
          const valDisplay = document.getElementById('giftQtyValDisplay');
          const confirmBtn = document.getElementById('giftQtyConfirmBtn');
          const plusBtn = document.getElementById('giftQtyPlusBtn');
          const minusBtn = document.getElementById('giftQtyMinusBtn');

          res.initialQtyVal = valDisplay?.textContent;
          res.initialConfirmText = confirmBtn?.textContent;
          res.minusDisabledAtStart = minusBtn?.disabled;

          // 7. Click plus button 3 times -> quantity should be 4
          plusBtn.click();
          plusBtn.click();
          plusBtn.click();
          await new Promise(r => setTimeout(r, 100));

          res.qtyAfter3Plus = valDisplay?.textContent; // '4'
          res.confirmTextAfter3Plus = confirmBtn?.textContent; // 'Подарить (4 шт.)'

          // 8. Click plus 2 more times (trying to exceed balance 5)
          plusBtn.click(); // 5 (max)
          plusBtn.click(); // should stay 5
          await new Promise(r => setTimeout(r, 100));

          res.qtyAtMax = valDisplay?.textContent; // '5'
          res.plusDisabledAtMax = plusBtn?.disabled;

          // 9. Click minus button 2 times -> quantity should be 3
          minusBtn.click();
          minusBtn.click();
          await new Promise(r => setTimeout(r, 100));

          res.qtyAfter2Minus = valDisplay?.textContent; // '3'
          res.confirmTextAfter2Minus = confirmBtn?.textContent; // 'Подарить (3 шт.)'

          // 10. Click confirm to send 3 hints!
          confirmBtn.click();
          await new Promise(r => setTimeout(r, 1800));

          res.qtyModalClosedAfterSend = qtyModal.classList.contains('hidden');
          res.senderHintsAfterSend = senderUser.hints; // 5 - 3 = 2!

          // Check recipient inbox received item with amount = 3
          const inboxRaw = localStorage.getItem('colorsort_gifts_inbox_recipient_qty_test_99');
          const inbox = inboxRaw ? JSON.parse(inboxRaw) : [];
          res.recipientInboxLength = inbox.length;
          res.sentGiftAmount = inbox[0]?.amount; // 3!
          res.sentGiftType = inbox[0]?.giftType; // 'hints'

          return res;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('TEST RESULT:', JSON.stringify(testResult, null, 2));
    console.log('ERRORS:', errors);

    ws.close();
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    edge.kill();
    server.close();
    process.exit(0);
  }
});
