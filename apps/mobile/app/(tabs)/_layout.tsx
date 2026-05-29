import { Tabs } from "expo-router";
import { CreditCard, Layers, UtensilsCrossed, Wallet } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "@/theme";

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <Icon
      size={24}
      color={focused ? colors.brand : colors.textMid}
      strokeWidth={focused ? 2.25 : 1.75}
    />
  );
}

export default function TabsLayout() {
  // Drive the tab bar's bottom padding off the real safe-area inset rather than
  // React Navigation's automatic value, which comes through as too small (or
  // zero) on some Android OEM ROMs / gesture-nav setups — leaving the labels
  // jammed into the navigation-bar zone. Replacing height + paddingBottom makes
  // it deterministic across devices. Fall back to a small floor so the bar
  // never looks cramped on hardware that reports a 0 bottom inset.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMid,
        tabBarStyle: {
          backgroundColor: colors.bgElev,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
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
          title: "Build",
          tabBarIcon: ({ focused }) => <TabIcon Icon={Layers} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
