const POSTIZ_BASE = 'https://api.postiz.com/public/v1'

export interface PublishPayload {
  mediaUrl: string
  caption: string
  networks: string[]
  scheduledFor?: string // ISO string, null = imediato
  integrationIds: Record<string, string> // { instagram: 'id-123', tiktok: 'id-456' }
}

export async function publishContent(payload: PublishPayload): Promise<{ postizId: string }> {
  const posts = payload.networks.map(network => ({
    integration: { id: payload.integrationIds[network] },
    value: [{
      content: payload.caption,
      image: payload.mediaUrl ? [{ url: payload.mediaUrl }] : []
    }],
    settings: { __type: network }
  }))

  const body = {
    type: payload.scheduledFor ? 'schedule' : 'now',
    date: payload.scheduledFor,
    posts
  }

  const res = await fetch(`${POSTIZ_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.POSTIZ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Postiz error: ${err}`)
  }

  const data = await res.json()
  return { postizId: data.id ?? data.posts?.[0]?.id }
}

export async function getIntegrations(): Promise<Array<{
  id: string
  name: string
  network: string
}>> {
  const res = await fetch(`${POSTIZ_BASE}/integrations`, {
    headers: { 'Authorization': `Bearer ${process.env.POSTIZ_API_KEY}` }
  })

  if (!res.ok) throw new Error('Postiz: falha ao buscar integrações')
  const data = await res.json()
  return data.integrations ?? []
}
