import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESETS = {
  500: { l1: 10, l2: 5, l3: 10, filename: 'perf-500-leaves.nm' },
  1000: { l1: 10, l2: 10, l3: 10, filename: 'perf-1000-leaves.nm' }
}

const leafTarget = Number(process.argv[2] ?? 500)
const preset = PRESETS[leafTarget]

if (!preset) {
  console.error(`Unknown leaf count: ${leafTarget}. Supported: ${Object.keys(PRESETS).join(', ')}`)
  process.exit(1)
}

const { l1: L1, l2: L2, l3: L3, filename } = preset

function makeNode(text, children = [], overrides = {}) {
  return {
    text,
    symbol: null,
    shiftX: 0,
    shiftY: 0,
    selected: false,
    folded: false,
    isLeft: false,
    children,
    accompaniedState: null,
    ...overrides
  }
}

function countLeaves(node) {
  if (node.children.length === 0) {
    return 1
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

const children = []
for (let i = 1; i <= L1; i++) {
  const l2Children = []
  for (let j = 1; j <= L2; j++) {
    const l3Children = []
    for (let k = 1; k <= L3; k++) {
      l3Children.push(makeNode(`Leaf ${i}-${j}-${k}`))
    }
    l2Children.push(makeNode(`Group ${i}-${j}`, l3Children))
  }
  children.push(makeNode(`Branch ${i}`, l2Children))
}

const leafCount = L1 * L2 * L3
const state = makeNode(`Debug (${leafCount} leaves)`, children, {
  selected: true,
  accompaniedState: makeNode('', [], { isLeft: true })
})

const mapData = {
  version: 2,
  state
}

const debugDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(debugDir, 'data')
mkdirSync(outputDir, { recursive: true })
const outputPath = join(outputDir, filename)
writeFileSync(outputPath, JSON.stringify(mapData, null, '  '), 'utf8')

console.log(`Created ${outputPath}`)
console.log(`Hierarchy: root + 3 levels (Branch / Group / Leaf)`)
console.log(`Structure: ${L1} branches x ${L2} groups x ${L3} leaves = ${countLeaves(state)} leaves`)
console.log(`Total right-side nodes: ${leafCount + L1 * L2 + L1 + 1}`)
