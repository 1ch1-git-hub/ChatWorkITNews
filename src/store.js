import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const storePath = join(dataDir, 'store.json');

function ensureDataDir() {
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (_) {}
}

const DEFAULT_SCHEDULES = [
  { day_of_week: 1, hour: 9, minute: 0, name: '月曜：リーダーシップ' },
  { day_of_week: 2, hour: 9, minute: 0, name: '火曜：サイバー攻撃・セキュリティ' },
  { day_of_week: 3, hour: 9, minute: 0, name: '水曜：組織・チーム' },
  { day_of_week: 4, hour: 9, minute: 0, name: '木曜：AI・技術トレンド' },
  { day_of_week: 5, hour: 9, minute: 0, name: '金曜：生産性・働き方' },
];

const GENRES = [
  '技術・AI',
  'セキュリティ',
  'マネジメント・組織',
  '働き方・生産性',
  'キャリア・スキル',
  '業界・トレンド',
  'その他',
];

const DEFAULT_KEYWORDS_BY_GENRE = {
  '技術・AI': [
    'AI', '人工知能', '機械学習', 'ディープラーニング', '生成AI', 'ChatGPT', 'LLM',
    'クラウド', 'AWS', 'GCP', 'Azure', 'DX', 'デジタル変革', 'プログラミング', '開発',
    'インフラ', 'データベース', 'API', 'オープンソース', 'フロントエンド', 'バックエンド',
    'DevOps', 'コンテナ', 'Kubernetes', 'マイクロサービス', 'IoT', '5G', 'エッジコンピューティング',
    'ブロックチェーン', 'Web3', 'RPA', 'ノーコード', 'ローコード',
  ],
  'セキュリティ': [
    'サイバー攻撃', 'セキュリティ', '情報漏洩', 'ランサムウェア', 'マルウェア', '脆弱性',
    '認証', '多要素認証', 'ゼロトラスト', 'ファイアウォール', '暗号化', '脅威',
    'インシデント対応', 'セキュリティ対策', '標的型攻撃', 'フィッシング', '不正アクセス',
  ],
  'マネジメント・組織': [
    'リーダーシップ', 'マネジメント', '組織', 'チーム', '組織 チーム', '組織力', 'コミュニケーション',
    '心理的安全性', 'プロジェクトマネジメント', 'アジャイル', 'スクラム', 'カンバン',
    'リモート マネジメント', '1on1', '目標管理', 'KPI', 'OKR', '経営', '意思決定',
  ],
  '働き方・生産性': [
    '生産性', '働き方', '生産性 働き方', 'リモートワーク', 'ハイブリッドワーク', 'テレワーク', '業務効率化',
    'ワークライフバランス', '在宅勤務', 'フレックス', 'ナレッジワーカー', 'タスク管理',
    '時間管理', '自動化', 'ペーパーレス', '会議 効率化', 'ツール 活用',
  ],
  'キャリア・スキル': [
    'エンジニア キャリア', 'スキルアップ', 'プログラミング 学習', 'IT資格', '研修',
    '人材育成', 'テックリード', 'エンジニア 採用', 'OJT', 'メンター', 'リスキリング',
  ],
  '業界・トレンド': [
    'IT業界', 'スタートアップ', 'イノベーション', 'デジタル化', 'テクノロジー トレンド',
    '市場動向', 'ガートナー', 'Forrester', 'ベンダー', 'エコシステム', 'オープンイノベーション',
  ],
  'その他': [
    'ニュース', 'トレンド', 'IT ニュース', 'テクノロジー',
  ],
};

const DEFAULT_EXCLUDE_KEYWORDS = [
  '転職',
  '離職',
  '退職',
  '転職エージェント',
  '転職サイト',
  'スカウト',
  'ヘッドハンティング',
];

