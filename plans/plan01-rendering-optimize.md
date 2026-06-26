# レンダリング・操作パフォーマンス最適化案

## 背景・症状

- 末端ノード数が 1000 個程度になるとレンダリングが遅くなる
- ノードを fold して実際に表示されているノードが 10 個程度でも、selected node の上下キーでの移動が遅い

**根本原因**: ボトルネックは「表示ノード数」ではなく「ツリー全体のノード数」に比例している処理にある。fold してもキー操作が遅いのは、レイアウト計算・状態更新・ノード探索が全ノードを対象にしているため。

---

## 現状のアーキテクチャ上の問題

```mermaid
flowchart LR
  subgraph current [現状: 上下キー1回]
    A[findNodes O(n)] --> B[updateNodes x2 O(n)]
    B --> C[rootState 更新]
    C --> D[calcDrawStateMap O(n)]
    D --> E[MindMap 再レンダー]
  end
```

| 処理 | fold の影響 |
|------|------------|
| SVG 描画 | 子は描画しない → 軽い |
| `calcDrawStateMap` | 子孫を走査し続ける → **重い** |
| `updateNodes` | 全ノード走査 → **重い** |
| `findNodes` | 全ノード走査 → **重い** |

---

## 1. `calcDrawStateMap`（最優先）

対象: `src/utils/node-draw-utils.ts`, `src/components/mindmap/mindmap.tsx`

```typescript
// mindmap.tsx (106行目)
const drawStateMap = useMemo(() => calcDrawStateMap(rootState), [rootState])
```

`rootState` が変わるたび（選択変更の上下キー含む）に全ノードのレイアウトを再計算している。

### 1.1 fold しても子孫をすべて走査する

```typescript
// node-draw-utils.ts calcDrawInfoMap
for (let i = 0; i < state.children.length; i++) {
  const childState = state.children[i]
  dd = calcDrawInfoMap(childState, dd)  // folded でも再帰
}
```

`state.folded` のときは bounds を葉ノード扱いにするが、その前に子を再帰している。`calcDrawStateMapSub` も同様に `folded` を見ずに子へ進む。

### 1.2 再帰のたびに `structuredClone`

`calcDrawInfoMap` と `calcDrawStateMapSub` の両方で、各ノードの処理ごとに map を丸ごと clone している。1000 ノード規模では GC 負荷が大きい。

### 改善案

- `folded` のときは子孫をスキップする
- `structuredClone` をやめ、1 つの map を mutable に更新する
- **選択変更では `drawStateMap` を再計算しない**（`selected` / `hoverState` / `editState` はレイアウトに影響しない）
  - レイアウト用 state と UI state を分離する、または `useMemo` の依存を絞る

---

## 2. `updateNodes` による全ツリー走査（キーボード操作）

対象: `src/utils/node-utils.ts`, `src/components/mindmap/mindmap.tsx`

上下キーの `move()` は次の流れ:

```typescript
function move(direction, shiftDown) {
  const lastNode = getLastNode()           // findNodes で全走査
  // getSibling は O(depth) で軽い
  const newRootState0 = updateNodes(...)   // 全走査 + 全ノードに新オブジェクト
  const newRootState1 = updateNodes(...)   // さらに全走査
  setRootState(newRootState1)
}
```

`updateNodes` は条件に合うノードだけ変えるが、**全ノードを再帰し、各レベルで `{ ...state, children: newChildren }` を作る**ため O(n)。

### 改善案

| 段階 | 内容 |
|------|------|
| 即効 | 選択変更を 1 パスにまとめる（select true + 他を false を同時に） |
| 中期 | `selectedNodeId` を `rootState` 外の UI state に分離し、選択変更でツリー全体を immutable 更新しない |
| 長期 | フラットな `Map<id, NodeData>` 構造にして、変更ノードと祖先パスだけ更新 |

---

## 3. `getLastNode` / `findNodes`（毎キー O(n)）

