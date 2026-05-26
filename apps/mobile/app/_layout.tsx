import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadOffers, loadRequirements } from "@/data";
import { useAppStore } from "@/store";
import { colors, spacing, typography } from "@/theme";

export default function RootLayout() {
  const setData = useAppStore((s) => s.setData);
  const data = useAppStore((s) => s.data);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bundle, reqs] = await Promise.all([loadOffers(), loadRequirements()]);
        if (!cancelled) setData(bundle, reqs);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setData]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          {!data && !err ? (
            <Boot />
          ) : err ? (
            <BootError msg={err} onRetry={() => setErr(null)} />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                // iOS still leaks the parent route's name ("(tabs)") as the
                // back-button label when `headerBackTitle: ""` is set on the
                // child screen. `minimal` is the RN-Screens-blessed way to
                // render an icon-only back button across both platforms.
                headerBackButtonDisplayMode: "minimal",
                headerBackTitle: " ",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="card/[id]"
                options={{
                  headerShown: true,
                  title: "Card",
                  headerTintColor: colors.text,
                  headerBackButtonDisplayMode: "minimal",
                  headerBackTitle: " ",
                }}
              />
              <Stack.Screen
                name="restaurant/[name]"
                options={{
                  headerShown: true,
                  title: "Restaurant",
                  headerTintColor: colors.text,
                  headerBackButtonDisplayMode: "minimal",
                  headerBackTitle: " ",
                }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ presentation: "fullScreenModal", headerShown: false }}
              />
              <Stack.Screen
                name="quiz"
                options={{ presentation: "modal", headerShown: true, title: "Find My Card" }}
              />
              <Stack.Screen
                name="chat"
                options={{ presentation: "modal", headerShown: true, title: "Ask KonsaCard" }}
              />
              <Stack.Screen
                name="swipe"
                options={{ presentation: "modal", headerShown: true, title: "Swipe lookup" }}
              />
              <Stack.Screen
                name="visits"
                options={{ headerShown: true, title: "My visits", headerTintColor: colors.text }}
              />
              <Stack.Screen
                name="settings"
                options={{ headerShown: true, title: "Settings", headerTintColor: colors.text }}
              />
              <Stack.Screen
                name="compare"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Compare",
                  headerTintColor: colors.text,
                }}
              />
            </Stack>
          )}
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Boot() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.bootText}>Loading deals…</Text>
    </View>
  );
}

function BootError({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <View style={styles.boot}>
      <Text style={[styles.bootText, { color: colors.red }]}>Could not load data.</Text>
      <Text style={[styles.bootText, { fontSize: typography.size.sm }]}>{msg}</Text>
      <Text style={[styles.bootText, { marginTop: spacing.md, color: colors.brand }]} onPress={onRetry}>
        Retry
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  bootText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.size.md,
    textAlign: "center",
  },
});