function seedDefaultData(data) {
  if (!data.schedules || data.schedules.length > 0) return false;
  if (!data.keywords || data.keywords.length > 0) return false;

  let nextScheduleId = 1;
  let nextKeywordId = 1;

  data.schedules = DEFAULT_SCHEDULES.map((s) => ({
    id: nextScheduleId++,
    day_of_week: s.day_of_week,
    hour: s.hour,
    minute: s.minute,
    name: s.name,
  }));

  const keywordList = [];
  for (const [genre, kws] of Object.entries(DEFAULT_KEYWORDS_BY_GENRE)) {
    for (const kw of kws) {
      keywordList.push({ id: nextKeywordId++, keyword: kw, genre });
    }
  }
  data.keywords = keywordList;

  const kwByText = Object.fromEntries(data.keywords.map((k) => [k.keyword, k.id]));
  const defaultLink = [
    ['リーダーシップ', 1],
    ['マネジメント', 1],
    ['コミュニケーション', 1],
    ['サイバー攻撃', 2],
    ['セキュリティ', 2],
    ['ランサムウェア', 2],
    ['組織 チーム', 3],
    ['チーム', 3],
    ['心理的安全性', 3],
    ['AI', 4],
    ['人工知能', 4],
    ['機械学習', 4],
    ['生産性 働き方', 5],
    ['働き方', 5],
    ['リモートワーク', 5],
  ];
  data.schedule_keywords = [];
  for (const [kwText, scheduleIndex] of defaultLink) {
    const kid = kwByText[kwText];
    if (kid) data.schedule_keywords.push({ schedule_id: data.schedules[scheduleIndex - 1].id, keyword_id: kid });
  }

  if (!data.exclude_keywords || data.exclude_keywords.length === 0) {
    data.exclude_keywords = DEFAULT_EXCLUDE_KEYWORDS.map((kw, i) => ({
      id: i + 1,
      keyword: kw,
    }));
  }
  return true;
}

