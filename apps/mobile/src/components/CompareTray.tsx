import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

// Floating tray that surfaces the staged compare list. Appears whenever the
// user has tapped "+ Compare" on at least one card; clears itself when they
// drop both. At 2/2 it exposes a "Compare →" CTA that opens the side-by-side
// detail. Mirrors the web `#cmp-tray` behaviour (`renderCompareTray`).
//
// Layout: each chip stacks card name + bank so the user can tell which slot
// is which at a glance. The whole tray sits just above the tab bar with a
// strong shadow and brand-edged peach surface so it floats clearly over the
// white card list rather than blending into it.
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
                <View style={styles.slotText}>
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
          {!ready ? (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>+ Pick 1 more card</Text>
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
  // Sits just above the bottom tab bar with a small gap so the tray reads as
  // a separate floating surface, not part of the card list behind it. The
  // FlashList in (tabs)/index.tsx widens its paddingBottom while the tray is
  // visible so the last card can still scroll fully into view.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandLight,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    // Deeper than the card shadow on purpose — the tray needs to feel like
    // it's floating above the list, not nested inside it.
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  slots: { flex: 1, gap: spacing.xs, minWidth: 0 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  slotText: { flex: 1, minWidth: 0 },
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
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  slotCloseText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: typography.weight.bold,
    lineHeight: 16,
  },
  placeholder: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandMid,
    borderStyle: "dashed",
    alignItems: "center",
  },
  placeholderText: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    minHeight: 40,
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: colors.bgSubtle },
  ctaText: {
    color: colors.textOnBrand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  ctaTextDisabled: { color: colors.textDim },
});
