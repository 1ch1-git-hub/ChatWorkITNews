import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ADMIN_PORT || 3001;
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const app = express();
app.use(express.json());

// /api/* をメインAPIサーバーへプロキシ（送信ログなど同一オリジンで取得）
app.use('/api', async (req, res) => {
  try {
    const url = API_BASE + req.originalUrl;
    const opts = { method: req.method, headers: { 'Content-Type': 'application/json' } };
    if (req.method !== 'GET' && req.body !== undefined) opts.body = JSON.stringify(req.body);
    const r = await fetch(url, opts);
    const text = await r.text();
    res.status(r.status).set('Content-Type', r.headers.get('Content-Type') || 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: 'APIサーバーに接続できません。npm start で起動していますか？' });
  }
});

app.use(express.static(join(__dirname, 'admin')));

app.get('/', (req, res) => {
  const html = readFileSync(join(__dirname, 'admin/index.html'), 'utf-8');
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`管理者画面: http://localhost:${PORT}`);
});
