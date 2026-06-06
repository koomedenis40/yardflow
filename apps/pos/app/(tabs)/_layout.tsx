import { Tabs } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Home,
  MoreHorizontal,
  Wallet,
} from 'lucide-react-native';
import { colors, fontSize, layout } from '@yardflow/theme';

const TAB_ICON_SIZE = 22;
const STROKE = 1.75;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green[800],
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          height: layout.touchTarget + 24,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.caption,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Home size={TAB_ICON_SIZE} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy"
        options={{
          title: 'Buy',
          tabBarIcon: ({ color }) => (
            <ArrowDownToLine size={TAB_ICON_SIZE} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: ({ color }) => (
            <ArrowUpFromLine size={TAB_ICON_SIZE} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: 'Pay',
          tabBarIcon: ({ color }) => (
            <Wallet size={TAB_ICON_SIZE} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <MoreHorizontal size={TAB_ICON_SIZE} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
    </Tabs>
  );
}
