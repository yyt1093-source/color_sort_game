const { spawn } = require('child_process');

async function testLive() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9236',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const list = await (await fetch('http://127.0.0.1:9236/json/list')).json();
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

    const consoleLogs = [];
    const errors = [];
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        consoleLogs.push({ type: d.params.type, text });
      }
      if (d.method === 'Runtime.exceptionThrown') {
        errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || ''));
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('Navigating to LIVE site...');
    await send('Page.navigate', { url: 'https://yyt1093-source.github.io/color_sort_game/?cb=' + Date.now() });

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

    console.log('Page loaded! Waiting for scripts to initialize...');
    await new Promise(r => setTimeout(r, 3000));

    // Test DOM and interactions on live site
    const liveTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = {};
          
          // 1. Check elements existence
          const adBtn = document.getElementById('adBonusBtn');
          const adModal = document.getElementById('adModal');
          const giftsTab = document.getElementById('adTabGiftsBtn');
          const adsTab = document.getElementById('adTabAdsBtn');
          const giftsContent = document.getElementById('adModalGiftsContent');
          const adsContent = document.getElementById('adModalAdsContent');

          res.hasAdBtn = !!adBtn;
          res.hasAdModal = !!adModal;
          res.hasGiftsTab = !!giftsTab;
          res.hasAdsTab = !!adsTab;
          res.hasGiftsModule = !!window.GiftsModule;

          // 2. Click ad button
          adBtn.click();
          await new Promise(r => setTimeout(r, 400));
          res.adModalVisible = !adModal.classList.contains('hidden');

          // 3. Click gifts tab
          giftsTab.click();
          await new Promise(r => setTimeout(r, 400));
          res.giftsTabActive = giftsTab.classList.contains('active');
          res.giftsContentVisible = !giftsContent.classList.contains('hidden');
          res.adsContentHidden = adsContent.classList.contains('hidden');

          // 4. Click ads tab
          adsTab.click();
          await new Promise(r => setTimeout(r, 400));
          res.adsTabActive = adsTab.classList.contains('active');
          res.adsContentVisible = !adsContent.classList.contains('hidden');
          res.giftsContentHidden = giftsContent.classList.contains('hidden');

          // 5. Click back to gifts tab and check subnav
          giftsTab.click();
          await new Promise(r => setTimeout(r, 400));
          const sendSubnav = document.getElementById('giftsSubnavSendBtn');
          const receiveSubnav = document.getElementById('giftsSubnavReceiveBtn');
          const sendView = document.getElementById('giftsSendView');
          const receiveView = document.getElementById('giftsReceiveView');

          sendSubnav.click();
          await new Promise(r => setTimeout(r, 400));
          res.sendViewVisible = !sendView.classList.contains('hidden');
          res.receiveViewHidden = receiveView.classList.contains('hidden');

          receiveSubnav.click();
          await new Promise(r => setTimeout(r, 400));
          res.receiveViewVisible = !receiveView.classList.contains('hidden');
          res.sendViewHidden = sendView.classList.contains('hidden');

          return res;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('LIVE TEST RESULT:', JSON.stringify(liveTest, null, 2));
    console.log('RUNTIME ERRORS ON LIVE:', errors);

    ws.close();
  } catch (e) {
    console.error('Test error:', e);
  } finally {
    edge.kill();
    process.exit(0);
  }
}

testLive();
