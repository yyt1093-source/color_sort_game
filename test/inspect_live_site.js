const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9226',
    'https://yyt1093-source.github.io/color_sort_game/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9226/json');
    const targets = await listRes.json();
    const gameTarget = targets.find(t => t.url.includes('color_sort_game'));
    if (!gameTarget) {
      console.log('No game target found!', targets);
      return;
    }

    const ws = new WebSocket(gameTarget.webSocketDebuggerUrl);

    ws.addEventListener('open', () => {
      console.log('Connected to CDP');
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('EXCEPTION:', JSON.stringify(msg.params, null, 2));
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE LOG:', msg.params.type, msg.params.args?.map(a => a.value || a.description));
      }
      if (msg.id === 10) {
        console.log('EVAL INITIAL (after 1s):', msg.result?.result?.value);
      }
      if (msg.id === 20) {
        console.log('EVAL AFTER 3s:', msg.result?.result?.value);
      }
      if (msg.id === 30) {
        console.log('EVAL AFTER CLICK:', msg.result?.result?.value);
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    ws.send(JSON.stringify({
      id: 10,
      method: 'Runtime.evaluate',
      params: {
        returnByValue: true,
        expression: `({
          startDismissed: window.__startDismissed,
          hasBtn: !!document.getElementById('startGameBtn'),
          btnDisplay: document.getElementById('startGameBtn')?.style.display,
          loadingBoxDisplay: document.getElementById('splashLoadingBox')?.style.display,
          percent: document.getElementById('splashLoadingPercent')?.textContent,
          scrDisplay: document.getElementById('startScreen')?.style.display,
          scrPointerEvents: window.getComputedStyle(document.getElementById('startScreen') || document.body).pointerEvents
        })`
      }
    }));

    await new Promise(r => setTimeout(r, 2000));
    ws.send(JSON.stringify({
      id: 20,
      method: 'Runtime.evaluate',
      params: {
        returnByValue: true,
        expression: `({
          startDismissed: window.__startDismissed,
          btnDisplay: document.getElementById('startGameBtn')?.style.display,
          btnOpacity: document.getElementById('startGameBtn')?.style.opacity,
          btnOffsetWidth: document.getElementById('startGameBtn')?.offsetWidth,
          btnOffsetHeight: document.getElementById('startGameBtn')?.offsetHeight,
          loadingBoxDisplay: document.getElementById('splashLoadingBox')?.style.display,
          percent: document.getElementById('splashLoadingPercent')?.textContent,
          scrDisplay: document.getElementById('startScreen')?.style.display,
          boardChildren: document.getElementById('gameBoard')?.children.length,
          bottles: document.querySelectorAll('.glass-bottle').length
        })`
      }
    }));

    // Now simulate clicking
    await new Promise(r => setTimeout(r, 500));
    ws.send(JSON.stringify({
      id: 30,
      method: 'Runtime.evaluate',
      params: {
        returnByValue: true,
        expression: `(function() {
          const btn = document.getElementById('startGameBtn');
          const scr = document.getElementById('startScreen');
          if (btn) btn.click();
          return {
            clickedBtn: !!btn,
            startDismissedAfterClick: window.__startDismissed,
            scrDisplayAfterClick: scr ? scr.style.display : null,
            scrClass: scr ? scr.className : null
          };
        })()`
      }
    }));

    await new Promise(r => setTimeout(r, 1500));
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    proc.kill();
  }
}

main();
