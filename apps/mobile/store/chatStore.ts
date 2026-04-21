import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  audio_url?: string | null
  content_id?: string | null
  intent?: { type: string; api: string; networks: string[] }
  created_at: string
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  balance: number
  plan: string
  addMessage: (msg: Message) => void
  setLoading: (v: boolean) => void
  setBalance: (balance: number, plan: string) => void
  clearHistory: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  balance: 30,
  plan: 'free',
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (v) => set({ isLoading: v }),
  setBalance: (balance, plan) => set({ balance, plan }),
  clearHistory: () => set({ messages: [] }),
}))
