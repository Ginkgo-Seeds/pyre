import React, { useState, useRef, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useChatStore, Message } from "@/store/chatStore"
import { chatApi, creditsApi } from "@/services/api"
import { useRouter } from "expo-router"

const PYRE_ORANGE = "#FF6B35"
const DARK_BG = "#0D0D0D"
const CARD_BG = "#1A1A1A"
const PIERRE_BG = "#1E1E2E"

export default function ChatScreen() {
  const { messages, isLoading, balance, plan, addMessage, setLoading, setBalance } = useChatStore()
  const [input, setInput] = useState("")
  const flatListRef = useRef<FlatList>(null)
  const router = useRouter()

  useEffect(() => {
    creditsApi.getBalance().then(d => setBalance(d.balance, d.plan)).catch(() => {})
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    setInput("")
    const userMsg: Message = {
      id: Date.now().toString(), role: "user", content: text,
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)
    setLoading(true)
    try {
      const res = await chatApi.sendMessage(text)
      addMessage({
        id: (Date.now() + 1).toString(), role: "assistant",
        content: res.agent_reply, audio_url: res.audio_url,
        content_id: res.content_id, intent: res.intent,
        created_at: new Date().toISOString(),
      })
      creditsApi.getBalance().then(d => setBalance(d.balance, d.plan)).catch(() => {})
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(), role: "assistant",
        content: "Erro de conexao. Verifique o backend.",
        created_at: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user"
    const hasMedia = item.content_id && item.intent?.type === "image"
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowPierre]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>P</Text></View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubblePierre]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextPierre]}>
            {item.content}
          </Text>
          {hasMedia && (
            <TouchableOpacity style={styles.previewBtn}
              onPress={() => router.push({ pathname: "/preview", params: { content_id: item.content_id! } })}>
              <Ionicons name="eye" size={14} color="#fff" />
              <Text style={styles.previewBtnText}>Ver conteudo gerado</Text>
            </TouchableOpacity>
          )}
          {item.intent?.type === "automation" && (
            <View style={styles.automationBadge}>
              <Ionicons name="repeat" size={12} color={PYRE_ORANGE} />
              <Text style={styles.automationBadgeText}>Automacao criada</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  const SUGGESTIONS = ["Crie uma imagem de cafe", "Post todo dia as 12h", "Gere uma legenda criativa"]

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🔥</Text>
      <Text style={styles.emptyTitle}>Ola, sou o Pierre</Text>
      <Text style={styles.emptySubtitle}>
        Seu copiloto criativo. Me diga o que quer criar hoje.
      </Text>
      <View style={styles.suggestionsRow}>
        {SUGGESTIONS.map(s => (
          <TouchableOpacity key={s} style={styles.suggestion} onPress={() => setInput(s)}>
            <Text style={styles.suggestionText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
      <View style={styles.creditsBar}>
        <Ionicons name="flash" size={14} color={PYRE_ORANGE} />
        <Text style={styles.creditsText}>{balance} creditos</Text>
        <View style={styles.planBadge}><Text style={styles.planText}>{plan.toUpperCase()}</Text></View>
      </View>
      <FlatList ref={flatListRef} data={messages} keyExtractor={m => m.id}
        renderItem={renderMessage} ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
      {isLoading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={PYRE_ORANGE} />
          <Text style={styles.typingText}>Pierre esta pensando...</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput}
          placeholder="O que vamos criar hoje?" placeholderTextColor="#555"
          multiline maxLength={500} />
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  creditsBar: { flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#111",
    borderBottomWidth: 1, borderBottomColor: "#222" },
  creditsText: { color: "#ccc", fontSize: 13, flex: 1 },
  planBadge: { backgroundColor: PYRE_ORANGE, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  planText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  msgRow: { flexDirection: "row", marginBottom: 16, alignItems: "flex-end" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowPierre: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: PYRE_ORANGE,
    alignItems: "center", justifyContent: "center", marginRight: 8 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 12 },
  bubbleUser: { backgroundColor: PYRE_ORANGE, borderBottomRightRadius: 4 },
  bubblePierre: { backgroundColor: PIERRE_BG, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextPierre: { color: "#E8E8E8" },
  previewBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
    backgroundColor: PYRE_ORANGE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  previewBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  automationBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
    backgroundColor: "#2A2A2A", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  automationBadgeText: { color: PYRE_ORANGE, fontSize: 11, fontWeight: "600" },
  typingIndicator: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typingText: { color: "#666", fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12,
    backgroundColor: "#111", borderTopWidth: 1, borderTopColor: "#222" },
  input: { flex: 1, backgroundColor: CARD_BG, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: "#333" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: PYRE_ORANGE, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#333" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "#888", fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  suggestionsRow: { gap: 8, width: "100%" },
  suggestion: { backgroundColor: CARD_BG, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#333" },
  suggestionText: { color: "#ccc", fontSize: 14 },
})
