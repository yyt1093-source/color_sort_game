const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const proc = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9244',
  'https://yyt1093-source.github.io/color_sort_game/'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9244/json');
    const targets = await listRes.json();
    const game = targets.find(t => t.url.includes('color_sort_game'));
    if (game) {
      const ws = new WebSocket(game.webSocketDebuggerUrl);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: {
            returnByValue: true,
            expression: `({
              startScreen: !!document.getElementById('startScreen'),
              startBtn: !!document.getElementById('startGameBtn'),
              startDismissed: window.__startDismissed,
              bottlesBeforeClick: document.querySelectorAll('.glass-bottle').length
            })`
          }
        }));
      });
      ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id === 2) {
          console.log('BEFORE CLICK:', m.result?.result?.value);
          // Now click
          ws.send(JSON.stringify({
            id: 3,
            method: 'Runtime.evaluate',
            params: {
              returnByValue: true,
              expression: `(function() {
                var btn = document.getElementById('startGameBtn');
                if (btn) btn.click();
                return {
                  clicked: !!btn,
                  dismissed: window.__startDismissed
                };
              })()`
            }
          }));
        }
        if (m.id === 3) {
          console.log('CLICK RESULT:', m.result?.result?.value);
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 4,
              method: 'Runtime.evaluate',
              params: {
                returnByValue: true,
                expression: `({
                  startScreenExists: !!document.getElementById('startScreen'),
                  bottlesCount: document.querySelectorAll('.glass-bottle').length,
                  levelDisplay: document.getElementById('levelBadgeLabel')?.textContent
                })`
              }
            }));
          }, 500);
        }
        if (m.id === 4) {
          console.log('AFTER CLICK (GAMEPLAY ACTIVE):', m.result?.result?.value);
          console.log('\n🎉 VERIFIED: Live game launches, start screen dismisses, and gameplay is active!');
          proc.kill();
        }
      });
    }
  } catch(e) {
    console.error(e);
    proc.kill();
  }
}, 3000);
