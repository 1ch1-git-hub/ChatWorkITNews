# ChatWork IT News

平日（月〜金）に指定したキーワードでインターネットからニュースを検索し、Chatworkの固定ルームに配信するサービスです。

## 機能

- **管理者画面**: スケジュール（曜日・時刻）とキーワードを設定
- **ニュース検索**: 設定したキーワードでニュースを取得
- **Chatwork連携**: 指定ルームにニュースを配信
- **平日のみ**: 月曜〜金曜の指定時刻に実行

## セットアップ

1. 依存関係のインストール
   ```bash
   npm install
   ```

2. 環境変数の設定（`.env` ファイルを作成）
   ```
   CHATWORK_API_TOKEN=your_chatwork_api_token
   CHATWORK_ROOM_ID=your_room_id
   NEWS_API_KEY=your_newsapi_key  # NewsAPI.org のAPIキー（無料枠あり）
   ```

3. 起動
   ```bash
   # メインサーバー（API + スケジューラ）
   npm start

   # 管理者画面（別ターミナル）
   npm run admin
   ```

## 管理者画面

`http://localhost:3001` で管理者画面にアクセスできます。

- スケジュールの追加・編集・削除（曜日・時刻を指定）
- キーワードの管理
- 紐付け: どのスケジュールでどのキーワードのニュースを配信するか設定
