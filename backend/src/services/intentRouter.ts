import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface IntentResult {
  type: 'image' | 'video' | 'audio' | 'avatar' | 'text' | 'automation' | 'publish'
  api: 'nanobanana' | 'seedance' | 'heygen' | 'elevenlabs' | 'none'
  api_prompt: string
  caption: string
  is_automation: boolean
  cron_expression?: string
  networks: string[]
  agent_reply: string
}

export async function routeIntent(
  userPrompt: string,
  chatHistory: Array<{ role: string; content: string }>
): Promise<IntentResult> {

  const systemPrompt = `Você é o Pierre, um copiloto criativo de IA com personalidade elegante, direto e criativo.
Sua missão: analisar o pedido do usuário e retornar um JSON estruturado com a intenção detectada.

REGRAS DE ROTEAMENTO:
- Se o usuário quer criar uma IMAGEM → type: "image", api: "nanobanana"
- Se o usuário quer criar um VÍDEO curto (sem avatar) → type: "video", api: "seedance"
- Se o usuário quer criar um VÍDEO com AVATAR/APRESENTADOR → type: "avatar", api: "heygen"
- Se o usuário quer criar ÁUDIO/NARRAÇÃO → type: "audio", api: "elevenlabs"
- Se o usuário quer AGENDAR/AUTOMATIZAR posts recorrentes → type: "automation", is_automation: true
- Se o usuário quer PUBLICAR conteúdo existente → type: "publish"
- Se é apenas uma CONVERSA → type: "text", api: "none"

REDES SOCIAIS: detecte quais redes o usuário mencionou. Se não mencionar, use ["instagram"].
Opções: "instagram", "tiktok", "facebook", "linkedin", "twitter", "threads", "youtube"

CRON: se for automação, converta o horário em cron expression (ex: "todo dia ao meio-dia" → "0 12 * * *")

Retorne APENAS um JSON válido, sem markdown, sem texto extra:
{
  "type": "image|video|audio|avatar|text|automation|publish",
  "api": "nanobanana|seedance|heygen|elevenlabs|none",
  "api_prompt": "prompt em inglês otimizado para a API de geração",
  "caption": "legenda criativa em português para o post",
  "is_automation": false,
  "cron_expression": "0 12 * * *",
  "networks": ["instagram"],
  "agent_reply": "resposta do Pierre ao usuário em português, com personalidade"
}`

  const messages = [
    ...chatHistory.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })),
    { role: 'user' as const, content: userPrompt }
  ]

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    system: systemPrompt,
    messages
  })

  const raw = (response.content[0] as any).text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Router não retornou JSON válido')

  return JSON.parse(jsonMatch[0]) as IntentResult
}
