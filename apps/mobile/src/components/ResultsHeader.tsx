import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme";

interface Props {
  count: number;
  countLabel: string;
  subtitle?: string;
  bestSaving?: number | null;
  filterOpenCount?: number;
  onPressFilters?: () => void;
}

export function ResultsHeader({
  count,
  countLabel,
  subtitle,
  bestSaving,
  filterOpenCount,
  onPressFilters,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.count}>
          <Text style={styles.countNum}>{count}</Text>
          <Text style={styles.countLabel}> {countLabel}</Text>
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {bestSaving && bestSaving > 0 ? (
          <View style={styles.bestSaving}>
            <Text style={styles.bestSavingLabel}>Best saving</Text>
            <Text style={styles.bestSavingValue}>{formatCurrency(bestSaving)}</Text>
          </View>
        ) : null}
        <Pressable onPress={onPressFilters} style={styles.filterBtn}>
          <Text style={styles.filterBtnText}>Filters</Text>
          {filterOpenCount ? (
            <View style={styles.dot}>
              <Text style={styles.dotText}>{filterOpenCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  left: { flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  count: { color: colors.text },
  countNum: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.black,
  },
  countLabel: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  bestSaving: {
    backgroundColor: colors.toneEligibleBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    alignItems: "flex-end",
  },
  bestSavingLabel: {
    color: colors.toneEligible,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bestSavingValue: {
    color: colors.toneEligible,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElev,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  filterBtnText: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  dot: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    color: colors.textOnBrand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
});
