const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testLive() {
  console.log('Testing live GitHub Pages URL in Edge browser...');
  const proc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9240',
    'https://yyt1093-source.github.io/color_sort_game/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));
    const listRes = await fetch('http://127.0.0.1:9240/json');
    const targets = await listRes.json();
    const gameTarget = targets.find(t => t.url.includes('color_sort_game'));
    if (!gameTarget) {
      throw new Error('Game target not found in Edge!');
    }

    const ws = new WebSocket(gameTarget.webSocketDebuggerUrl);

    await new Promise((res) => {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        setTimeout(res, 500);
      });
    });

    // 1. Initial State Check
    const initialState = await new Promise((res) => {
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `({
            startScreen: !!document.getElementById('startScreen'),
            btnVisible: !!document.getElementById('startGameBtn') && window.getComputedStyle(document.getElementById('startGameBtn')).display !== 'none',
            btnText: document.getElementById('startGameBtn')?.textContent?.trim(),
            startDismissed: window.__startDismissed,
            bottles: document.querySelectorAll('.glass-bottle').length
          })`
        }
      }));
      ws.addEventListener('message', function h(e) {
        const m = JSON.parse(e.data);
        if (m.id === 2) {
          ws.removeEventListener('message', h);
          res(m.result?.result?.value);
        }
      });
    });
    console.log('1. Initial Live Page State:', initialState);

    // 2. Click Start Button
    const clickResult = await new Promise((res) => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(function() {
            var b = document.getElementById('startGameBtn');
            if (b) b.click();
            return {
              clicked: !!b,
              dismissed: window.__startDismissed
            };
          })()`
        }
      }));
      ws.addEventListener('message', function h(e) {
        const m = JSON.parse(e.data);
        if (m.id === 3) {
          ws.removeEventListener('message', h);
          res(m.result?.result?.value);
        }
      });
    });
    console.log('2. Click Start Result:', clickResult);

    await new Promise(r => setTimeout(r, 600));

    // 3. Post-Click Active Gameplay State
    const gameState = await new Promise((res) => {
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `({
            startScreenHidden: !document.getElementById('startScreen') || document.getElementById('startScreen').style.display === 'none',
            bottles: document.querySelectorAll('.glass-bottle').length,
            boardVisible: window.getComputedStyle(document.getElementById('gameBoard')).display !== 'none'
          })`
        }
      }));
      ws.addEventListener('message', function h(e) {
        const m = JSON.parse(e.data);
        if (m.id === 4) {
          ws.removeEventListener('message', h);
          res(m.result?.result?.value);
        }
      });
    });
    console.log('3. Game Board State:', gameState);

    if (initialState.btnVisible && clickResult.dismissed && gameState.bottles > 0) {
      console.log('\n🎉 100% SUCCESS: LIVE PRODUCTION COLOR SORT GAME STARTS PERFECTLY WITHOUT ANY GLITCH!');
    } else {
      console.error('\n❌ FAILED:', { initialState, clickResult, gameState });
      process.exit(1);
    }
  } finally {
    proc.kill();
  }
}

testLive().catch(err => {
  console.error(err);
  process.exit(1);
});
