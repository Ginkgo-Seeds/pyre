import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { contentApi, publicationsApi } from '@/services/api'
import { useRouter } from 'expo-router'

const PYRE_ORANGE = '#FF6B35'
const DARK_BG = '#0D0D0D'
const CARD_BG = '#1A1A1A'

export default function LibraryScreen() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const load = async () => {
    try {
      const res = await contentApi.getUserContent()
      setItems(res.content ?? [])
    } catch { } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const statusColor = (s: string) => {
    if (s === 'published') return '#4CAF50'
    if (s === 'ready') return PYRE_ORANGE
    if (s === 'processing') return '#2196F3'
    return '#666'
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}
      onPress={() => router.push({ pathname: '/preview', params: { content_id: item.id } })}>
      {item.media_url ? (
        <Image source={{ uri: item.media_url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#444" />
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardPrompt} numberOfLines={2}>{item.original_prompt}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={PYRE_ORANGE} />
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList data={items} keyExtractor={i => i.id} renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={PYRE_ORANGE} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="images-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Nenhum conteudo ainda</Text>
            <Text style={styles.emptySubText}>Converse com o Pierre para criar</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', backgroundColor: CARD_BG, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A' },
  thumb: { width: 80, height: 80 },
  thumbPlaceholder: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardPrompt: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  typeText: { color: '#555', fontSize: 12, marginLeft: 'auto' },
  emptyText: { color: '#555', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubText: { color: '#444', fontSize: 14, marginTop: 4 },
})
