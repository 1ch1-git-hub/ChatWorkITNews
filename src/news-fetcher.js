import fetch from 'node-fetch';
import Parser from 'rss-parser';

const parser = new Parser();

/** 日本語ニュースサイトのドメイン（URLで判定可能な場合） */
const JP_NEWS_DOMAINS = [
  '.jp',
  'nikkei.com',
  'asahi.com',
  'mainichi.jp',
  'yomiuri.co.jp',
  'sankei.com',
  'jiji.com',
  'nhk.or.jp',
  'yahoo.co.jp',
  'itmedia.co.jp',
  'impress.co.jp',
  'bloomberg.co.jp',
  'reuters.co.jp',
  'gigazine.net',
];

/** ひらがな・カタカナ（日本語に特有。中国語にはほぼ使われない） */
const JP_HIRAGANA_KATAKANA = /[\u3040-\u309f\u30a0-\u30ff]/;

/** 中国語・台湾・香港サイトのドメイン（除外） */
const ZH_EXCLUDE_PATTERNS = [
  /\.cn\b/,
  /\.tw\b/,
  /\.hk\b/,
  /\b(tw|hk|cn|zh)\./, // tw.yahoo.com, hk.yahoo.com
  /36kr\.com/,
  /baidu\.com/,
  /qq\.com/,
  /sina\.com/,
  /sohu\.com/,
  /weibo\.com/,
];

