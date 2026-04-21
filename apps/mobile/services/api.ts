// URL do backend — troque pela URL pública quando fizer deploy
export const API_URL = __DEV__
  ? 'http://192.168.0.112:3000'  // ← troque pelo IP local da sua máquina
  : 'https://seu-backend.railway.app'

// ID de usuário temporário para testes (antes de implementar auth completo)
export const TEMP_USER_ID = 'test-user-gabriel-001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// Chat
export const chatApi = {
  sendMessage: (message: string, audioMode = false) =>
    request<{
      agent_reply: string
      audio_url: string | null
      intent: { type: string; api: string; networks: string[] }
      content_id: string | null
    }>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ user_id: TEMP_USER_ID, message, audio_mode: audioMode }),
    }),

  getHistory: () =>
    request<{ history: Array<{ id: string; role: string; content: string; created_at: string }> }>(
      `/chat/history/${TEMP_USER_ID}`
    ),
}

// Conteúdo
export const contentApi = {
  getStatus: (id: string) =>
    request<{ id: string; status: string; media_url: string | null; type: string }>(
      `/content/${id}`
    ),

  getUserContent: () =>
    request<{ content: any[] }>(`/content/user/${TEMP_USER_ID}`),
}

// Publicações
export const publicationsApi = {
  publish: (contentId: string, networks: string[], caption: string, scheduledFor?: string) =>
    request<{ success: boolean; publication_id: string }>('/publications/publish', {
      method: 'POST',
      body: JSON.stringify({
        user_id: TEMP_USER_ID,
        content_id: contentId,
        networks,
        caption,
        scheduled_for: scheduledFor,
      }),
    }),
}

// Automações
export const automationsApi = {
  list: () =>
    request<{ automations: any[] }>(`/automations/user/${TEMP_USER_ID}`),

  toggle: (id: string) =>
    request<{ automation: any }>(`/automations/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: TEMP_USER_ID }),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/automations/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: TEMP_USER_ID }),
    }),
}

// Créditos
export const creditsApi = {
  getBalance: () =>
    request<{ balance: number; plan: string }>(`/credits/${TEMP_USER_ID}`),
}
