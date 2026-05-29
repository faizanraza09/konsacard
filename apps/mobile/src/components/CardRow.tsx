import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { CardRecommendation } from "@/types";
import { buildCardKey, formatCurrency, formatCurrencyShort } from "@/lib/format";
import { fitTier, savingWindowMultiplier, savingWindowSuffix } from "@/lib/algorithms";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, scoreColor, shadow, spacing, typography } from "@/theme";

// Mobile card row, mirroring the web "card-item": a header row (logo, name,
// stacked score) then a banded stats strip then a sweet-spot footer.
//
//   [logo]  Card name                      83  STRONG FIT  ▰▰▰▱
//           BANK · Debit
//   ───────────────────────────────────────────────────────────
//   PKR 1.7 lakh /year · 272 of 1398 · Free
//   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
//   Sweet spot: bills ≤ PKR 12,500                [+ Compare]
//
// Score is the stacked unit on the right (integer + tier label + thin bar),
// matching web's .score-box. The hero saving moved into the stats strip and is
// green so terracotta stays a brand-only accent. The saving reframes by the
// store's savingWindow (/outing | /month | /year).
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
  const savingWindow = useAppStore((s) => s.savingWindow);
  const outingsPerWeek = useAppStore((s) => s.outingsPerWeek);
  const disabled = compareCount >= 2 && !inCompare;

  const scoreInt = Math.round(item.score || 0);
  const scorePct = Math.max(0, Math.min(100, item.score || 0));
  const sc = scoreColor(item.score);
  const tier = fitTier(item.score);

  const windowedSaving =
    item.avgExpectedSaving * savingWindowMultiplier(savingWindow, outingsPerWeek);
  const savingSuffix = savingWindowSuffix(savingWindow);
  const feeText = formatFeeStat(item);
  const sweetSpot = formatSweetSpot(item);

  // expo-router's <Link asChild> only accepts a single style prop on its
  // child, so we pre-flatten variant styles into one object instead of
  // passing an array.
  const rowStyle = StyleSheet.flatten<ViewStyle>([
    styles.row,
    isTopPick ? styles.rowTop : null,
    inCompare ? styles.rowInCompare : null,
  ] as StyleProp<ViewStyle>);

  return (
    <Link
      href={{ pathname: "/card/[id]", params: { id: `${item.bank}||${item.card}` } }}
      asChild
      onPress={() =>
        track("card_open", {
          bank: item.bank,
          card: item.card,
          rank,
          source: "cards_list",
        })
      }
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
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: sc }]}>{scoreInt}</Text>
            <Text style={styles.scoreLabel} numberOfLines={1}>
              {tier}
            </Text>
            <View style={styles.scoreBar}>
              <View
                style={[styles.scoreBarFill, { width: `${scorePct}%`, backgroundColor: sc }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.statsStrip}>
          <Text style={[styles.statVal, styles.statValGreen]} numberOfLines={1}>
            {formatCurrencyShort(windowedSaving)} {savingSuffix}
          </Text>
          <Text style={styles.statSep}>·</Text>
          <Text style={styles.statVal} numberOfLines={1}>
            {item.coveredVenueCount} of {item.totalVenueCount}
          </Text>
          <Text style={styles.statSep}>·</Text>
          <Text style={styles.statVal} numberOfLines={1}>
            {feeText}
          </Text>
        </View>

        <View style={styles.sweetSpot}>
          <Text style={styles.sweetSpotText} numberOfLines={1}>
            {sweetSpot.prefix}
            <Text style={styles.sweetSpotStrong}>{sweetSpot.strong}</Text>
            {sweetSpot.suffix}
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            hitSlop={10}
            disabled={disabled}
            onPress={(e) => {
              e.stopPropagation?.();
              const wasIn = inCompare;
              toggleCompare(cardKey);
              track(wasIn ? "compare_remove" : "compare_add", {
                bank: item.bank,
                card: item.card,
                source: "cards_list",
              });
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

// Annual-fee stat for the strip. Mirrors web's "Annual fee" card-stat cell:
// null → "Not listed", 0 → "Free", waivable → "PKR Xk (waivable)", else short.
function formatFeeStat(item: CardRecommendation): string {
  const status = item.requirementStatus;
  const fee = status?.annualFeePkr;
  if (fee === null || fee === undefined) return "Not listed";
  if (fee === 0) return "Free";
  if (status?.annualFeeWaiverRule) return `${formatCurrencyShort(fee)} (waivable)`;
  return formatCurrencyShort(fee);
}

// Sweet-spot footer copy. Mirrors web's renderSweetSpot(): below the saturation
// bill the user gets the headline %; above it the saving plateaus at the cap.
// No cap in scope → "Uncapped saving at any bill size".
function formatSweetSpot(
  item: CardRecommendation
): { prefix: string; strong: string; suffix: string } {
  if (item.saturationBill === null || item.saturationBill === undefined) {
    return { prefix: "", strong: "Uncapped saving", suffix: " at any bill size" };
  }
  return {
    prefix: "Sweet spot: ",
    strong: `bills ≤ ${formatCurrency(item.saturationBill)}`,
    suffix: "",
  };
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
  body: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  // Stacked score unit on the right of the header — mirrors web's .score-box:
  // integer score (20px, weight 800, color by score) + uppercase tier label +
  // a thin progress bar (track = border, fill width=score% colored by score).
  scoreBox: {
    alignItems: "flex-end",
    width: 78,
    gap: 2,
  },
  scoreNum: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
    lineHeight: typography.size.xl + 2,
  },
  scoreLabel: {
    color: colors.textDim,
    fontSize: 9.5,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  scoreBar: {
    width: 40,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: 1,
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: radii.pill,
  },

  // Banded stats strip below the header — mirrors web's .card-stats-row. A
  // single divider-separated row: <saving> <suffix> · <covered> of <total> ·
  // <fee>. Saving is green so terracotta stays a brand-only accent.
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statVal: {
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    fontVariant: ["tabular-nums"],
  },
  statValGreen: {
    color: colors.green,
    fontWeight: typography.weight.bold,
  },
  statSep: {
    color: colors.borderStrong,
    fontSize: typography.size.xs,
  },

  // Sweet-spot footer — mirrors web's .card-sweet-spot: muted text with a
  // dashed top border and the threshold bold.
  sweetSpot: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
  },
  sweetSpotText: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    fontVariant: ["tabular-nums"],
  },
  sweetSpotStrong: {
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
  },

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