function isJapaneseSite(url) {
  if (!url) return false;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (ZH_EXCLUDE_PATTERNS.some((p) => p.test(host))) return false;
  return JP_NEWS_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

function isChineseDomain(url) {
  if (!url) return false;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ZH_EXCLUDE_PATTERNS.some((p) => p.test(host));
}

/** タイトルが日本語か（ひらがな・カタカナを含む＝中国語を除外） */
function hasJapaneseInTitle(title) {
  return JP_HIRAGANA_KATAKANA.test(title || '');
}

/** テキストを正規化（trim・連続空白を1つに・記号の差を吸収）して比較用に使う */
function normalizeForCompare(text) {
  return (text || '')
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/\s*[-–—|｜]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** タイトル先頭の【N】を除去して比較用のコア文字列にする */
function titleCoreForCompare(title) {
  return normalizeForCompare((title || '').replace(/^【\d+】\s*/, ''));
}

/** 概要がタイトルと実質同じか（重複表示を避ける） */
function descriptionSameAsTitle(description, title) {
  const d = normalizeForCompare(description);
  const t = titleCoreForCompare(title);
  if (!d || !t) return true;
  if (d === t) return true;
  const diff = Math.abs(d.length - t.length);
  if (diff <= 80 && (d.startsWith(t) || t.startsWith(d))) return true;
  if (diff <= 80 && (d.includes(t) || t.includes(d))) return true;
  return false;
}

/** 2ch系・掲示板メタデータを概要の先頭から除去 */
function cleanDescriptionMeta(description) {
  if (!description || !description.trim()) return '';
  let s = description.trim();
  // 例: "1名前: ぐれ★:2026/02/25(水) 10:09:10.16 ID:6ko4k9189.net 本文..."
  const meta = s.match(/^\d+名前:.*?\.(net|com|org)\s+/);
  if (meta) s = s.slice(meta[0].length).trim();
  return s;
}

/** 記事の description をクリーニング。タイトルと同一なら空にする */
function sanitizeDescription(description, title) {
  let d = cleanDescriptionMeta(description || '');
  d = d.trim().replace(/\s+/g, ' ');
  if (descriptionSameAsTitle(d, title)) return '';
  return d;
}

/** 除外キーワードに該当する記事を除外（タイトル・description に含まれる場合） */
function filterExcluded(articles, excludeKeywords) {
  if (!excludeKeywords || excludeKeywords.length === 0) return articles;
  const keys = excludeKeywords.map((k) => (typeof k === 'string' ? k : k.keyword || '').trim()).filter(Boolean);
  if (keys.length === 0) return articles;
  return articles.filter((a) => {
    const text = `${a.title || ''} ${a.description || ''}`;
    return !keys.some((k) => text.includes(k));
  });
}

/** 日本語コンテンツのみに絞る（ひらがな・カタカナを含み、中国語ドメインを除外） */
function filterJapaneseOnly(articles, limit) {
  const filtered = articles.filter((a) => {
    if (isChineseDomain(a.url)) return false;
    return isJapaneseSite(a.url) || hasJapaneseInTitle(a.title);
  });
  return filtered.slice(0, limit);
}

const NEWS_API_BASE = 'https://newsapi.org/v2';

/**
 * NewsAPI.org でキーワードに基づいてニュースを検索（APIキーが必要）
 */
async function fetchFromNewsAPI(keyword, apiKey, limit, excludeKeywords = []) {
  const pageSize = Math.min(50, Math.max(limit * 3, 15)); // 日本語フィルタ用に多めに取得
  const url = `${NEWS_API_BASE}/everything?q=${encodeURIComponent(keyword)}&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'ok') {
    throw new Error(data.message || 'ニュース取得に失敗しました');
  }

  const articles = (data.articles || []).map((a) => {
    const title = a.title || '';
    const desc = sanitizeDescription(a.description || '', title);
    return {
      title,
      url: a.url,
      source: a.source?.name || '',
      publishedAt: a.publishedAt,
      description: desc,
    };
  });
  const filtered = filterJapaneseOnly(articles, limit * 3);
  return filterExcluded(filtered, excludeKeywords).slice(0, limit);
}

/**
 * Google News RSS でキーワード検索（APIキー不要・無料）
 */
async function fetchFromGoogleNewsRSS(keyword, limit, excludeKeywords = []) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;
  const res = await fetch(url);
  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const raw = (feed.items || []).slice(0, 50).map((item) => {
      const title = item.title || '';
      let rawDesc = item.contentSnippet || '';
      if (!rawDesc && item.content) {
        const c = item.content;
        rawDesc = typeof c === 'string' ? c : (c && c.replace && c.replace(/<[^>]+>/g, ' ')) || '';
      }
      const desc = sanitizeDescription(rawDesc, title);
      return {
        title,
        url: item.link || item.guid || item.url || '',
        source: item.creator || item['dc:creator'] || '',
        publishedAt: item.pubDate || '',
        description: desc,
      };
    })
    .filter((a) => a.url);
  // Google News RSS のリンクは news.google.com リダイレクトのため、URL判定は不可。タイトルにひらがな・カタカナを含む記事のみ（中国語を除外）
  let articles = raw.filter((a) => hasJapaneseInTitle(a.title));
  articles = filterExcluded(articles, excludeKeywords);
  return articles.slice(0, limit);
}

/**
 * キーワードでニュースを検索（NewsAPI優先、0件ならGoogle Newsにフォールバック）
 * @param {string} keyword - 検索キーワード
 * @param {string} apiKey - NewsAPI.org のAPIキー（空の場合はGoogle Newsのみ使用）
 * @param {number} limit - 取得件数（デフォルト5）
 * @param {Array} excludeKeywords - 除外キーワード（タイトル・descriptionに含まれる記事を除外）
 */
export async function fetchNewsByKeyword(keyword, apiKey, limit = 5, excludeKeywords = []) {
  const exclude = Array.isArray(excludeKeywords) ? excludeKeywords : [];
  if (apiKey && apiKey.trim()) {
    try {
      const articles = await fetchFromNewsAPI(keyword, apiKey.trim(), limit, exclude);
      if (articles.length > 0) return articles;
    } catch (e) {
      console.warn('[news-fetcher] NewsAPI失敗、Google Newsにフォールバック:', e.message);
    }
  }

  return fetchFromGoogleNewsRSS(keyword, limit, exclude);
}
