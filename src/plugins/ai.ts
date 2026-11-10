import OpenAI from 'openai'

export async function completePrompt(
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  if (apiKey.trim() === '') {
    throw new Error('OpenAI API key is not set')
  }

  const openai = new OpenAI({
    apiKey
  })

  const chatCompletion = await openai.chat.completions.create(
    {
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model
    },
    { signal }
  )

  const content = chatCompletion.choices[0]?.message?.content
  if (content == null || content.trim() === '') {
    throw new Error('Empty response from AI')
  }

  return content
}
