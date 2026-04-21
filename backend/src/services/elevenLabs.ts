// Voz padrão do Pierre — pode ser trocada por uma voz clonada futuramente
const PIERRE_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

export async function textToSpeech(text: string): Promise<Buffer> {
  const res = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${PIERRE_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.35,
          use_speaker_boost: true
        }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error: ${err}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function speechToText(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: 'audio/mpeg' })
  formData.append('file', blob, 'audio.mp3')
  formData.append('model_id', 'scribe_v1')

  const res = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body: formData
  })

  if (!res.ok) throw new Error('ElevenLabs STT failed')
  const data = await res.json()
  return data.text
}