function load() {
  ensureDataDir();
  let data;
  try {
    const raw = readFileSync(storePath, 'utf-8');
    data = JSON.parse(raw);
  } catch {
    data = {
      schedules: [],
      keywords: [],
      schedule_keywords: [],
      exclude_keywords: [],
      delivery_logs: [],
    };
  }
  if (seedDefaultData(data)) {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  // 既存キーワードに genre がない場合は「その他」を付与
  if (data.keywords && data.keywords.length) {
    let migrated = false;
    for (const k of data.keywords) {
      if (k.genre == null || k.genre === '') {
        k.genre = 'その他';
        migrated = true;
      }
    }
    if (migrated) writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  // 配信メッセージ雛形のデフォルト
  const defaultTemplate = {
    title_format: '📰 {day} キーワード「{keyword}」の内容のニュース',
    delivery_date_label: '配信日時',
    item_order: ['title', 'summary', 'meta', 'url'],
    article_separator: '[hr]',
    empty_message: '該当するニュースがありませんでした。',
  };
  if (!data.message_template || !Array.isArray(data.message_template.item_order)) {
    data.message_template = defaultTemplate;
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  return data;
}

function save(data) {
  ensureDataDir();
  writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

let data = load();

export const store = {
  get schedules() {
    return [...data.schedules];
  },
  get keywords() {
    return [...data.keywords];
  },
  get schedule_keywords() {
    return [...data.schedule_keywords];
  },

  get exclude_keywords() {
    return [...(data.exclude_keywords || [])];
  },

  addExcludeKeyword(k) {
    const keyword = (k.keyword || '').trim();
    if (!keyword) return { lastInsertRowid: 0 };
    const existing = (data.exclude_keywords || []).find((x) => x.keyword === keyword);
    if (existing) return { lastInsertRowid: existing.id };
    const list = data.exclude_keywords || [];
    const id = (list.length ? Math.max(...list.map((x) => x.id)) : 0) + 1;
    list.push({ id, keyword });
    data.exclude_keywords = list;
    save(data);
    return { lastInsertRowid: id };
  },

  deleteExcludeKeyword(id) {
    data.exclude_keywords = (data.exclude_keywords || []).filter((x) => x.id !== +id);
    save(data);
  },

  updateExcludeKeyword(id, keyword) {
    const row = (data.exclude_keywords || []).find((x) => x.id === +id);
    if (!row) return;
    row.keyword = (keyword || '').trim();
    save(data);
  },

  addSchedule(s) {
    const id = (data.schedules.length ? Math.max(...data.schedules.map((x) => x.id)) : 0) + 1;
    const row = {
      id,
      day_of_week: s.day_of_week ?? 1,
      hour: s.hour ?? 9,
      minute: s.minute ?? 0,
      name: s.name || '',
    };
    data.schedules.push(row);
    save(data);
    return { lastInsertRowid: id };
  },

  updateSchedule(id, s) {
    const row = data.schedules.find((x) => x.id === +id);
    if (!row) return;
    if (s.day_of_week != null) row.day_of_week = s.day_of_week;
    if (s.hour != null) row.hour = s.hour;
    if (s.minute != null) row.minute = s.minute;
    if (s.name != null) row.name = s.name;
    save(data);
  },

  deleteSchedule(id) {
    data.schedules = data.schedules.filter((x) => x.id !== +id);
    data.schedule_keywords = data.schedule_keywords.filter((x) => x.schedule_id !== +id);
    save(data);
  },

  addKeyword(k) {
    const existing = data.keywords.find((x) => x.keyword === (k.keyword || '').trim());
    if (existing) throw new Error('Duplicate keyword');
    const id = (data.keywords.length ? Math.max(...data.keywords.map((x) => x.id)) : 0) + 1;
    const genre = (k.genre || 'その他').trim();
    const row = { id, keyword: (k.keyword || '').trim(), genre };
    data.keywords.push(row);
    save(data);
    return { lastInsertRowid: id };
  },

  updateKeyword(id, keyword, genre) {
    const row = data.keywords.find((x) => x.id === +id);
    if (!row) return;
    const val = (keyword || '').trim();
    if (val) {
      const existing = data.keywords.find((x) => x.id !== +id && x.keyword === val);
      if (existing) throw new Error('Duplicate keyword');
      row.keyword = val;
    }
    if (genre !== undefined) row.genre = (genre || 'その他').trim();
    save(data);
  },

  getGenres() {
    const set = new Set(['その他']);
    (data.keywords || []).forEach((k) => set.add(k.genre || 'その他'));
    return GENRES.filter((g) => set.has(g)).concat([...set].filter((g) => !GENRES.includes(g)).sort());
  },

  /** 各曜日のスケジュールをデフォルトのキーワード紐付け（各3つ）に戻す */
  resetScheduleKeywordsToDefault() {
    this.seedDefaultKeywords();
    const defaultLink = [
      ['リーダーシップ', 1], ['マネジメント', 1], ['コミュニケーション', 1],
      ['サイバー攻撃', 2], ['セキュリティ', 2], ['ランサムウェア', 2],
      ['組織 チーム', 3], ['チーム', 3], ['心理的安全性', 3],
      ['AI', 4], ['人工知能', 4], ['機械学習', 4],
      ['生産性 働き方', 5], ['働き方', 5], ['リモートワーク', 5],
    ];
    const kwByText = Object.fromEntries((data.keywords || []).map((k) => [k.keyword, k.id]));
    const sortSchedules = (a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    };
    const top5 = [...(data.schedules || [])].sort(sortSchedules).slice(0, 5);
    const top5Ids = new Set(top5.map((s) => s.id));
    data.schedule_keywords = data.schedule_keywords.filter((sk) => !top5Ids.has(sk.schedule_id));
    for (const [kwText, scheduleIdx] of defaultLink) {
      const kid = kwByText[kwText];
      const s = top5[scheduleIdx - 1];
      if (kid && s) data.schedule_keywords.push({ schedule_id: s.id, keyword_id: kid });
    }
    save(data);
  },

  /** 未登録のデフォルトキーワードを追加（既存のものは上書きしない） */
  seedDefaultKeywords() {
    const existing = new Set((data.keywords || []).map((k) => k.keyword));
    let nextId = data.keywords.length ? Math.max(...data.keywords.map((x) => x.id)) + 1 : 1;
    let added = 0;
    for (const [genre, kws] of Object.entries(DEFAULT_KEYWORDS_BY_GENRE)) {
      for (const kw of kws) {
        if (existing.has(kw)) continue;
        data.keywords.push({ id: nextId++, keyword: kw, genre });
        existing.add(kw);
        added++;
      }
    }
    if (added) save(data);
    return added;
  },

  deleteKeyword(id) {
    data.keywords = data.keywords.filter((x) => x.id !== +id);
    data.schedule_keywords = data.schedule_keywords.filter((x) => x.keyword_id !== +id);
    save(data);
  },

  addScheduleKeyword(scheduleId, keywordId) {
    if (data.schedule_keywords.some((x) => x.schedule_id === +scheduleId && x.keyword_id === +keywordId))
      return;
    data.schedule_keywords.push({ schedule_id: +scheduleId, keyword_id: +keywordId });
    save(data);
  },

  removeScheduleKeyword(scheduleId, keywordId) {
    data.schedule_keywords = data.schedule_keywords.filter(
      (x) => !(x.schedule_id === +scheduleId && x.keyword_id === +keywordId)
    );
    save(data);
  },

  setScheduleKeywords(scheduleId, keywordIds) {
    data.schedule_keywords = data.schedule_keywords.filter((x) => x.schedule_id !== +scheduleId);
    for (const kid of keywordIds) {
      data.schedule_keywords.push({ schedule_id: +scheduleId, keyword_id: +kid });
    }
    save(data);
  },

  getKeywordsByScheduleId(scheduleId) {
    const ids = data.schedule_keywords
      .filter((x) => x.schedule_id === +scheduleId)
      .map((x) => x.keyword_id);
    return data.keywords.filter((k) => ids.includes(k.id));
  },

  getSchedulesAt(dayOfWeek, hour, minute) {
    return data.schedules.filter(
      (s) => s.day_of_week === dayOfWeek && s.hour === hour && s.minute === minute
    );
  },

  addDeliveryLog(scheduleId, keywordId, messageCount) {
    data.delivery_logs.push({
      schedule_id: scheduleId,
      keyword_id: keywordId,
      message_count: messageCount,
    });
    save(data);
  },

  get message_template() {
    return this.getMessageTemplateSync();
  },

  /** 配信時に必ずファイルから雛形を読み直す（保存直後の反映を確実にする） */
  getMessageTemplateSync() {
    const def = {
      title_format: '📰 {day} キーワード「{keyword}」の内容のニュース',
      delivery_date_label: '配信日時',
      item_order: ['title', 'summary', 'meta', 'url'],
      article_separator: '[hr]',
      empty_message: '該当するニュースがありませんでした。',
    };
    try {
      const raw = readFileSync(storePath, 'utf8');
      const d = JSON.parse(raw);
      const t = d.message_template;
      if (!t) return { ...def };
      return {
        title_format: t.title_format ?? def.title_format,
        delivery_date_label: t.delivery_date_label ?? def.delivery_date_label,
        item_order: Array.isArray(t.item_order) && t.item_order.length ? t.item_order : def.item_order,
        article_separator: t.article_separator ?? def.article_separator,
        empty_message: t.empty_message ?? def.empty_message,
      };
    } catch (_) {
      return { ...def };
    }
  },

  setMessageTemplate(template) {
    data.message_template = {
      title_format: template.title_format ?? data.message_template?.title_format,
      delivery_date_label: template.delivery_date_label ?? data.message_template?.delivery_date_label,
      item_order: Array.isArray(template.item_order) ? template.item_order : (data.message_template?.item_order ?? ['title', 'summary', 'meta', 'url']),
      article_separator: template.article_separator ?? data.message_template?.article_separator,
      empty_message: template.empty_message ?? data.message_template?.empty_message,
    };
    save(data);
  },
};
