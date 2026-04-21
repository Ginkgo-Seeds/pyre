import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const PYRE_ORANGE = '#FF6B35'
const DARK_BG = '#0D0D0D'
const TAB_BG = '#141414'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PYRE_ORANGE,
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: '#222',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: DARK_BG },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pierre',
          headerTitle: '🔥 Pierre',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Biblioteca',
          headerTitle: 'Biblioteca',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="automations"
        options={{
          title: 'Automações',
          headerTitle: 'Automações',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="repeat" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}
