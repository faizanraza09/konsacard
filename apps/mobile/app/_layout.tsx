import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PostHogProvider } from "posthog-react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadOffers, loadRequirements, loadSummary } from "@/data";
import { posthog } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, spacing, typography } from "@/theme";
import { shouldShowOnboarding } from "./onboarding";

export default function RootLayout() {
  const router = useRouter();
  const setData = useAppStore((s) => s.setData);
  const setSummary = useAppStore((s) => s.setSummary);
  const summary = useAppStore((s) => s.summary);
  const data = useAppStore((s) => s.data);
  const [err, setErr] = useState<string | null>(null);
  // First-launch onboarding gate. Resolved off AsyncStorage during boot so we
  // know whether to redirect before the tabs are interactive. `null` = unknown.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const redirectedToOnboarding = useRef(false);

  useEffect(() => {
    let cancelled = false;
    shouldShowOnboarding().then((show) => {
      if (!cancelled) setNeedsOnboarding(show);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cold-start fast path: load the small precomputed summary + requirements
  // (both small) and clear the boot spinner as soon as the summary is ready.
  // Raw offers (~21 MB parsed) are NOT loaded here — screens that need them
  // call `ensureRawOffers()` lazily. If the summary is unavailable (no
  // summaryFile, or fetch fails with no cache) we fall back to loading raw.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summaryResult, reqs] = await Promise.all([
          loadSummary().catch(() => null),
          loadRequirements(),
        ]);
        if (cancelled) return;
        if (summaryResult) {
          setSummary(summaryResult);
          // Stash requirements without touching raw `data`. setData clears
          // bootstrapping and is the gate the boot UI watches via `summary`.
          useAppStore.setState({ requirements: reqs, bootstrapping: false });
        } else {
          // Fallback: no summary available — load raw offers like before.
          const bundle = await loadOffers();
          if (!cancelled) setData(bundle, reqs);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setData, setSummary]);

  const ready = !!summary || !!data;

  // Once data is loaded and the navigator is mounted, send first-time users to
  // the onboarding flow. Onboarding's `finish()` writes the seen flag and
  // router.replace("/")s back into the tabs. Guarded so it fires at most once.
  useEffect(() => {
    if (ready && needsOnboarding && !redirectedToOnboarding.current) {
      redirectedToOnboarding.current = true;
      router.replace("/onboarding");
    }
  }, [ready, needsOnboarding, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <PostHogProvider client={posthog} autocapture={{ captureScreens: true, captureTouches: true }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          {!ready && !err ? (
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
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}

function Boot() {
  // Branded splash while summary + requirements load. A soft halo pulses behind
  // the card/dining medallion (same motif as onboarding) so the wait feels
  // intentional and on-brand rather than a bare spinner.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <View style={styles.boot}>
      <View style={styles.bootCenter}>
        <View style={styles.medallionWrap}>
          <Animated.View
            style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
          />
          <Image
            source={require("../assets/splash-icon.png")}
            style={styles.medallion}
            resizeMode="contain"
            accessibilityLabel="KonsaCard"
          />
        </View>
        <Text style={styles.brandWord}>
          konsa<Text style={{ color: colors.brand }}>card</Text>
        </Text>
        <Text style={styles.bootTitle}>Finding your best cards…</Text>
        <Text style={styles.bootSub}>Ranking restaurant deals across 21 banks in your city</Text>
      </View>
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
  bootCenter: { alignItems: "center" },
  medallionWrap: { alignItems: "center", justifyContent: "center", marginBottom: spacing.xxl },
  halo: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.brandMid,
  },
  medallion: { width: 96, height: 96, borderRadius: 48 },
  brandWord: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  bootTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: "center",
  },
  bootSub: {
    marginTop: spacing.xs,
    color: colors.textDim,
    fontSize: typography.size.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 19,
  },
  bootText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.size.md,
    textAlign: "center",
  },
});
