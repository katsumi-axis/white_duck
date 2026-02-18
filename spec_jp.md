# White Duck - DuckDB Webインターフェース & APIサーバー

## 概要

White Duckは、セルフホスト型のDuckDBインターフェースであり、以下の機能を提供します：
- RedashライクなWeb UI（クエリ実行・可視化）
- HTTP API経由での外部SQLアクセス（MotherDuckライク）
- Dockerベースのデプロイメント

## 目標

1. DuckDB操作のための直感的なWebインターフェースを提供
2. 外部アプリケーションからのHTTP API経由でのSQLクエリ実行を可能にする
3. クエリ履歴・保存クエリによる協調的なデータ分析をサポート
4. Dockerによる簡単なデプロイを実現

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Dockerコンテナ                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Web UI (Frontend)                 │    │
│  │         React + TanStack Query/Table/Router         │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │ HTTP/WebSocket                    │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │                   API Server                         │    │
│  │                  (Bun / TypeScript)                  │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │                     DuckDB                           │    │
│  │              (インメモリ / ファイルベース)            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 機能

### 1. クエリエディタ
- シンタックスハイライト付きSQLエディタ（Monaco Editor）
- DuckDB関数のオートコンプリート
- クエリ履歴
- キーボードショートカット（Ctrl+Enterで実行）
- 複数のクエリタブ

### 2. 結果表示
- ページネーション付きテーブル表示（TanStack Table）
- カラムのソート・フィルタリング
- CSV/JSON/Parquetへのエクスポート
- データ可視化（チャート）

### 3. スキーマエクスプローラ
- データベース、スキーマ、テーブル、ビューの一覧
- 型情報付きカラム情報
- サンプルデータのプレビュー
- テーブル/カラム名のエディタへのクイック挿入

### 4. 保存済みクエリ
- クエリの保存・整理
- タグ/カテゴリによる整理
- URL経由でのクエリ共有

### 5. HTTP API
外部アクセス用のRESTful API：

```
POST /api/query
  Body: { "sql": "SELECT * FROM table" }
  Response: { "columns": [...], "data": [...] }

GET /api/schemas
  Response: { "schemas": [...] }

GET /api/tables/:schema
  Response: { "tables": [...] }

POST /api/upload
  CSV/JSON/Parquetファイルをアップロードしてテーブルを作成
```

### 6. 認証（オプション）
- HTTP API向けAPIキー認証
- Web UI向け基本認証またはOAuth（設定可能）

---

## 技術スタック

### バックエンド
- **言語**: Bun（TypeScriptネイティブ）
- **DuckDB**: duckdb-async または duckdb-node を使用
- **API**: RESTful JSON API
- **認証**: Web UIはJWT、HTTP APIはAPIキー

### フロントエンド
- **フレームワーク**: React 18+
- **ルーティング**: TanStack Router
- **データフェッチング**: TanStack Query
- **テーブル**: TanStack Table
- **スタイリング**: Tailwind CSS
- **エディタ**: Monaco Editor
- **チャート**: Recharts または Tremor

### デプロイメント
- **コンテナ**: Docker + docker-compose
- **シングルバイナリオプション**: Goバックエンドの場合

---

## 設定

環境変数：

```bash
# サーバー
PORT=3000
HOST=0.0.0.0

# DuckDB
DUCKDB_MODE=file          # file または memory
DUCKDB_PATH=/data/db.duckdb

# 認証
AUTH_ENABLED=true
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key

# デフォルトユーザー（初回セットアップ用）
DEFAULT_USER=admin
DEFAULT_PASSWORD=admin123

# アップロード
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_SIZE=100MB
```

---

## API仕様

