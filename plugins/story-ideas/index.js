// 右クリックしたノードの子として、物語上の案を足す。
// メニュー名は manifest.json、案の作り方はこのファイルが持つ。

function pathText(node) {
  return [...node.ancestors.map((ancestor) => ancestor.text), node.text]
    .map((text) => (typeof text === 'string' ? text.trim() : ''))
    .filter((text) => text !== '')
    .join(' / ')
}

function buildPrompt(node) {
  const existing = node.children
    .map((child) => (typeof child.text === 'string' ? child.text.trim() : ''))
    .filter((text) => text !== '')

  const lines = [
    'あなたは物語の構成を手伝う編集者です。',
    'マインドマップの次のノードについて、その子ノードになる案を3つ出してください。',
    '',
    `対象: ${pathText(node)}`,
    '',
    '条件:',
    '- 各案は1行',
    '- ノードの見出しとしてそのまま使える短い日本語',
    '- 番号、記号、引用符、説明は付けない',
    '- 対象ノードの言い換えではなく、その中身を具体化した案にする'
  ]

  if (existing.length > 0) {
    lines.push('- 次の案は既にあるので出さない')
    for (const text of existing) {
      lines.push(`- ${text}`)
    }
  }

  return lines.join('\n')
}

function stripBullet(line) {
  return line
    .replace(/^\s*[-*・]\s+/, '')
    .replace(/^\s*\d+[.)）、.]\s+/, '')
    .replace(/^\s*[０-９]+[.)）、.．]\s+/, '')
    .replace(/^["「『]+|["」』]+$/g, '')
    .trim()
}

function parseIdeas(response) {
  return response
    .split(/\r?\n/)
    .map((line) => stripBullet(line))
    .filter((line) => line !== '' && !line.startsWith('```'))
    .slice(0, 8)
    .map((text) => ({ text }))
}

module.exports = {
  async propose(ctx) {
    const response = await ctx.ai.complete(buildPrompt(ctx.node))
    return {
      addChildren: parseIdeas(response)
    }
  }
}
