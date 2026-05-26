import { Tabs } from "expo-router";
import { CreditCard, Layers, UtensilsCrossed, Wallet } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, typography } from "@/theme";

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <Icon
      size={24}
      color={focused ? colors.brand : colors.textDim}
      strokeWidth={focused ? 2.25 : 1.75}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bgElev,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cards",
          tabBarIcon: ({ focused }) => <TabIcon Icon={CreditCard} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="restaurants"
        options={{
          title: "Restaurants",
          tabBarIcon: ({ focused }) => <TabIcon Icon={UtensilsCrossed} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my-wallet"
        options={{
          title: "My Wallet",
          tabBarIcon: ({ focused }) => <TabIcon Icon={Wallet} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Build Wallet",
          tabBarIcon: ({ focused }) => <TabIcon Icon={Layers} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