### クエリ実行
```
POST /api/query
Content-Type: application/json
Authorization: Bearer <api_key>  # 認証有効時

リクエスト:
{
  "sql": "SELECT * FROM users LIMIT 10",
  "format": "json"  // json, csv, parquet
}

レスポンス:
{
  "columns": [
    { "name": "id", "type": "INTEGER" },
    { "name": "name", "type": "VARCHAR" }
  ],
  "data": [
    [1, "Alice"],
    [2, "Bob"]
  ],
  "rowCount": 2,
  "executionTime": 0.012
}
```

### スキーマ取得
```
GET /api/schemas

レスポンス:
{
  "schemas": ["main", "information_schema"]
}
```

### テーブル取得
```
GET /api/tables/:schema

レスポンス:
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INTEGER", "nullable": false },
        { "name": "name", "type": "VARCHAR", "nullable": true }
      ],
      "rowCount": 1000
    }
  ]
}
```

### データアップロード
```
POST /api/upload
Content-Type: multipart/form-data

フォームフィールド:
- file: <データファイル>
- table_name: 作成するテーブル名
- format: csv, json, parquet

レスポンス:
{
  "success": true,
  "tableName": "my_data",
  "rowCount": 500
}
```

---

## UIレイアウト

```
┌─────────────────────────────────────────────────────────────┐
│  White Duck                              [Settings] [User]  │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌─────────────────────────────────────────────┤
│ │ スキーマ   │ │ クエリエディタ                  [実行] [保存]│
│ │ ├ main    │ │ ┌─────────────────────────────────────────┐ │
│ │ │ ├ users │ │ │ SELECT * FROM users                     │ │
│ │ │ └orders│ │ │ WHERE created_at > '2024-01-01'         │ │
│ │ └info... │ │ │ LIMIT 100;                              │ │
│ └───────────┘ │ └─────────────────────────────────────────┘ │
│               ├─────────────────────────────────────────────┤
│               │ 結果 (100行, 0.012秒)       [CSV] [JSON]    │
│               │ ┌───────┬───────┬─────────────┐             │
│               │ │ id    │ name  │ created_at  │             │
│               │ ├───────┼───────┼─────────────┤             │
│               │ │ 1     │ Alice │ 2024-01-15  │             │
│               │ │ 2     │ Bob   │ 2024-01-16  │             │
│               │ └───────┴───────┴─────────────┘             │
└───────────────┴─────────────────────────────────────────────┘
```

---

## ディレクトリ構成

```
white_duck/
├── spec.md
├── spec_jp.md
├── docker-compose.yml
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── api/
│   │   │   └── handlers.ts
│   │   ├── db/
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── config/
│   │       └── index.ts
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── Login.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── components/
│   │   │   └── QueryResults.tsx
│   │   ├── hooks/
│   │   └── lib/
│   │       └── api.ts
│   └── public/
└── data/
    └── db.duckdb
```

---

## 実装フェーズ

### フェーズ1: コアバックエンド
- [x] プロジェクト構造のセットアップ
- [x] DuckDB接続の実装
- [x] クエリ実行APIの作成
- [x] スキーマ情報取得の追加

### フェーズ2: 基本フロントエンド
- [x] React + Vite + TanStackのセットアップ
- [x] クエリエディタの実装
- [x] クエリ結果の表示
- [x] スキーマエクスプローラの追加

### フェーズ3: 拡張機能
- [x] クエリ履歴（インメモリ）
- [x] クエリの保存/読み込み
- [x] ファイルアップロード
- [x] 結果のエクスポート

### フェーズ4: Docker & デプロイ
- [x] docker-composeのセットアップ
- [x] ドキュメント作成

### フェーズ5: オプション機能
- [x] 認証（JWT + APIキー）
- [ ] チャート/可視化
- [ ] 複数データベースサポート
- [ ] クエリ履歴の永続化

---

## 決定事項

1. **バックエンド言語**: Bun/TypeScript
2. **データベース永続化**: ファイルベース（インメモリに設定変更可能）
3. **マルチテナンシー**: フル認証付きシングルユーザー（JWT + APIキー）
4. **リアルタイム**: フェーズ1では実装しない

---