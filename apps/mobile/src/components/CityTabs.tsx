import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

// Segmented-control style, matching the web's `.city-tab-group` (a subtle gray
// container with white active tab + brand text). Cleaner than filled pills.
export function CityTabs() {
  const selectedCity = useAppStore((s) => s.selectedCity);
  const setSelectedCity = useAppStore((s) => s.setSelectedCity);
  const offers = useAppStore((s) => s.data?.offers);
  // Fall back to the summary's city list at cold start (before raw offers load).
  const summaryCities = useAppStore((s) => s.summary?.cities);

  const cityList = useMemo(() => {
    const set = new Set<string>();
    if (offers && offers.length) {
      offers.forEach((o) => set.add(o.city));
    } else if (summaryCities) {
      summaryCities.forEach((c) => set.add(c));
    }
    return ["all", ...Array.from(set).sort()];
  }, [offers, summaryCities]);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.group}>
          {cityList.map((c) => {
            const active = selectedCity === c;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  if (selectedCity === c) return;
                  Haptics.selectionAsync().catch(() => undefined);
                  track("city_change", { from: selectedCity, to: c });
                  setSelectedCity(c);
                }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {c === "all" ? "All cities" : c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  group: {
    flexDirection: "row",
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.md,
    padding: 3,
    gap: 2,
    alignSelf: "flex-start",
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.bgElev,
    ...shadow.card,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  tabTextActive: {
    color: colors.text,
  },
});
