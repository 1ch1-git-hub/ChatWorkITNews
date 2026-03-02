import fetch from 'node-fetch';

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

/**
 * Chatworkルームにメッセージを送信
 * @param {string} roomId - ルームID
 * @param {string} message - 送信するメッセージ
 * @param {string} apiToken - Chatwork API トークン
 * @returns {Promise<{message_id: string}>}
 */
export async function sendMessage(roomId, message, apiToken) {
  const url = `${CHATWORK_API_BASE}/rooms/${roomId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-ChatWorkToken': apiToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ body: message }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chatwork送信エラー: ${res.status} ${err}`);
  }

  return res.json();
}

/**
 * 日付を YYYY/MM/DD 形式に整形
 */
function formatDate(publishedAt) {
  if (!publishedAt) return '';
  const d = new Date(publishedAt);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

const DEFAULT_TEMPLATE = {
  title_format: '📰 {day} キーワード「{keyword}」の内容のニュース',
  delivery_date_label: '配信日時',
  item_order: ['title', 'summary', 'meta', 'url'],
  article_separator: '[hr]',
  empty_message: '該当するニュースがありませんでした。',
};

/**
 * ニュース一覧をChatwork用のメッセージ形式に整形（雛形対応）
 * @param {string} keyword - キーワード
 * @param {Array} articles - 記事配列
 * @param {Object} [template] - 雛形（未指定時はデフォルト）
 * @param {Object} [options] - { day: '月曜日' } など（スケジュール配信時は曜日が入る）
 */
export function formatNewsMessage(keyword, articles, template, options) {
  const t = template && typeof template === 'object' ? { ...DEFAULT_TEMPLATE, ...template } : DEFAULT_TEMPLATE;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dayLabel = (options && options.day) ? options.day + ' ' : '';
  let titleStr = (t.title_format || DEFAULT_TEMPLATE.title_format).replace(/\{day\}\s*/g, dayLabel).replace(/\{keyword\}/g, keyword);
  titleStr = titleStr.replace(/\s{2,}/g, ' ').trim();
  const dateLabel = t.delivery_date_label || DEFAULT_TEMPLATE.delivery_date_label;
  const sep = t.article_separator || '[hr]';

  if (articles.length === 0) {
    return `[info][title]${titleStr}[/title]
${dateLabel}: ${dateStr}
${sep}
${t.empty_message || DEFAULT_TEMPLATE.empty_message}[/info]`;
  }

  const order = Array.isArray(t.item_order) && t.item_order.length ? t.item_order : DEFAULT_TEMPLATE.item_order;

  function norm(s) {
    return (s || '').trim().replace(/\s*[-–—|｜]\s*/g, ' ').replace(/\s+/g, ' ');
  }
  const items = articles.map((a, i) => {
    const date = formatDate(a.publishedAt);
    const source = a.source ? ` | ${a.source}` : '';
    const meta = date ? `📅 ${date}${source}` : (a.source ? `📰 ${a.source}` : '');
    let summary = (a.description && a.description.trim())
      ? a.description.trim().replace(/\s+/g, ' ').slice(0, 200) + (a.description.trim().length > 200 ? '...' : '')
      : '';
    const titleNorm = norm((a.title || '').replace(/^【\d+】\s*/, ''));
    const summaryNorm = norm(summary);
    const lenDiff = Math.abs((summaryNorm || '').length - (titleNorm || '').length);
    const sameOrSuffix = summaryNorm === titleNorm || (lenDiff <= 80 && (summaryNorm.startsWith(titleNorm) || titleNorm.startsWith(summaryNorm)));
    if (summaryNorm && titleNorm && sameOrSuffix) summary = '';
    const parts = {
      title: `【${i + 1}】${a.title}`,
      summary: summary ? `　${summary}` : '',
      meta,
      url: `🔗 ${a.url}`,
    };
    const lines = order
      .map((key) => parts[key])
      .filter(Boolean);
    return lines.join('\n');
  });

  const body = [
    `${dateLabel}: ${dateStr}`,
    sep,
    items.join(`\n${sep}\n`),
  ].join('\n');

  return `[info][title]${titleStr}[/title]
${body}
[/info]`;
}
