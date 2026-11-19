import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
          borderTopColor: colorScheme === 'dark' ? '#1e293b' : '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: colorScheme === 'dark' ? '#f8fafc' : '#0f172a',
        },
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'checkmark.circle.fill',
                android: 'check_circle',
                web: 'check',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'sparkles',
                android: 'auto_awesome',
                web: 'star',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cloud Sync',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'icloud.fill',
                android: 'cloud',
                web: 'cloud',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
