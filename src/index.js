import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import { fetchNewsByKeyword } from './news-fetcher.js';
import { sendMessage, formatNewsMessage } from './chatwork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deliveryLogPath = join(__dirname, '../data/delivery.log');

function appendDeliveryLog(message) {
  const ts = new Date().toISOString();
  try {
    appendFileSync(deliveryLogPath, `[${ts}] ${message}\n`, 'utf8');
  } catch (_) {}
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CHATWORK_API_TOKEN = (process.env.CHATWORK_API_TOKEN || '').trim();
const CHATWORK_ROOM_ID = (process.env.CHATWORK_ROOM_ID || '').trim();
const NEWS_API_KEY = (process.env.NEWS_API_KEY || '').trim();

// ============ API: スケジュール ============
app.get('/api/schedules', (req, res) => {
  try {
    const rows = store.schedules.sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/schedules', (req, res) => {
  try {
    const { day_of_week, hour, minute, name } = req.body;
    const result = store.addSchedule({ day_of_week, hour, minute, name });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, hour, minute, name } = req.body;
    store.updateSchedule(id, { day_of_week, hour, minute, name });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/schedules/:id', (req, res) => {
  try {
    store.deleteSchedule(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: ジャンル ============
app.get('/api/genres', (req, res) => {
  try {
    res.json(store.getGenres());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/seed-default-keywords', (req, res) => {
  try {
    const added = store.seedDefaultKeywords();
    res.json({ ok: true, added });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reset-default-schedule-keywords', (req, res) => {
  try {
    store.resetScheduleKeywordsToDefault();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ============ API: キーワード ============
app.get('/api/keywords', (req, res) => {
  try {
    let rows = store.keywords.sort((a, b) => (a.keyword || '').localeCompare(b.keyword || ''));
    const genre = req.query.genre;
    if (genre) rows = rows.filter((k) => (k.genre || 'その他') === genre);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/keywords', (req, res) => {
  try {
    const { keyword, genre } = req.body;
    const result = store.addKeyword({ keyword, genre });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/keywords/:id', (req, res) => {
  try {
    const { keyword, genre } = req.body;
    store.updateKeyword(req.params.id, keyword, genre);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/keywords/:id', (req, res) => {
  try {
    store.deleteKeyword(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: スケジュールとキーワードの紐付け ============
app.get('/api/schedules/:id/keywords', (req, res) => {
  try {
    const rows = store.getKeywordsByScheduleId(req.params.id);
    res.json(rows.sort((a, b) => (a.keyword || '').localeCompare(b.keyword || '')));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/schedules/:id/keywords', (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { keyword_id } = req.body;
    store.addScheduleKeyword(scheduleId, keyword_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/schedules/:id/keywords/:kid', (req, res) => {
  try {
    store.removeScheduleKeyword(req.params.id, req.params.kid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/schedules/:id/keywords', (req, res) => {
  try {
    const { keyword_ids } = req.body;
    store.setScheduleKeywords(req.params.id, Array.isArray(keyword_ids) ? keyword_ids : []);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 除外キーワード ============
app.get('/api/exclude-keywords', (req, res) => {
  try {
    const rows = (store.exclude_keywords || []).sort((a, b) => (a.keyword || '').localeCompare(b.keyword || ''));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/exclude-keywords', (req, res) => {
  try {
    const { keyword } = req.body;
    const result = store.addExcludeKeyword({ keyword });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/exclude-keywords/:id', (req, res) => {
  try {
    const { keyword } = req.body;
    store.updateExcludeKeyword(req.params.id, keyword);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/exclude-keywords/:id', (req, res) => {
  try {
    store.deleteExcludeKeyword(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 手動テスト配信 ============
app.post('/api/test-delivery', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
      const msg = 'CHATWORK_API_TOKEN / CHATWORK_ROOM_ID / keyword を確認してください';
      console.error('[test-delivery]', msg);
      appendDeliveryLog(`[test-delivery] ${msg}`);
      return res.status(400).json({ error: msg });
    }
    console.log('[test-delivery] ニュース取得中:', keyword);
    appendDeliveryLog(`[test-delivery] ニュース取得中: ${keyword}`);
    const excludeKeywords = store.exclude_keywords || [];
    const articles = await fetchNewsByKeyword(keyword, NEWS_API_KEY, 5, excludeKeywords);
    console.log('[test-delivery] 取得件数:', articles.length);
    appendDeliveryLog(`[test-delivery] 取得件数: ${articles.length}`);
    const template = store.getMessageTemplateSync();
    const message = formatNewsMessage(keyword, articles, template);
    console.log('[test-delivery] Chatwork送信中...');
    appendDeliveryLog('[test-delivery] Chatwork送信中...');
    await sendMessage(CHATWORK_ROOM_ID, message, CHATWORK_API_TOKEN);
    console.log('[test-delivery] 送信完了');
    appendDeliveryLog(`[test-delivery] 送信完了（${articles.length}件）`);
    res.json({ ok: true, count: articles.length });
  } catch (e) {
    console.error('[test-delivery] エラー:', e.message);
    appendDeliveryLog(`[test-delivery] エラー: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 配信メッセージ雛形 ============
app.get('/api/message-template', (req, res) => {
  try {
    res.json(store.message_template);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/message-template', (req, res) => {
  try {
    const body = req.body || {};
    store.setMessageTemplate({
      title_format: body.title_format,
      delivery_date_label: body.delivery_date_label,
      item_order: body.item_order,
      article_separator: body.article_separator,
      empty_message: body.empty_message,
    });
    res.json(store.message_template);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 送信ログ（ファイル） ============
app.get('/api/delivery-log', (req, res) => {
  try {
    const log = readFileSync(deliveryLogPath, 'utf8');
    res.json({ log });
  } catch (_) {
    res.json({ log: '' });
  }
});

app.post('/api/delivery-log/clear', (req, res) => {
  try {
    writeFileSync(deliveryLogPath, '', 'utf8');
    appendDeliveryLog('（ログをクリアしました）');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 配信ジョブ ============
async function runDelivery(scheduleId, keywords, options) {
  if (!CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
    console.error('環境変数 CHATWORK_* が設定されていません');
    return;
  }

  const excludeKeywords = store.exclude_keywords || [];
  for (const k of keywords) {
    try {
      const articles = await fetchNewsByKeyword(k.keyword, NEWS_API_KEY, 5, excludeKeywords);
      if (articles.length === 0) continue;
      const template = store.getMessageTemplateSync();
      const message = formatNewsMessage(k.keyword, articles, template, options);
      await sendMessage(CHATWORK_ROOM_ID, message, CHATWORK_API_TOKEN);
      store.addDeliveryLog(scheduleId, k.id, articles.length);
      console.log(`配信済み: ${k.keyword}`);
      appendDeliveryLog(`配信済み: ${k.keyword}（${articles.length}件）`);
    } catch (e) {
      console.error(`配信エラー [${k.keyword}]:`, e.message);
      appendDeliveryLog(`配信エラー [${k.keyword}]: ${e.message}`);
    }
  }
}

// ============ スケジューラ（平日のみ） ============
function setupScheduler() {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 毎分チェック: 現在が平日かつ、登録済みスケジュールの時刻と一致したら配信
  cron.schedule('* * * * *', () => {
    const now = new Date();
    const day = now.getDay(); // 0=日, 1=月, ..., 6=土
    if (day === 0 || day === 6) return; // 土日はスキップ

    const hour = now.getHours();
    const minute = now.getMinutes();

    const schedules = store.getSchedulesAt(day, hour, minute);

    for (const s of schedules) {
      const keywords = store.getKeywordsByScheduleId(s.id);

      if (keywords.length > 0) {
        const runMsg = `実行: ${dayNames[day]} ${hour}:${String(minute).padStart(2, '0')} - ${s.name || s.id}`;
        console.log(runMsg);
        appendDeliveryLog(runMsg);
        runDelivery(s.id, keywords, { day: dayNames[s.day_of_week] + '曜日' });
      }
    }
  });

  console.log('スケジューラ起動（平日の登録時刻に配信）');
}

// ============ 起動 ============
setupScheduler();
app.listen(PORT, () => {
  console.log(`API サーバー起動: http://localhost:${PORT}`);
});
