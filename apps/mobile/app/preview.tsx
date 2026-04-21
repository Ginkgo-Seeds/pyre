import React, { useEffect, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { contentApi, publicationsApi } from '@/services/api'

const PYRE_ORANGE = '#FF6B35'
const DARK_BG = '#0D0D0D'
const CARD_BG = '#1A1A1A'

const NETWORKS = ['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok']
const NETWORK_ICONS: Record<string, string> = {
  instagram: 'logo-instagram', twitter: 'logo-twitter',
  linkedin: 'logo-linkedin', facebook: 'logo-facebook', tiktok: 'musical-notes',
}

export default function PreviewScreen() {
  const { content_id } = useLocalSearchParams<{ content_id: string }>()
  const router = useRouter()
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(['instagram'])
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!content_id) return
    loadContent()
  }, [content_id])

  const loadContent = async () => {
    try {
      const res = await contentApi.getStatus(content_id!)
      setContent(res)
      if (res.status === 'processing') {
        setPolling(true)
        setTimeout(loadContent, 3000)
      } else {
        setPolling(false)
      }
    } catch { } finally {
      setLoading(false)
    }
  }

  const toggleNetwork = (n: string) => {
    setSelectedNetworks(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )
  }

  const handlePublish = async () => {
    if (selectedNetworks.length === 0) {
      Alert.alert('Selecione ao menos uma rede social')
      return
    }
    setPublishing(true)
    try {
      await publicationsApi.publish(content_id!, selectedNetworks, content?.refined_prompt ?? '')
      Alert.alert('Publicado!', 'Conteudo enviado para publicacao', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Nao foi possivel publicar')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={PYRE_ORANGE} />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Media Preview */}
      {content?.media_url ? (
        <Image source={{ uri: content.media_url }} style={styles.media} resizeMode="cover" />
      ) : (
        <View style={styles.mediaPlaceholder}>
          {polling ? (
            <>
              <ActivityIndicator size="large" color={PYRE_ORANGE} />
              <Text style={styles.processingText}>Pierre esta gerando seu conteudo...</Text>
            </>
          ) : (
            <Ionicons name="image-outline" size={64} color="#444" />
          )}
        </View>
      )}

      {/* Status Badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, content?.status === 'ready' && styles.statusReady]}>
          <Text style={styles.statusBadgeText}>{content?.status ?? 'desconhecido'}</Text>
        </View>
        <Text style={styles.typeText}>{content?.type}</Text>
      </View>

      {/* Prompt */}
      {content?.original_prompt && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Prompt original</Text>
          <Text style={styles.sectionText}>{content.original_prompt}</Text>
        </View>
      )}

      {/* Network Selector */}
      {content?.status === 'ready' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Publicar em</Text>
            <View style={styles.networksGrid}>
              {NETWORKS.map(n => (
                <TouchableOpacity key={n} style={[styles.networkBtn, selectedNetworks.includes(n) && styles.networkBtnActive]}
                  onPress={() => toggleNetwork(n)}>
                  <Ionicons name={(NETWORK_ICONS[n] ?? 'globe-outline') as any} size={20}
                    color={selectedNetworks.includes(n) ? '#fff' : '#666'} />
                  <Text style={[styles.networkBtnText, selectedNetworks.includes(n) && styles.networkBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
            onPress={handlePublish} disabled={publishing}>
            {publishing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.publishBtnText}>Publicar agora</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: 320, borderRadius: 16 },
  mediaPlaceholder: { width: '100%', height: 320, backgroundColor: CARD_BG, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText: { color: '#888', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusReady: { backgroundColor: PYRE_ORANGE },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  typeText: { color: '#666', fontSize: 13 },
  section: { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, gap: 6 },
  sectionLabel: { color: '#666', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  networksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  networkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#333' },
  networkBtnActive: { backgroundColor: PYRE_ORANGE, borderColor: PYRE_ORANGE },
  networkBtnText: { color: '#666', fontSize: 13, fontWeight: '600' },
  networkBtnTextActive: { color: '#fff' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PYRE_ORANGE, borderRadius: 14, padding: 16 },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
