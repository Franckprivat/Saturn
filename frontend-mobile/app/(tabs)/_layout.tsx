import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { totalUnread, useChatStore } from '@/store/chat';
import { usePresenceStore } from '@/store/presence';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={24} color={color as string} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  const unread = useChatStore((s) => totalUnread(s.unread));
  const requests = usePresenceStore((s) => s.friendRequests);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.faint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarButton: HapticTab,
        tabBarBadgeStyle: { backgroundColor: Colors.primary, fontSize: 11 },
        headerStyle: { backgroundColor: Colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { color: Colors.text, fontWeight: '800', fontSize: 22 },
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discussions',
          tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
          tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Amis',
          tabBarIcon: icon('people', 'people-outline'),
          tabBarBadge: requests || undefined,
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{ title: 'Communautés', tabBarIcon: icon('planet', 'planet-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: icon('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
}
