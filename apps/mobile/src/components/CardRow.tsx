import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { CardRecommendation } from "@/types";
import { buildCardKey, formatCurrency, formatCurrencyShort } from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { useAppStore } from "@/store";
import { colors, radii, scoreColor, shadow, spacing, typography } from "@/theme";

// Compact mobile card row — height target ~110px (a touch taller than v1 so
// the stats strip fits without truncation).
//
//   [logo]  Card name                       PKR 3,357
//           BANK · Debit                       /outing
//           12/45 rests · Fee PKR 5k          86.2  #3
//                                            [+ Compare]
//
// Hero is the PKR saving (brand color, tabular). Score is supporting metric.
// The stats strip mirrors the web "card-stats-row" surface (Restaurants
// Matched + Annual Fees), per user feedback that the eligibility chip was
// less useful than seeing fee/coverage at a glance.
//
// Compare toggle lives at the bottom-right so two-finger compare flow is
// reachable from the list without opening the detail. Cap is 2 (managed by
// `toggleCompare` in the store).
export function CardRow({ item, rank }: { item: CardRecommendation; rank: number }) {
  const isTopPick = rank === 1;
  const categoryLabel = item.cardCategory
    ? item.cardCategory.charAt(0).toUpperCase() + item.cardCategory.slice(1)
    : null;

  const cardKey = buildCardKey(item.bank, item.card);
  const inCompare = useAppStore((s) => s.compareList.includes(cardKey));
  const compareCount = useAppStore((s) => s.compareList.length);
  const toggleCompare = useAppStore((s) => s.toggleCompare);
  const disabled = compareCount >= 2 && !inCompare;

  // expo-router's <Link asChild> only accepts a single style prop on its
  // child, so we pre-flatten variant styles into one object instead of
  // passing an array.
  const rowStyle = StyleSheet.flatten<ViewStyle>([
    styles.row,
    isTopPick ? styles.rowTop : null,
    inCompare ? styles.rowInCompare : null,
  ] as StyleProp<ViewStyle>);

  const feeLabel = formatFeeLabel(item);

  return (
    <Link
      href={{ pathname: "/card/[id]", params: { id: `${item.bank}||${item.card}` } }}
      asChild
    >
      <Pressable style={rowStyle}>
        {isTopPick ? (
          <View style={styles.topRibbon}>
            <Text style={styles.topRibbonText}>#1 TOP PICK</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <BankLogo bank={item.bank} />
          <View style={styles.titleCol}>
            <Text
              style={[styles.cardName, isTopPick && styles.cardNameTop]}
              numberOfLines={1}
            >
              {item.card}
            </Text>
            <Text style={styles.subline} numberOfLines={1}>
              <Text style={styles.bankBold}>{item.bank}</Text>
              {categoryLabel ? ` · ${categoryLabel}` : ""}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                <Text style={styles.metaBold}>
                  {item.coveredVenueCount}/{item.totalVenueCount}
                </Text>{" "}
                rests
              </Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText} numberOfLines={1}>
                Fee <Text style={styles.metaBold}>{feeLabel}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.savingValue} numberOfLines={1}>
              {formatCurrency(item.avgExpectedSaving)}
            </Text>
            <Text style={styles.savingUnit}>/outing</Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreNum, { color: scoreColor(item.score) }]}>
                {item.score.toFixed(1)}
              </Text>
              {!isTopPick && rank ? (
                <Text style={styles.rankTag}>#{rank}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {isTopPick && item.topMatches[0] ? (
          <Text style={styles.topMatch} numberOfLines={1}>
            <Text style={styles.topMatchPrefix}>Best at </Text>
            <Text style={styles.topMatchName}>{item.topMatches[0].restaurant}</Text>
            {" · "}
            {formatCurrency(item.topMatches[0].expectedSaving)}/visit
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            hitSlop={10}
            disabled={disabled}
            onPress={(e) => {
              e.stopPropagation?.();
              toggleCompare(cardKey);
            }}
            style={[
              styles.cmpBtn,
              inCompare && styles.cmpBtnActive,
              disabled && styles.cmpBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
          >
            <Text
              style={[
                styles.cmpBtnText,
                inCompare && styles.cmpBtnTextActive,
                disabled && styles.cmpBtnTextDisabled,
              ]}
            >
              {inCompare ? "✓ Comparing" : "+ Compare"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}

function formatFeeLabel(item: CardRecommendation): string {
  const status = item.requirementStatus;
  if (!status?.hasRequirementRecord) return "—";
  const fee = status.annualFeePkr;
  if (fee === null && status.annualFeeWaiverRule) return "waivable";
  if (fee === null) return "n/a";
  if (fee === 0) return "free";
  return formatCurrencyShort(fee);
}

function BankLogo({ bank }: { bank: string }) {
  const url = getBankLogoUrl(bank);
  const size = 36;
  if (!url) {
    return (
      <View style={[styles.logoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.logoFallbackText}>{(bank || "?").slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.logoWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={{ uri: url }} style={{ width: "78%", height: "78%" }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowTop: {
    backgroundColor: colors.bgTint,
    borderColor: colors.brandMid,
    paddingTop: spacing.sm,
  },
  rowInCompare: {
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  topRibbon: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  topRibbonText: {
    color: colors.textOnBrand,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  body: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  logoWrap: {
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoFallback: {
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: {
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  titleCol: { flex: 1, minWidth: 0, gap: 2 },
  cardName: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.md + 4,
  },
  cardNameTop: {
    fontSize: typography.size.lg,
    lineHeight: typography.size.lg + 4,
  },
  subline: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  bankBold: {
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    flexWrap: "wrap",
  },
  metaText: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    fontVariant: ["tabular-nums"],
  },
  metaBold: {
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  metaSep: {
    color: colors.borderStrong,
    fontSize: typography.size.xs,
  },
  statCol: {
    alignItems: "flex-end",
    minWidth: 90,
    gap: 1,
  },
  savingValue: {
    color: colors.brand,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    lineHeight: typography.size.lg + 2,
    fontVariant: ["tabular-nums"],
  },
  savingUnit: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  scoreNum: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
    opacity: 0.85,
  },
  rankTag: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  topMatch: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginTop: spacing.sm,
  },
  topMatchPrefix: { fontWeight: typography.weight.semibold, color: colors.textDim },
  topMatchName: { color: colors.text, fontWeight: typography.weight.semibold },

  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
  },
  cmpBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cmpBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  cmpBtnDisabled: {
    opacity: 0.4,
  },
  cmpBtnText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.3,
  },
  cmpBtnTextActive: { color: colors.textOnBrand },
  cmpBtnTextDisabled: { color: colors.textDim },
});
