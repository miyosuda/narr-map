#!/usr/bin/env bash
set -euo pipefail

# package.json からバージョンを取得してタグ名を組み立てる
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION=$(node -p "require('$REPO_ROOT/package.json').version")
TAG="v${VERSION}"

# Apple Silicon (arm64) の zip 出力パス
BINARY_DIR="$REPO_ROOT/out/make/zip/darwin/arm64"

if [ ! -d "$BINARY_DIR" ]; then
  echo "Error: バイナリが見つかりません: $BINARY_DIR"
  echo "先に 'npm run make' を実行してください。"
  exit 1
fi

BINARY=$(ls "$BINARY_DIR"/*.zip 2>/dev/null | head -n 1)
if [ -z "$BINARY" ]; then
  echo "Error: $BINARY_DIR に .zip ファイルがありません。"
  exit 1
fi

echo "タグ  : $TAG"
echo "ファイル: $BINARY"
echo ""

gh release upload "$TAG" "$BINARY" --clobber
echo "アップロード完了: $BINARY → $TAG"
