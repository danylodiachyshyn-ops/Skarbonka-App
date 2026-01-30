import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import {
  Home,
  TrendingUp,
  CreditCard,
  Coins,
  Gift,
} from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1F96D3',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            position: 'absolute',
            bottom: 28,
            left: 20,
            right: 20,
            height: 64,
            borderRadius: 32,
            backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.95)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.6)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 8,
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 8 : 12,
          },
        ],
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Home
              size={24}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="invest"
        options={{
          title: 'Invest',
          tabBarIcon: ({ color }) => <TrendingUp size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }) => <CreditCard size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="crypto"
        options={{
          title: 'Crypto',
          tabBarIcon: ({ color }) => <Coins size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="revpoints"
        options={{
          title: 'RevPoints',
          tabBarIcon: ({ color }) => <Gift size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {},
});
