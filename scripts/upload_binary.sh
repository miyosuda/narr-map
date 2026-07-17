#!/usr/bin/env bash
set -euo pipefail

# package.json からバージョンを取得してタグ名を組み立てる
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION=$(node -p "require('$REPO_ROOT/package.json').version")
PRODUCT_NAME=$(node -p "require('$REPO_ROOT/package.json').productName")
TAG="v${VERSION}"

# Apple Silicon (arm64) の zip 出力パス
# electron-forge の命名: {productName}-darwin-arm64-{version}.zip
BINARY_DIR="$REPO_ROOT/out/make/zip/darwin/arm64"
BINARY="$BINARY_DIR/${PRODUCT_NAME}-darwin-arm64-${VERSION}.zip"

if [ ! -f "$BINARY" ]; then
  echo "Error: バイナリが見つかりません: $BINARY"
  echo "先に 'npm run make' を実行してください。"
  if [ -d "$BINARY_DIR" ]; then
    echo ""
    echo "ディレクトリ内の zip ファイル:"
    ls -1 "$BINARY_DIR"/*.zip 2>/dev/null || echo "  (なし)"
  fi
  exit 1
fi

echo "タグ    : $TAG"
echo "バージョン: $VERSION"
echo "ファイル  : $BINARY"
echo ""

gh release upload "$TAG" "$BINARY" --clobber
echo "アップロード完了: $BINARY → $TAG"
