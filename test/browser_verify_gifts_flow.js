const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 8099;

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
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const list = await (await fetch('http://127.0.0.1:9229/json/list')).json();
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

    // Test gifts flow:
    const flowResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = {};
          
          // 1. Setup user with known booster counts
          const uid = 'test_user_' + Date.now();
          const testUser = {
            telegramId: uid,
            firstName: 'Тестовый Игрок',
            hints: 3,
            undos: 2,
            reveals: 1,
            extraBottles: 0
          };
          window.GiftsModule.setUser(testUser);

          // 2. Seed an incoming gift in localStorage inbox
          const testInbox = [
            {
              id: 'gift_test_' + Date.now(),
              senderId: 'secret_sender_888',
              recipientId: uid,
              giftType: 'hints',
              giftName: 'Подсказка',
              giftIcon: '💡',
              amount: 1,
              createdAt: Date.now(),
              claimed: false
            }
          ];
          localStorage.setItem('colorsort_gifts_inbox_' + uid, JSON.stringify(testInbox));

          // Run checkPendingGifts
          await window.GiftsModule.checkPendingGifts();
          
          const adBonusBtn = document.getElementById('adBonusBtn');
          const giftsTabBtn = document.getElementById('adTabGiftsBtn');
          const giftsBadge = document.getElementById('adGiftsTabBadge');

          res.adBtnPulsing = adBonusBtn.classList.contains('has-pending-gift');
          const adGiftsTabIcon = document.getElementById('adGiftsTabIcon');
          res.tabIconPulsing = adGiftsTabIcon ? adGiftsTabIcon.classList.contains('gift-tab-icon-pulse') : false;
          res.badgeText = giftsBadge ? giftsBadge.textContent : null;

          // Open Ad modal and Gifts tab
          adBonusBtn.click();
          giftsTabBtn.click();
          await new Promise(r => setTimeout(r, 600));

          // Check receive list contains the gift
          const receivedList = document.getElementById('giftsReceiveList');
          res.receivedGiftsCount = receivedList ? receivedList.children.length : 0;
          
          // Check privacy: Sender ID should NOT be visible in text
          const cardText = receivedList ? receivedList.innerText : '';
          res.senderHidden = !cardText.includes('secret_sender_888');

          // Click Claim
          const claimBtn = receivedList?.querySelector('.btn-claim-gift');
          res.hasClaimBtn = !!claimBtn;
          if (claimBtn) {
            claimBtn.click();
            await new Promise(r => setTimeout(r, 600));
          }

          // Check booster balance increased
          res.hintsAfterClaim = testUser.hints; // Should be 3 + 1 = 4
          
          // Check pulsing cleared
          res.adBtnPulsingAfterClaim = adBonusBtn.classList.contains('has-pending-gift');

          // Switch to Send subnav
          const sendSubnav = document.getElementById('giftsSubnavSendBtn');
          sendSubnav.click();
          await new Promise(r => setTimeout(r, 300));

          // Check player list rendering
          const playersList = document.getElementById('giftsPlayersList');
          res.hasPlayersList = !!playersList;

          // If players list has a player, select first player, otherwise mock one and select
          let playerRow = playersList.querySelector('.gift-player-row');
          if (!playerRow) {
            // Render a player item into list
            const row = document.createElement('div');
            row.className = 'gift-player-row';
            row.innerHTML = '<strong>Игрок 1</strong>';
            playersList.appendChild(row);
            playerRow = row;
          }

          // Trigger click on first player row if available
          if (playersList.children.length > 0) {
            playersList.children[0].click();
          }
          await new Promise(r => setTimeout(r, 400));

          const stepRecipient = document.getElementById('giftsStepRecipient');
          const stepItem = document.getElementById('giftsStepItem');
          res.stepRecipientHidden = stepRecipient.classList.contains('hidden');
          res.stepItemVisible = !stepItem.classList.contains('hidden');

          // Check balance displays in Send view: hints should be 4, extraBottles 0
          const balHints = document.getElementById('giftBalHints')?.textContent;
          const balBottles = document.getElementById('giftBalBottles')?.textContent;
          res.displayedBalHints = balHints;
          res.displayedBalBottles = balBottles;

          // Test sending extraBottles (balance is 0) -> Should fail without decrementing
          const sendBottleBtn = document.querySelector('.gift-send-btn[data-gift-type="extraBottles"]');
          if (sendBottleBtn) sendBottleBtn.click();
          await new Promise(r => setTimeout(r, 200));
          res.bottlesAfterFailedSend = testUser.extraBottles;

          // Test sending hints (balance is 4) -> Should decrement to 3
          const sendHintBtn = document.querySelector('.gift-send-btn[data-gift-type="hints"]');
          if (sendHintBtn) sendHintBtn.click();
          await new Promise(r => setTimeout(r, 600));
          res.hintsAfterSend = testUser.hints;

          return res;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('GIFTS FLOW RESULT:', JSON.stringify(flowResult, null, 2));

    ws.close();
  } catch (err) {
    console.error('Flow test error:', err);
  } finally {
    edge.kill();
    server.close();
    process.exit(0);
  }
});
