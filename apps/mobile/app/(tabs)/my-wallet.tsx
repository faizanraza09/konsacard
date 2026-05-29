import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { OwnedCardPicker } from "@/components/OwnedCardPicker";
import { ResultsHeader } from "@/components/ResultsHeader";
import { TopBar } from "@/components/TopBar";
import { computeNextCardRecommendations } from "@/lib/algorithms";
import { formatCurrency } from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { useAppStore } from "@/store";
import { NextCardRecommendation } from "@/types";
import {
  colors,
  eligibilityTone,
  radii,
  scoreColor,
  shadow,
  spacing,
  typography,
} from "@/theme";

export default function MyWalletScreen() {
  const state = useAppStore();
  const deferredState = useDeferredValue(state);
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const sheet = useRef<FilterSheetHandle>(null);

  // Next-card recommendations run over raw offers; load them lazily on mount.
  useEffect(() => {
    if (!state.data) ensureRawOffers();
  }, [state.data, ensureRawOffers]);

  const result = useMemo(() => computeNextCardRecommendations(deferredState), [deferredState]);
  const recomputing = state !== deferredState || (!state.data && state.rawLoading);

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <TopBar />
      <CityTabs />
      <ResultsHeader
        count={result.ranked.length}
        countLabel="cards to add next"
        subtitle={
          state.ownedCards.size > 0
            ? `Your wallet covers ${result.stats.wallet?.coveredVenues ?? 0} of ${result.stats.venuesInScope} venues`
            : "Add the cards you own to unlock personal picks"
        }
        onPressFilters={() => sheet.current?.open()}
      />
      <View style={styles.flex}>
        <FlashList
          data={result.ranked}
          ListHeaderComponent={
            <View style={styles.setup}>
              <OwnedCardPicker />
              {state.ownedCards.size > 0 && result.stats.wallet ? (
                <View style={styles.walletStats}>
                  <WalletStat label="Per outing" value={formatCurrency(result.stats.wallet.perOuting)} />
                  <WalletStat label="Coverage" value={`${Math.round(result.stats.wallet.coverage * 100)}%`} />
                  <WalletStat label="Est. yearly" value={formatCurrency(result.stats.wallet.yearly)} />
                </View>
              ) : null}
            </View>
          }
          keyExtractor={(item) => `${item.bank}||${item.card}`}
          renderItem={({ item, index }) => <NextCardRow item={item} rank={index + 1} />}
          contentContainerStyle={styles.list}
        />
        {recomputing ? (
          <View style={styles.recomputing} pointerEvents="none">
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}
      </View>
      <FilterSheet ref={sheet} matchCount={result.ranked.length} matchLabel="picks" />
    </SafeAreaView>
  );
}

// Compact next-card recommendation row. Mirrors CardRow's 3-line shape so
// users get the same visual rhythm across tabs; differs only in that the
// "saving" here is a *marginal delta* (+PKR over what the user's wallet
// already saves) rather than absolute savings.
function NextCardRow({ item, rank }: { item: NextCardRecommendation; rank: number }) {
  const isTopPick = rank === 1;
  const rowStyle = StyleSheet.flatten<ViewStyle>([
    styles.row,
    isTopPick ? styles.rowTop : null,
  ] as StyleProp<ViewStyle>);
  const categoryLabel = item.cardCategory
    ? item.cardCategory.charAt(0).toUpperCase() + item.cardCategory.slice(1)
    : null;
  const tone = eligibilityTone(item.requirementStatus.tone);
  const elig = compactEligibilityLabel(item.requirementStatus.label);

  return (
    <Link
      href={{ pathname: "/card/[id]", params: { id: `${item.bank}||${item.card}` } }}
      asChild
    >
      <Pressable style={rowStyle}>
        {isTopPick ? (
          <View style={styles.topRibbon}>
            <Text style={styles.topRibbonText}>BIGGEST UPSIDE</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <BankLogo bank={item.bank} />
          <View style={styles.titleCol}>
            <Text style={[styles.cardName, isTopPick && styles.cardNameTop]} numberOfLines={1}>
              {item.card}
            </Text>
            <Text style={styles.subline} numberOfLines={1}>
              <Text style={styles.bankBold}>{item.bank}</Text>
              {categoryLabel ? ` · ${categoryLabel}` : ""}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.eligDot, { backgroundColor: tone.color }]} />
              <Text style={[styles.eligText, { color: tone.color }]} numberOfLines={1}>
                {elig}
              </Text>
              {!isTopPick ? <Text style={styles.rankTag}>#{rank}</Text> : null}
            </View>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.savingValue} numberOfLines={1}>
              +{formatCurrency(item.avgDeltaPerOuting)}
            </Text>
            <Text style={styles.savingUnit}>/outing</Text>
            <Text style={[styles.scoreNum, { color: scoreColor(item.score) }]}>
              {item.score.toFixed(1)}
            </Text>
          </View>
        </View>

        {isTopPick ? (
          <Text style={styles.bottomLine} numberOfLines={1}>
            <Text style={styles.bottomBold}>{item.newVenues}</Text> new venue
            {item.newVenues === 1 ? "" : "s"}
            {" · est. "}
            <Text style={styles.bottomBold}>{formatCurrency(item.yearlyDelta)}</Text>/yr
            {item.topVenueWins[0] ? ` · top: ${item.topVenueWins[0].restaurant}` : ""}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function compactEligibilityLabel(label: string): string {
  if (label === "Salary/balance not entered") return "Add salary to check";
  if (label === "Est. requirements exist") return "Approx. eligible";
  if (label === "Requirements unclear") return "Requirements unclear";
  return label;
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

function WalletStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxLabel}>{label}</Text>
      <Text style={styles.statBoxValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  recomputing: {
    position: "absolute",
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  list: { paddingBottom: 80, paddingTop: 4 },

  setup: {
    backgroundColor: colors.bgElev,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  walletStats: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  statBoxLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statBoxValue: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },

  row: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowTop: {
    backgroundColor: colors.bgTint,
    borderColor: colors.brandMid,
    paddingTop: spacing.sm,
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
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  eligDot: { width: 7, height: 7, borderRadius: 4 },
  eligText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  rankTag: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginLeft: spacing.xs,
  },

  statCol: {
    alignItems: "flex-end",
    minWidth: 96,
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
  scoreNum: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
    opacity: 0.85,
    marginTop: 4,
  },

  bottomLine: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginTop: spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  bottomBold: { color: colors.text, fontWeight: typography.weight.bold },
});
