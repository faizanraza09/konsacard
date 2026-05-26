import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

// Floating tray that surfaces the staged compare list. Appears whenever the
// user has tapped "+ Compare" on at least one card; clears itself when they
// drop both. At 2/2 it exposes a "Compare →" CTA that opens the side-by-side
// detail. Mirrors the web `#cmp-tray` behaviour (`renderCompareTray`).
export function CompareTray() {
  const compareList = useAppStore((s) => s.compareList);
  const toggleCompare = useAppStore((s) => s.toggleCompare);

  if (compareList.length === 0) return null;

  const ready = compareList.length === 2;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.slots}>
          {compareList.map((key) => {
            const [bank, card] = key.split(" || ");
            const shortName = card.split(" ").slice(0, 3).join(" ");
            return (
              <View key={key} style={styles.slot}>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text style={styles.slotName} numberOfLines={1}>
                    {shortName}
                  </Text>
                  <Text style={styles.slotBank} numberOfLines={1}>
                    {bank}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => toggleCompare(key)}
                  style={styles.slotClose}
                  accessibilityLabel={`Remove ${card} from compare`}
                >
                  <Text style={styles.slotCloseText}>×</Text>
                </Pressable>
              </View>
            );
          })}
          {compareList.length === 1 ? (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>+ Pick 1 more</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          disabled={!ready}
          onPress={() => router.push("/compare")}
          style={[styles.cta, !ready && styles.ctaDisabled]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, !ready && styles.ctaTextDisabled]}>
            Compare →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container is absolute so the tray floats above the FlashList without
  // pushing it. `bottom` is sized to clear the bottom tab bar (~56px iOS,
  // a little more for the safe-area inset).
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 64,
    paddingHorizontal: spacing.md,
    alignItems: "stretch",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brandMid,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  slots: { flex: 1, gap: 4, minWidth: 0 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  slotName: {
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  slotBank: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.medium,
  },
  slotClose: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  slotCloseText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: typography.weight.bold,
    lineHeight: 16,
  },
  placeholder: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
  },
  placeholderText: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  ctaDisabled: { backgroundColor: colors.bgSubtle },
  ctaText: {
    color: colors.textOnBrand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  ctaTextDisabled: { color: colors.textDim },
});