対象: `src/components/mindmap/mindmap.tsx`

```typescript
function getLastNode(): NodeState {
  const selectedNodes = findNodes(rootState, (state) => state.selected)
  // ...
}
```

選択ノードは通常 1 つなので、`selectedNodeId` を ref/state で持てば O(1) になる。

### 改善案

- `selectedNodeId`（および必要なら `selectedNodeIds`）を `rootState` 外で管理
- `getLastNode()` は ID からノードを参照（フラット map があれば O(1)、現状構造なら親チェーン辿りで O(depth)）

---

## 4. レンダリング（展開時に 1000 ノード見える場合）

対象: `src/components/mindmap/node.tsx`, `src/components/mindmap/mindmap.tsx`

`Node` は fold 時は子を描画しないが、展開時は再帰的に全ノードを SVG 化する。

- `React.memo` なし → 親の再レンダーで子も再帰的に再評価
- 各ノードが `foreignObject` + `Line` など複数 SVG 要素
- `drawStateMap` 全体を各 `Node` に渡している

### 改善案

- 表示ノードだけフラットリスト化して描画（visible node list）
- `Node` を `React.memo` 化し、`drawState` をノード単位で渡す
- ビューポート外のノードをスキップ（culling）

---

## 5. 実装フェーズ

### Phase 1（小さな diff、効果大）

1. `calcDrawInfoMap` / `calcDrawStateMapSub` で `folded` 時に子孫スキップ
2. `structuredClone` 除去
3. `useMemo` の依存を分離（レイアウト用 state と UI state を分ける、または `selected` 変更では layout を再計算しない）

**期待効果**: fold していても遅いキー操作がかなり改善する。

### Phase 2（キーボード操作の改善）

4. `selectedNodeId` を分離
5. 選択変更の `updateNodes` を 1 パス化、またはパスを避ける

### Phase 3（1000 ノード展開時の描画）

6. visible nodes のフラット描画 + `React.memo`
7. 必要なら viewport culling

---

## 6. 計測方法

Chrome DevTools の Performance で上下キー 1 回を記録し、以下を確認する:

- `calcDrawStateMap` / `calcDrawInfoMap` の時間
- `updateNodes` の時間
- React の `MindMap` / `Node` 再レンダー回数

### 再現用データ

```bash
node scripts/generate-debug-nm.mjs 500   # debug/perf-500-leaves.nm
node scripts/generate-debug-nm.mjs 1000  # debug/perf-1000-leaves.nm
```

---

## 7. 優先度まとめ

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 高 | `calcDrawStateMap` の fold スキップ + `structuredClone` 除去 | fold 時のキー操作・全操作に効く。diff が小さい |
| 高 | 選択変更時の layout 再計算停止 | 上下キーごとに O(n) レイアウトが走るのを防ぐ |
| 高 | `selectedNodeId` 分離 + `updateNodes` 1 パス化 | キーボード操作の O(n) を削減 |
| 中 | visible nodes フラット描画 + `React.memo` | 1000 ノード展開時の描画改善 |
| 低 | viewport culling | 大規模マップでのさらなる改善 |
| 低 | フラット map 構造への移行 | 長期的な根本解決だが変更範囲が大きい |

---

## 8. 関連ファイル

```
src/components/mindmap/
├── mindmap.tsx              # drawStateMap useMemo, move(), getLastNode()
├── node.tsx                 # 再帰レンダリング
└── hooks/
    └── useCanvasTransform.ts  # getRange（fold 時は子をスキップ済み）

src/utils/
├── node-draw-utils.ts       # calcDrawStateMap, calcDrawInfoMap
└── node-utils.ts            # updateNodes, findNodes, getSibling

scripts/
└── generate-debug-nm.mjs    # パフォーマンステスト用 .nm 生成

debug/
├── perf-500-leaves.nm
└── perf-1000-leaves.nm
```
