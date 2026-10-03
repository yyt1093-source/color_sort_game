const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert');

console.log('================================================================');
console.log('🌐 TESTING REAL CHROMIUM / EDGE BROWSER ENGINE STARTUP & ENTRY');
console.log('================================================================\n');

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

server.listen(8095, '127.0.0.1', () => {
  console.log('Test server running at http://127.0.0.1:8095');

  try {
    for (let cycle = 1; cycle <= 10; cycle++) {
      const res = spawnSync(edgePath, [
        '--headless=new',
        '--disable-gpu',
        '--dump-dom',
        'http://127.0.0.1:8095/index.html'
      ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

      const dom = res.stdout || '';

      assert(dom.includes('id="startScreen"'), `Real Edge Cycle ${cycle}: startScreen rendered in DOM`);
      assert(dom.includes('id="startGameBtn"'), `Real Edge Cycle ${cycle}: startGameBtn rendered in DOM`);
      assert(dom.includes('id="splashLoadingBox"'), `Real Edge Cycle ${cycle}: splashLoadingBox rendered in DOM`);
      assert(dom.includes('id="gameBoard"'), `Real Edge Cycle ${cycle}: gameBoard rendered in DOM`);
      assert(dom.includes('glass-bottle'), `Real Edge Cycle ${cycle}: gameBoard bottles rendered in DOM`);

      console.log(`  ✅ [PASS] Real Edge Cycle ${cycle}/10: DOM fully parsed & game board rendered cleanly`);
    }

    console.log('\n================================================================');
    console.log('🎉 REAL BROWSER (EDGE) STARTUP VERIFICATION 100% PASSED!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
});
