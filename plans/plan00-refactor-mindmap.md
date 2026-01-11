# mindmap.tsx リファクタリング案

対象ファイル: `src/components/mindmap/mindmap.tsx` (1346行)

## 1. カスタムフックへの分離

### 1.1 履歴管理（undo/redo）
```typescript
// hooks/useHistory.ts
function useHistory<T>(initialState: T, maxHistory: number = 30) {
  const [history, setHistory] = useState<T[]>([initialState])
  const [cursor, setCursor] = useState(0)
  // undo, redo, push などを提供
}
```

### 1.2 ドラッグ&ドロップ
```typescript
// hooks/useDragAndDrop.ts
function useDragAndDrop(rootState, drawStateMap, ...) {
  // dragState, ghostState, ハンドラーをまとめる
}
```

### 1.3 キーボードショートカット
```typescript
// hooks/useKeyboardShortcuts.ts
function useKeyboardShortcuts(actions: Record<string, () => void>) {
  // handleKeyDown ロジックを分離
}
```

---

## 2. useEffect の依存配列修正

**問題箇所** (155-162行目, 220-239行目):
```typescript
useEffect(() => {
  prepareHandlers()
  return () => cleanupHandlers()
}) // 依存配列なし → 毎レンダー実行
```

**改善案**:
- `useCallback` でハンドラーをメモ化
- 依存配列を適切に設定、または `useRef` でステートを参照

---

## 3. コマンドハンドラーのリファクタリング

**現状** (184-218行目): if-else チェーン

**改善案**: オブジェクトマップ方式
```typescript
const commandHandlers: Record<string, (obj?: any) => void> = {
  copy: () => copy(),
  paste: () => paste(),
  undo: () => undo(),
  // ...
}

function handleCommand(command: string, obj: any) {
  commandHandlers[command]?.(obj)
}
```

---

## 4. 定数の整理

**現状**: ファイル先頭にバラバラに定義
```typescript
const DRAG_NODE = 1
const DRAG_GHOST = 2
const DRAG_BACK = 3
```

**改善案**: enum または as const オブジェクト
```typescript
// constants/drag.ts
export const DragMode = {
  NODE: 'node',
  GHOST: 'ghost',
  BACK: 'back',
} as const
```

---

## 5. 長い関数の分割

### handleMouseDown (450-591行目, 約140行)
分割案:
- `handleNodeHandleClick()` - ハンドル上でのクリック
- `handleNodeClick()` - ノード上でのクリック
- `handleBackgroundClick()` - 背景クリック

### handleMouseMove (593-716行目, 約120行)
分割案:
- `handleNodeDrag()`
- `handleGhostDrag()`
- `handleBackgroundDrag()`
- `updateHoverState()`

---

## 6. 型定義の外部化

`Range` 型 (66-71行目) を `@/types` に移動

---

## 7. ファイル分割案

```
src/components/mindmap/
├── mindmap.tsx          # メインコンポーネント（200行程度に）
├── hooks/
│   ├── useHistory.ts
│   ├── useDragAndDrop.ts
│   ├── useKeyboardShortcuts.ts
│   └── useNodeSelection.ts
├── handlers/
│   ├── mouseHandlers.ts
│   └── commandHandlers.ts
└── constants.ts
```

---

## 8. 優先度

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 高 | useEffect依存配列修正 | パフォーマンス・バグの原因 |
| 高 | カスタムフック分離 | 可読性・テスタビリティ向上 |
| 中 | 長い関数の分割 | 可読性向上 |
| 中 | コマンドハンドラー改善 | 拡張性向上 |
| 低 | 定数整理・型外部化 | コード整理 |
