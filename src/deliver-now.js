import 'dotenv/config';
import { appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import { fetchNewsByKeyword } from './news-fetcher.js';
import { sendMessage, formatNewsMessage } from './chatwork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deliveryLogPath = join(__dirname, '../data/delivery.log');

const CHATWORK_API_TOKEN = (process.env.CHATWORK_API_TOKEN || '').trim();
const CHATWORK_ROOM_ID = (process.env.CHATWORK_ROOM_ID || '').trim();
const NEWS_API_KEY = (process.env.NEWS_API_KEY || '').trim();
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function appendLog(msg) {
  const ts = new Date().toISOString();
  try { appendFileSync(deliveryLogPath, `[${ts}] ${msg}\n`, 'utf8'); } catch (_) {}
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  if (!CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
    console.error('CHATWORK_API_TOKEN / CHATWORK_ROOM_ID が設定されていません');
    process.exit(1);
  }

  // 現在時刻を JST（UTC+9）で取得
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const hour = jst.getUTCHours();
  const minute = jst.getUTCMinutes();

  appendLog(`実行: JST ${DAY_NAMES[day]}曜日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);

  if (day === 0 || day === 6) {
    appendLog('土日のため配信をスキップします');
    process.exit(0);
  }

  const schedules = store.schedules.filter(
    (s) => s.day_of_week === day && s.hour === hour && s.minute === minute
  );

  if (schedules.length === 0) {
    appendLog('この時刻に一致するスケジュールはありません');
    process.exit(0);
  }

  const excludeKeywords = store.exclude_keywords || [];
  const template = store.getMessageTemplateSync();

  for (const s of schedules) {
    const keywords = store.getKeywordsByScheduleId(s.id);
    if (keywords.length === 0) {
      appendLog(`スケジュール「${s.name}」にキーワードがありません`);
      continue;
    }
    appendLog(`配信開始: ${s.name || s.id}`);
    for (const k of keywords) {
      try {
        const articles = await fetchNewsByKeyword(k.keyword, NEWS_API_KEY, 5, excludeKeywords);
        if (articles.length === 0) {
          appendLog(`記事なし: ${k.keyword}`);
          continue;
        }
        const message = formatNewsMessage(k.keyword, articles, template, { day: DAY_NAMES[day] + '曜日' });
        await sendMessage(CHATWORK_ROOM_ID, message, CHATWORK_API_TOKEN);
        appendLog(`配信済み: ${k.keyword}（${articles.length}件）`);
      } catch (e) {
        appendLog(`配信エラー [${k.keyword}]: ${e.message}`);
      }
    }
  }

  appendLog('完了');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
