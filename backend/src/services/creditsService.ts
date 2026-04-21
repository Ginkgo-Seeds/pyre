import { supabase } from './supabase'

// Custo em créditos por operação
export const CREDIT_COSTS: Record<string, number> = {
  image_nanobanana: 15,
  video_seedance: 80,
  avatar_heygen: 50,
  audio_elevenlabs: 10,
  publish_postiz: 2,
  text_claude: 3,
}

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()
  return data?.balance ?? 0
}

export async function debitCredits(
  userId: string,
  operation: string,
  amount: number
): Promise<{ success: boolean; balance: number; reason?: string }> {
  const { data: wallet } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (!wallet) return { success: false, balance: 0, reason: 'wallet_not_found' }
  if (wallet.balance < amount) return { success: false, balance: wallet.balance, reason: 'insufficient_credits' }

  const newBalance = wallet.balance - amount
  const { error } = await supabase
    .from('user_credits')
    .update({ balance: newBalance })
    .eq('user_id', userId)

  if (error) return { success: false, balance: wallet.balance, reason: 'debit_failed' }
  return { success: true, balance: newBalance }
}

export async function creditTokens(
  userId: string,
  amount: number
): Promise<void> {
  const { data: wallet } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (!wallet) return

  await supabase
    .from('user_credits')
    .update({ balance: wallet.balance + amount })
    .eq('user_id', userId)
}
