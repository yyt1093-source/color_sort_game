const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');

const publicDir = path.join(__dirname, '../public');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(publicDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'text/plain',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function runSingleCycle(cycleNum, port, cdpPort) {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `http://127.0.0.1:${port}/index.html`
  ]);

  try {
    await new Promise(r => setTimeout(r, 1200));
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const targets = await listRes.json();
    const gameTarget = targets.find(t => t.url.includes(`127.0.0.1:${port}`));
    assert(gameTarget, `Cycle ${cycleNum}: game target found in browser`);

    const ws = new WebSocket(gameTarget.webSocketDebuggerUrl);

    let state = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);

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
              btnDisplay: window.getComputedStyle(document.getElementById('startGameBtn') || document.body).display,
              bottles: document.querySelectorAll('.glass-bottle').length
            })`
          }
        }));
      });

      ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === 2) {
          clearTimeout(timeout);
          resolve(msg.result?.result?.value);
        }
      });
    });

    assert(state.startScreen, `Cycle ${cycleNum}: startScreen exists`);
    assert(state.startBtn, `Cycle ${cycleNum}: startBtn exists`);
    assert(state.btnDisplay !== 'none', `Cycle ${cycleNum}: startBtn is visible immediately`);

    // Now click start button
    const clickResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Click timeout')), 5000);
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(function() {
            const btn = document.getElementById('startGameBtn');
            if (btn) btn.click();
            return {
              dismissed: window.__startDismissed,
              scrClass: document.getElementById('startScreen')?.className
            };
          })()`
        }
      }));
      ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === 3) {
          clearTimeout(timeout);
          resolve(msg.result?.result?.value);
        }
      });
    });

    assert(clickResult.dismissed, `Cycle ${cycleNum}: startScreen dismissed on click`);

    // Wait for transition and verify bottles
    await new Promise(r => setTimeout(r, 400));

    const finalState = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Final state timeout')), 5000);
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `({
            startScreenExists: !!document.getElementById('startScreen'),
            scrDisplay: document.getElementById('startScreen')?.style.display,
            bottles: document.querySelectorAll('.glass-bottle').length,
            level: document.getElementById('levelBadgeLabel')?.textContent
          })`
        }
      }));
      ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === 4) {
          clearTimeout(timeout);
          resolve(msg.result?.result?.value);
        }
      });
    });

    assert(!finalState.startScreenExists || finalState.scrDisplay === 'none', `Cycle ${cycleNum}: start screen removed or hidden`);
    assert(finalState.bottles > 0, `Cycle ${cycleNum}: game bottles are rendered on board`);
    console.log(`  ✅ [PASS] Cycle ${cycleNum}: Immediate START button visible, clicked, dismissed cleanly, ${finalState.bottles} bottles active.`);
  } finally {
    proc.kill();
  }
}

server.listen(8096, '127.0.0.1', async () => {
  console.log('Testing v1.0.4 startup in real Edge browser across 5 cycles...\n');
  try {
    for (let i = 1; i <= 5; i++) {
      await runSingleCycle(i, 8096, 9227 + i);
    }
    console.log('\n🎉 ALL CYCLES PASSED! v1.0.4 IS 100% OPERATIONAL IN REAL CHROMIUM BROWSER!\n');
  } catch (e) {
    console.error('❌ Cycle test error:', e);
    process.exit(1);
  } finally {
    server.close();
  }
});
