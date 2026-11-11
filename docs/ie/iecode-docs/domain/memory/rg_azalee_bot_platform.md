# Azalée & Rose Griffon Platform Architecture — Bot & Community Guide

## 概要 (Overview)

Azalée (Azalee) は、Rose Griffon (rg) コミュニティのために開発された次世代 Discord ボットおよび総合プラットフォーム。Inazuma Eleven（イナズマイレブン）および Level-5 作品の膨大なデータを管理し、プレイヤーにリアルタイムの戦術情報を提供する。

## 主要機能 (Core Features)

- **用語集・選手検索 (/glossary, /joueur):** 歴代全選手および『Victory Road』の選手ステータス、必殺技、属性、パッシブスキルを即座に照会可能。
- **戦術・チームビルダー (/equipe):** チームシナジーや属性マトリクス、フォーメーション適性をシミュレーション。
- **トーナメント自動運営 (/tournoi):** Challongeや対戦ロビーと連携した大会進行、ブラケット生成、結果集計。
- **RAG & ナレッジ検索 (Azalee AI Knowledge):** `knowledge.db`（SQLite FTS5）と連携し、ゲーム仕様、Patchnote、アップデート情報、Level-5開発動向に関する質問に自律応答。

## アーキテクチャとインフラ

- **ランタイム:** Bun + TypeScript による高速イベント処理。
- **データベース:** PostgreSQL (Supabase) + ローカル SQLite FTS5 (knowledge.db)。
- **MCP統合:** Rose Griffon MCP サーバー（packages/mcp）を通じて Antigravity および外部エージェントと直接通信。
