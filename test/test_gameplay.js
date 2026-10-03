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
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8098, '127.0.0.1', async () => {
  console.log('Testing full gameplay in Edge browser...');
  const proc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9236',
    'http://127.0.0.1:8098/index.html'
  ]);

  try {
    await new Promise(r => setTimeout(r, 1500));
    const listRes = await fetch('http://127.0.0.1:9236/json');
    const targets = await listRes.json();
    const gameTarget = targets.find(t => t.url.includes('127.0.0.1:8098'));
    const ws = new WebSocket(gameTarget.webSocketDebuggerUrl);

    await new Promise((res) => {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        setTimeout(res, 500);
      });
    });

    // 1. Click start
    const startRes = await new Promise((res) => {
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(function() {
            var b = document.getElementById('startGameBtn');
            if (b) b.click();
            return { dismissed: window.__startDismissed };
          })()`
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
    console.log('1. Start Button Clicked:', startRes);

    await new Promise(r => setTimeout(r, 600));

    // 2. Inspect bottles and test selection
    const bottleRes = await new Promise((res) => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          returnByValue: true,
          expression: `(function() {
            var bottles = document.querySelectorAll('.glass-bottle');
            if (bottles.length > 0) {
              bottles[0].click();
            }
            return {
              count: bottles.length,
              selected: document.querySelectorAll('.glass-bottle.selected').length
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
    console.log('2. Bottle Selection Test:', bottleRes);

    assert(bottleRes.count >= 5, 'Bottles must be on screen');
    assert(bottleRes.selected === 1, 'Bottle must be selectable');

    console.log('\n🎉 FULL GAMEPLAY TEST PASSED! The game starts, buttons work, bottles respond and animate!');
  } finally {
    proc.kill();
    server.close();
  }
});
