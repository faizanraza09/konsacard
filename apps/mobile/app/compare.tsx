import { Stack, router } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { computeRecommendations } from "@/lib/algorithms";
import {
  compareRowWinner,
  getCompareRestaurantRows,
  getExclusiveRestaurantCounts,
  type CompareDirection,
} from "@/lib/compare";
import {
  buildCardKey,
  formatCurrency,
  formatRequirementFieldValue,
  formatSavingsAmount,
} from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { useAppStore } from "@/store";
import { CardRecommendation } from "@/types";
import { colors, radii, scoreColor, shadow, spacing, typography } from "@/theme";

// Head-to-head compare screen. Mirrors the web `openCompareModal` surface
// (apps/web/assets/app.js): identity strip per card, a scoreboard of
// category wins, a stat-by-stat grid with row winners flagged, a verdict
// row, and a restaurant-by-restaurant breakdown at the bottom.
//
// Reads `compareList` from the store (max 2). If the user lands here with
// fewer than 2 (deep link / hot reload), we render a short empty state.
export default function CompareScreen() {
  const state = useAppStore();
  const compareList = useAppStore((s) => s.compareList);
  const toggleCompare = useAppStore((s) => s.toggleCompare);
  const clearCompare = useAppStore((s) => s.clearCompare);
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);

  // Compare runs computeRecommendations + per-offer restaurant breakdowns over
  // raw offers. Reached via navigation, so load lazily here.
  useEffect(() => {
    if (!state.data) ensureRawOffers();
  }, [state.data, ensureRawOffers]);

  const recs = useMemo(() => computeRecommendations(state), [state]);
  const cards = useMemo(() => {
    return compareList
      .map((k) => {
        const [bank, card] = k.split(" || ");
        return recs.find((r) => r.bank === bank && r.card === card) || null;
      })
      .filter((c): c is CardRecommendation => c !== null);
  }, [compareList, recs]);

  if (cards.length < 2) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Stack.Screen options={{ title: "Compare" }} />
        {!state.data ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <Text style={styles.empty}>Pick two cards to compare.</Text>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Go back</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const outingsPerWeek = state.outingsPerWeek;
  const annuals = cards.map((c) => c.avgExpectedSaving * outingsPerWeek * 52);
  const fees = cards.map((c) => c.requirementStatus?.annualFeePkr ?? null);
  const nets = cards.map((c, i) => (fees[i] !== null ? annuals[i] - (fees[i] as number) : null));
  const salaryReqs = cards.map((c) => c.requirementStatus?.salaryReq ?? null);
  const balanceReqs = cards.map((c) => c.requirementStatus?.balanceReq ?? null);

  const restaurantRows = useMemo(
    () => getCompareRestaurantRows(state, compareList),
    [state, compareList]
  );
  const exclusive = useMemo(
    () => getExclusiveRestaurantCounts(state, compareList[0], compareList[1]),
    [state, compareList]
  );

  const outLabel = outingsPerWeek === 4 ? "4×+" : `${outingsPerWeek}×`;

  const rows: {
    label: string;
    vals: (number | null)[];
    fmt: (v: number | null, i: number) => string;
    compare: CompareDirection;
  }[] = [
    {
      label: "Fit score",
      vals: cards.map((c) => c.score),
      fmt: (v) => `${(v ?? 0).toFixed(1)} / 100`,
      compare: "high",
    },
    {
      label: "Est. saving / outing",
      vals: cards.map((c) => c.avgExpectedSaving),
      fmt: (v) => formatSavingsAmount(v ?? 0, { per: "outing" }),
      compare: "high",
    },
    {
      label: `Annual saving (${outLabel}/wk)`,
      vals: annuals,
      fmt: (v) => formatSavingsAmount(v ?? 0, { per: "yr" }),
      compare: "high",
    },
    {
      label: "Salary requirement",
      vals: salaryReqs,
      fmt: (_v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "salaryReq"),
      compare: "none",
    },
    {
      label: "Minimum balance",
      vals: balanceReqs,
      fmt: (_v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "balanceReq"),
      compare: "none",
    },
    {
      label: "Annual fee",
      vals: fees,
      fmt: (_v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "annualFeePkr"),
      compare: "low",
    },
    ...(nets.some((n) => n !== null)
      ? ([
          {
            label: "Net annual saving",
            vals: nets,
            fmt: (_v: number | null, i: number) =>
              nets[i] !== null
                ? formatSavingsAmount(nets[i] as number, { per: "yr", signed: true })
                : "—",
            compare: "high" as CompareDirection,
          },
        ] as const)
      : []),
    {
      label: "Restaurants matched",
      vals: cards.map((c) => c.coveredVenueCount),
      fmt: (v) => `${v ?? 0} of ${cards[0].totalVenueCount}`,
      compare: "high",
    },
    {
      label: "Exclusive restaurants",
      vals: exclusive,
      fmt: (v) => ((v ?? 0) > 0 ? `${v} only here` : "—"),
      compare: "high",
    },
    {
      label: "Avg discount",
      vals: cards.map((c) => c.averageDiscount ?? 0),
      fmt: (v) => ((v ?? 0) ? `${(v as number).toFixed(1)}%` : "—"),
      compare: "high",
    },
  ];

  const wins: [number, number] = [0, 0];
  rows.forEach((row) => {
    const w = compareRowWinner(row.vals, row.compare);
    if (w === 0 || w === 1) wins[w]++;
  });
  const verdictIndex =
    wins[0] === wins[1] ? (cards[0].score >= cards[1].score ? 0 : 1) : wins[0] > wins[1] ? 0 : 1;

  const sharedCount = restaurantRows.filter((r) => r.entries.every(Boolean)).length;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Stack.Screen
        options={{
          title: "Head-to-head",
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable
              hitSlop={10}
              onPress={() => {
                clearCompare();
                router.back();
              }}
              style={{ marginRight: spacing.md }}
            >
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Clear</Text>
            </Pressable>
          ),
        }}
      />

      {/* Identity strip — two cards, side by side. */}
      <View style={styles.idRow}>
        {cards.map((c, i) => (
          <View key={c.bank + c.card} style={[styles.idCol, i === 0 ? styles.idColLeft : styles.idColRight]}>
            <BankLogo bank={c.bank} />
            <Text style={styles.cardName} numberOfLines={2}>{c.card}</Text>
            <Text style={styles.bankName} numberOfLines={1}>{c.bank}</Text>
            <View style={styles.scoreBarTrack}>
              <View
                style={[
                  styles.scoreBarFill,
                  { width: `${Math.min(100, Math.max(0, c.score))}%`, backgroundColor: scoreColor(c.score) },
                ]}
              />
            </View>
            <Text style={[styles.scoreText, { color: scoreColor(c.score) }]}>
              {c.score.toFixed(1)}{" "}
              <Text style={styles.scoreOf}>/ 100</Text>
            </Text>
            <Pressable
              hitSlop={6}
              onPress={() => toggleCompare(buildCardKey(c.bank, c.card))}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        <Text style={styles.scoreboardTally}>
          {wins[0]} <Text style={styles.scoreboardVs}>vs</Text> {wins[1]}
        </Text>
        <Text style={styles.scoreboardLabel}>CATEGORIES WON</Text>
      </View>

      {/* Stat-by-stat grid */}
      <View style={styles.grid}>
        {rows.map((row, i) => {
          const winner = compareRowWinner(row.vals, row.compare);
          const stripe = i % 2 === 0 ? styles.gridRowAlt : null;
          return (
            <View key={row.label} style={[styles.gridRow, stripe]}>
              <Text style={styles.gridLabel}>{row.label}</Text>
              <View style={styles.gridVals}>
                {[0, 1].map((idx) => {
                  const isWinner = winner === idx;
                  const isLoser = winner === 1 - idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.gridVal,
                        idx === 0 ? styles.gridValLeft : styles.gridValRight,
                        isWinner && styles.gridValWin,
                        isLoser && styles.gridValLose,
                      ]}
                    >
                      <Text
                        style={[
                          styles.gridValText,
                          isWinner && styles.gridValTextWin,
                          isLoser && styles.gridValTextLose,
                        ]}
                        numberOfLines={2}
                      >
                        {row.fmt(row.vals[idx], idx)}
                      </Text>
                      {isWinner ? <Text style={styles.betterBadge}>Better</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* Verdict */}
      <View style={styles.verdict}>
        <Text style={styles.verdictLabel}>🏆 Verdict</Text>
        <Text style={styles.verdictName} numberOfLines={2}>{cards[verdictIndex].card}</Text>
        <Text style={styles.verdictSub}>
          Wins {wins[verdictIndex]} of {wins[0] + wins[1]} categories · ~
          {formatCurrency(annuals[verdictIndex])} / yr ·{" "}
          {Math.abs(cards[0].score - cards[1].score).toFixed(1)} pts ahead
        </Text>
      </View>

      {/* Restaurant-by-restaurant */}
      <View style={styles.restSection}>
        <Text style={styles.restTitle}>Restaurant-by-restaurant</Text>
        <Text style={styles.restSub}>
          {sharedCount} shared · {restaurantRows.length} total in current filters
        </Text>
        {restaurantRows.slice(0, 25).map((row) => (
          <View key={row.venueKey} style={styles.restRow}>
            <View style={styles.restVenue}>
              <Text style={styles.restName} numberOfLines={1}>{row.restaurant}</Text>
              <Text style={styles.restCity}>{row.city}</Text>
            </View>
            <View style={styles.restCardsRow}>
              {[0, 1].map((idx) => {
                const entry = row.entries[idx];
                return (
                  <View key={idx} style={[styles.restCard, !entry && styles.restCardEmpty]}>
                    {entry ? (
                      <>
                        <Text style={styles.restPct} numberOfLines={1}>
                          {entry.discountLabel || "—"}
                        </Text>
                        <Text style={styles.restSaving} numberOfLines={1}>
                          {formatCurrency(entry.saving)}
                        </Text>
                        <Text style={styles.restMeta} numberOfLines={1}>
                          {entry.daysLabel}
                          {entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.restPct}>—</Text>
                        <Text style={styles.restMeta}>No active deal</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
        {restaurantRows.length > 25 ? (
          <Text style={styles.restMore}>
            +{restaurantRows.length - 25} more restaurants. Narrow filters to compare a shorter list.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function BankLogo({ bank }: { bank: string }) {
  const url = getBankLogoUrl(bank);
  if (!url) {
    return (
      <View style={[styles.logoWrap, { backgroundColor: colors.bgSubtle }]}>
        <Text style={styles.logoFallback}>{bank.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <View style={styles.logoWrap}>
      <Image source={{ uri: url }} style={{ width: "78%", height: "78%" }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 60 },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.textMuted, fontSize: typography.size.md, marginBottom: spacing.md },
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  backBtnText: { color: colors.textOnBrand, fontWeight: typography.weight.bold },

  idRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  idCol: {
    flex: 1,
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
    ...shadow.card,
  },
  idColLeft: { backgroundColor: colors.brandLight },
  idColRight: { backgroundColor: colors.toneEligibleBg },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoFallback: { color: colors.textMuted, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  cardName: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: "center",
  },
  bankName: { color: colors.textDim, fontSize: typography.size.xs },
  scoreBarTrack: {
    height: 4,
    width: "80%",
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  scoreBarFill: { height: 4 },
  scoreText: { fontSize: typography.size.xl, fontWeight: typography.weight.black, marginTop: 2 },
  scoreOf: { fontSize: typography.size.xs, color: colors.textDim, fontWeight: typography.weight.medium },
  removeBtn: { marginTop: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  removeBtnText: { color: colors.textDim, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  scoreboard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  scoreboardTally: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  scoreboardVs: { color: colors.textDim, fontSize: typography.size.md, fontWeight: typography.weight.regular },
  scoreboardLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.6,
    marginTop: 2,
  },

  grid: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  gridRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  gridRowAlt: { backgroundColor: colors.bgSubtle },
  gridLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  gridVals: { flexDirection: "row", gap: spacing.sm },
  gridVal: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  gridValLeft: {},
  gridValRight: {},
  gridValWin: { backgroundColor: colors.toneEligibleBg, borderColor: colors.toneEligible },
  gridValLose: { opacity: 0.6 },
  gridValText: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  gridValTextWin: { color: colors.toneEligible },
  gridValTextLose: {},
  betterBadge: {
    marginTop: 2,
    color: colors.toneEligible,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  verdict: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brandMid,
    borderRadius: radii.lg,
  },
  verdictLabel: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  verdictName: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    marginTop: 4,
  },
  verdictSub: { color: colors.textMuted, fontSize: typography.size.xs, marginTop: 4, lineHeight: 16 },

  restSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restTitle: { color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  restSub: { color: colors.textDim, fontSize: typography.size.xs, marginTop: 2, marginBottom: spacing.sm },
  restRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  restVenue: { marginBottom: spacing.xs },
  restName: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  restCity: { color: colors.textDim, fontSize: typography.size.xs },
  restCardsRow: { flexDirection: "row", gap: spacing.sm },
  restCard: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.md,
  },
  restCardEmpty: { opacity: 0.55 },
  restPct: { color: colors.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  restSaving: {
    color: colors.brand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  restMeta: { color: colors.textDim, fontSize: 10, marginTop: 1 },
  restMore: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
