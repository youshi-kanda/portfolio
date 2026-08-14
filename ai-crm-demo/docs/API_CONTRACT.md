# API_CONTRACT

## strategy-goals API 追加契約

戦略目的整理機能では、店舗が今月・今期に優先すべき売上改善目的を扱うため、以下のAPIを `/api/v1/` 配下に追加する。

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/strategy-goals` | 戦略目的一覧取得 |
| POST | `/api/v1/stores/{store_id}/strategy-goals` | 戦略目的作成 |
| GET | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}` | 戦略目的詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}` | 戦略目的更新 |
| POST | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/approve` | 戦略目的承認 |
| GET | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/actions` | 推奨施策候補取得 |
| POST | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/actions` | 推奨施策候補追加 |
| POST | `/api/v1/stores/{store_id}/ai/strategy-goals/suggest` | 戦略目的整理AI実行 |

## レスポンスに含める主な情報

- 目的
- 根拠
- 信頼度
- 注意点
- 不足データ
- KPI候補
- 対象顧客候補
- 推奨チャネル
- 推奨施策候補
- 人間承認ステータス

## Phase1制約

Phase1では、ダッシュボードの「今月の重点目的カード」に必要な取得・提案表示に留める。詳細なKPI目標管理、施策連携、月次レポート反映、LINE API連携、Lステップ連携、自動配信はPhase2以降とする。

顧客向け発信へ展開する場合は、既存の承認APIによる人間承認を必須とする。
