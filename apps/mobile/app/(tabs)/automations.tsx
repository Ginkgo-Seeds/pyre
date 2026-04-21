import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { automationsApi } from '@/services/api'

const PYRE_ORANGE = '#FF6B35'
const DARK_BG = '#0D0D0D'
const CARD_BG = '#1A1A1A'

const NETWORK_ICONS: Record<string, string> = {
  instagram: 'logo-instagram',
  twitter: 'logo-twitter',
  linkedin: 'logo-linkedin',
  facebook: 'logo-facebook',
  tiktok: 'musical-notes',
}

export default function AutomationsScreen() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const res = await automationsApi.list()
      setItems(res.automations ?? [])
    } catch { } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: string) => {
    try {
      const res = await automationsApi.toggle(id)
      setItems(prev => prev.map(a => a.id === id ? res.automation : a))
    } catch {
      Alert.alert('Erro', 'Nao foi possivel alterar a automacao')
    }
  }

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Deletar automacao', `Deseja remover "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar', style: 'destructive',
        onPress: async () => {
          try {
            await automationsApi.delete(id)
            setItems(prev => prev.filter(a => a.id !== id))
          } catch {
            Alert.alert('Erro', 'Nao foi possivel deletar')
          }
        }
      }
    ])
  }

  const renderItem = ({ item }: { item: any }) => {
    const networks: string[] = item.networks ?? []
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardCron}>{item.cron_expression}</Text>
          </View>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggle(item.id)}
            trackColor={{ false: '#333', true: PYRE_ORANGE }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.cardPrompt} numberOfLines={2}>{item.base_prompt}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.networksRow}>
            {networks.map(n => (
              <View key={n} style={styles.networkBadge}>
                <Ionicons name={(NETWORK_ICONS[n] ?? 'globe-outline') as any} size={12} color="#ccc" />
                <Text style={styles.networkText}>{n}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={PYRE_ORANGE} />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.infoBar}>
        <Ionicons name="information-circle-outline" size={14} color="#666" />
        <Text style={styles.infoText}>Crie automacoes conversando com o Pierre</Text>
      </View>
      <FlatList data={items} keyExtractor={i => i.id} renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={PYRE_ORANGE} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="repeat-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Nenhuma automacao ativa</Text>
            <Text style={styles.emptySubText}>Ex: "Posta todo dia as 12h no Instagram"</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222' },
  infoText: { color: '#555', fontSize: 12 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2A2A2A', gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flex: 1 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardCron: { color: '#666', fontSize: 12, marginTop: 2 },
  cardPrompt: { color: '#888', fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  networksRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2A2A2A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  networkText: { color: '#ccc', fontSize: 11 },
  deleteBtn: { padding: 4 },
  emptyText: { color: '#555', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubText: { color: '#444', fontSize: 14, marginTop: 4, textAlign: 'center' },
})
