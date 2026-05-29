import { StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  const m = Math.round(days / 30);
  return `${m} month${m === 1 ? "" : "s"} ago`;
}

export function FreshnessChip() {
  // Prefer raw data's timestamp; fall back to the summary at cold start (same
  // generatedAt — both come from the offers index).
  const generatedAt = useAppStore((s) => s.data?.generatedAt ?? s.summary?.generatedAt);
  if (!generatedAt) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86_400_000));
  if (days > 60) return null;
  const aging = days > 30;
  return (
    <View style={[styles.chip, aging ? styles.chipAging : styles.chipFresh]}>
      <View style={[styles.dot, { backgroundColor: aging ? colors.amber : colors.toneEligible }]} />
      <Text style={[styles.text, { color: aging ? colors.amber : colors.toneEligible }]}>
        Offers verified <Text style={styles.bold}>{formatDaysAgo(days)}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  chipFresh: { backgroundColor: colors.toneEligibleBg },
  chipAging: { backgroundColor: colors.toneNeedsInputBg },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  bold: { fontWeight: typography.weight.bold },
});
