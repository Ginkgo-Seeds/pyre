import { View, Text, TextInput, TouchableOpacity, 
         StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { useState, useRef } from 'react'
import axios from 'axios'

const API = 'http://192.168.0.112:3000'
const TEMP_USER_ID = 'test-user-gabriel-001'

type Message = { role: 'user' | 'assistant'; content: string; id: string }

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const flatRef = useRef<FlatList>(null)

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await axios.post(`${API}/chat/message`, {
        user_id: TEMP_USER_ID,
        message: input,
        audio_mode: false
      })
      const botMsg: Message = {
        role: 'assistant',
        content: res.data.agent_reply,
        id: (Date.now() + 1).toString()
      }
      setMessages(prev => [...prev, botMsg])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao conectar com o servidor.',
        id: (Date.now() + 1).toString()
      }])
    } finally {
      setLoading(false)
      setTimeout(() => flatRef.current?.scrollToEnd(), 100)
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.botText]}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Pyre</Text>
            <Text style={styles.emptySubtitle}>O que você quer criar hoje?</Text>
          </View>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Crie uma imagem de..."
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity style={[styles.btn, loading && styles.btnOff]} onPress={send} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '...' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  list: { flex: 1, padding: 16 },
  empty: { flex: 1, alignItems: 'center', marginTop: 120 },
  emptyTitle: { fontSize: 40, fontWeight: '700', color: '#fff' },
  emptySubtitle: { fontSize: 16, color: '#555', marginTop: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10 },
  userBubble: { backgroundColor: '#7F77DD', alignSelf: 'flex-end' },
  botBubble: { backgroundColor: '#1a1a1a', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#333' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  botText: { color: '#ccc' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 16, 
            paddingVertical: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  btnOff: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontWeight: '600' }
})