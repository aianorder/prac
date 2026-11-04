// Development-only static server, bound to this machine. No dependencies.
'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8'};
http.createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filename = path.resolve(root, relative);
    const parts = path.relative(root, filename).split(path.sep);
    if (!filename.startsWith(root + path.sep) || parts.some(part => part.startsWith('.'))) { res.writeHead(403); res.end('Forbidden'); return; }
    const data = await fs.readFile(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`prac: http://127.0.0.1:${port}`));
