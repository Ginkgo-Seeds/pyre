import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useState } from 'react'

export default function CreateScreen() {
  const [prompt, setPrompt] = useState('')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pyre</Text>
      <Text style={styles.subtitle}>O que você quer criar?</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={5}
        placeholder="Ex: uma imagem minimalista de café pela manhã e posta no instagram..."
        placeholderTextColor="#666"
        value={prompt}
        onChangeText={setPrompt}
      />
      <TouchableOpacity style={styles.btn}>
        <Text style={styles.btnText}>Criar</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0a0a0a', justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 16,
    padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#111',
    minHeight: 140, textAlignVertical: 'top', marginBottom: 20
  },
  btn: {
    backgroundColor: '#7F77DD', padding: 18,
    borderRadius: 16, alignItems: 'center'
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' }
})