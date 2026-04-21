const NANOBANANA_BASE = 'https://api.nanobananaapi.ai/api/v1'

export async function generateImage(
  prompt: string,
  callbackUrl?: string
): Promise<{ taskId: string }> {
  const res = await fetch(`${NANOBANANA_BASE}/nanobanana/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NANOBANANA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      numImages: 1,
      type: 'TEXTTOIMAGE',
      image_size: '1:1',
      callBackUrl: callbackUrl ?? `${process.env.BACKEND_URL}/webhooks/nanobanana`
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NanoBanana error: ${err}`)
  }

  const data = await res.json()
  return { taskId: data.taskId ?? data.id }
}

export async function getImageStatus(taskId: string): Promise<{
  status: 'pending' | 'completed' | 'failed'
  imageUrl?: string
}> {
  const res = await fetch(`${NANOBANANA_BASE}/nanobanana/${taskId}`, {
    headers: { 'Authorization': `Bearer ${process.env.NANOBANANA_API_KEY}` }
  })

  if (!res.ok) throw new Error('NanoBanana status check failed')

  const data = await res.json()
  return {
    status: data.status === 'SUCCESS' ? 'completed' : data.status === 'FAILED' ? 'failed' : 'pending',
    imageUrl: data.imageUrl ?? data.output?.[0]
  }
}
