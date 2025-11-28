import OpenAI from 'openai'
import { convertPlantUMLToState } from './uml'
import { SavingNodeState } from '../types'

/**
 * テキストをMindMapに変換する
 * OpenAI APIを使用してテキストをPlantUML形式のMindMapに変換し、
 * それをSavingNodeStateに変換して返す
 */
export async function convertTextToMindMap(
  openaiApiKey: string,
  model: string,
  inputText: string,
  abortController: AbortController
): Promise<SavingNodeState | null> {
  const openai = new OpenAI({ apiKey: openaiApiKey })

  const prompt = `以下のテキストを分析し、PlantUML形式のMindMapとして構造化してください。

テキスト:
"""
${inputText}
"""

出力は以下の形式で出力してください（コードブロックなし、PlantUML形式のみ）:

@startmindmap
+ メインテーマ
++ サブトピック1
+++ 詳細1
+++ 詳細2
++ サブトピック2
@endmindmap

重要なルール:
- テキストの主題をルートノードとする
- 関連する概念やトピックを階層的に整理
- 簡潔で分かりやすいノードテキストにする
- 必ず@startmindmapと@endmindmapで囲む
- 入力が日本語のテキストの場合は日本語で出力する
- 入力が英語のテキストの場合は英語で出力する
- 入力がjsonやyamlの様な構造化されたテキストの場合
  - 言語を変換せずに、元の言語で出力する
  - key, valueの構造があった場合はvalueの値は必ず子ノードとして出力する "abc:xyz"といった文字列ノードにはしない.
`

  const response = await openai.chat.completions.create(
    {
      messages: [{ role: 'user', content: prompt }],
      model: model
    },
    { signal: abortController.signal }
  )

  const content = response.choices[0]?.message?.content
  if (!content) return null

  // PlantUML部分を抽出
  const umlMatch = content.match(/@startmindmap[\s\S]*?@endmindmap/)
  if (!umlMatch) return null

  return convertPlantUMLToState(umlMatch[0])
}

