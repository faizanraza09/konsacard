import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type { CardRecommendation } from "@/types";
import * as Haptics from "expo-haptics";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { CardRow } from "@/components/CardRow";
import { CompareTray } from "@/components/CompareTray";
import { FavoritesAlert } from "@/components/FavoritesAlert";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { FreshnessChip } from "@/components/FreshnessChip";
import { ResultsHeader } from "@/components/ResultsHeader";
import { TopBar } from "@/components/TopBar";
import { WelcomeStrip } from "@/components/WelcomeStrip";
import { computeRecommendations } from "@/lib/algorithms";
import { evaluateEligibility } from "@/lib/eligibility";
import { normalizeCityValue } from "@/lib/format";
import { loadOffers, loadRequirements, loadSummary } from "@/data";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import type { AppState } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

// True when the current state matches how the summary was precomputed, so the
// summary's cards are valid to render without loading raw offers. Mirrors the
// parity-test default: scope ∈ summary.scopes, orderValue === summary.orderValue,
// no filters, no salary/balance, eligibility off.
function isDefaultSummaryScope(state: AppState): boolean {
  const summary = state.summary;
  if (!summary) return false;
  const cityKey = normalizeCityValue(state.selectedCity);
  if (!summary.scopes[cityKey]) return false;
  return (
    state.orderValue === summary.orderValue &&
    state.selectedDays.size === 0 &&
    state.selectedRestaurants.size === 0 &&
    state.selectedBanks.size === 0 &&
    state.selectedCardTypes.size === 0 &&
    state.selectedCuisines.size === 0 &&
    state.selectedCards.size === 0 &&
    state.monthlySalary === null &&
    state.accountBalance === null &&
    !state.useEligibility
  );
}

// createAnimatedComponent strips the FlashList generic; cast back so renderItem
// and keyExtractor pick up the CardRecommendation type the data is.
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as unknown as typeof FlashList;

// Distance over which the welcome strip fades out as the user scrolls. After
// FADE_END pixels of scroll, the strip is fully collapsed (height 0, opacity
// 0), giving the list more space and avoiding the "always there, never read"
// problem of a persistent header.
const FADE_END = 80;
const STRIP_MAX_HEIGHT = 72;

export default function CardsScreen() {
  const state = useAppStore();
  const deferredState = useDeferredValue(state);
  const setData = useAppStore((s) => s.setData);
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const rawLoading = useAppStore((s) => s.rawLoading);
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<CardRecommendation>>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Cold-start path: when raw offers aren't loaded yet, the scope is default,
  // and we have a summary, render straight from the precomputed summary. We
  // only attach requirementStatus (eligibility post-processing) + a zero
  // qualificationDelta; we do NOT re-sort (the summary order is already correct).
  const summaryRecs = useMemo<CardRecommendation[] | null>(() => {
    if (deferredState.data) return null;
    if (!isDefaultSummaryScope(deferredState)) return null;
    const summary = deferredState.summary!;
    const cityKey = normalizeCityValue(deferredState.selectedCity);
    return summary.scopes[cityKey].map((c) => ({
      ...c,
      requirementStatus: evaluateEligibility(deferredState, c.bank, c.card),
      qualificationDelta: 0,
    }));
  }, [deferredState]);

  // Whenever the scope leaves default (filters/eligibility/order value) and raw
  // offers aren't loaded, kick off the lazy raw load so computeRecommendations
  // can run. Idempotent + in-flight-shared at the store level.
  const needsRaw = !state.data && summaryRecs === null;
  useEffect(() => {
    if (needsRaw) ensureRawOffers();
  }, [needsRaw, ensureRawOffers]);

  const computedRecs = useMemo(
    () => (deferredState.data ? computeRecommendations(deferredState) : []),
    [deferredState]
  );
  const allRecs = summaryRecs ?? computedRecs;
  // "Recomputing" overlay: deferred lag while React catches up, OR we're
  // waiting on the lazy raw load to satisfy a non-default scope.
  const recomputing = state !== deferredState || (needsRaw && rawLoading);
  const recs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRecs;
    return allRecs.filter(
      (r) => r.card.toLowerCase().includes(q) || r.bank.toLowerCase().includes(q)
    );
  }, [allRecs, search]);
  const topPick = recs[0] ?? null;
  const compareCount = useAppStore((s) => s.compareList.length);
  const cityLabel =
    state.selectedCity === "all"
      ? "All cities"
      : state.selectedCity.charAt(0).toUpperCase() + state.selectedCity.slice(1);

  // Reset list scroll when the city tab changes so the new list reads from the
  // top, not from wherever the previous city left off.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state.selectedCity, search]);

  // Debounced search analytics — fire once the user settles on a query for
  // ~600ms, not once per keystroke. Empty queries don't fire.
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    const t = setTimeout(() => {
      track("search_submit", {
        surface: "cards_list",
        query: q.toLowerCase(),
        result_count: recs.length,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [search, recs.length]);

  const activeFilters =
    state.selectedDays.size +
    state.selectedRestaurants.size +
    state.selectedBanks.size +
    state.selectedCardTypes.size +
    state.selectedCuisines.size +
    (state.monthlySalary !== null ? 1 : 0) +
    (state.accountBalance !== null ? 1 : 0);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const stripStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, FADE_END],
      [1, 0],
      Extrapolation.CLAMP
    );
    const height = interpolate(
      scrollY.value,
      [0, FADE_END],
      [STRIP_MAX_HEIGHT, 0],
      Extrapolation.CLAMP
    );
    return { opacity, height, overflow: "hidden" };
  });

  const setSummary = useAppStore((s) => s.setSummary);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync().catch(() => undefined);
    try {
      // Always refresh the cheap summary + requirements. If raw offers are
      // already in memory (user has been filtering), refresh those too.
      const hadRaw = !!useAppStore.getState().data;
      const [summaryResult, reqs, bundle] = await Promise.all([
        loadSummary().catch(() => null),
        loadRequirements(),
        hadRaw ? loadOffers() : Promise.resolve(null),
      ]);
      if (summaryResult) setSummary(summaryResult);
      if (bundle) setData(bundle, reqs);
      else useAppStore.setState({ requirements: reqs });
    } finally {
      setRefreshing(false);
    }
  }, [setData, setSummary]);

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <TopBar />
      <FavoritesAlert />
      <FreshnessChip />
      <CityTabs />
      <Animated.View style={stripStyle}>
        <WelcomeStrip topPick={topPick} cityLabel={cityLabel} />
      </Animated.View>
      <ResultsHeader
        count={recs.length}
        countLabel={`${recs.length === 1 ? "card" : "cards"} to choose from`}
        subtitle="Best savings first"
        filterOpenCount={activeFilters}
        onPressFilters={() => {
          Haptics.selectionAsync().catch(() => undefined);
          // The filter sheet's bank/restaurant/cuisine sections read raw
          // offers; make sure they're loading before the sheet opens.
          ensureRawOffers();
          sheet.current?.open();
        }}
      />
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${allRecs.length} cards or banks…`}
          placeholderTextColor={colors.textDim}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <View style={styles.flex}>
        <AnimatedFlashList
          ref={listRef as unknown as React.Ref<FlashListRef<CardRecommendation>>}
          data={recs}
          renderItem={({ item, index }) => <CardRow item={item} rank={index + 1} />}
          keyExtractor={(item) => `${item.bank}||${item.card}`}
          contentContainerStyle={{
            paddingTop: 4,
            // Bump the bottom inset while the compare tray is floating so the
            // last card can scroll fully into view above it. Tray height with
            // two stacked chips is ~120, plus the 8px gap to the tab bar.
            paddingBottom: compareCount > 0 ? 144 : 24,
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
        />
        {recomputing ? (
          <View style={styles.recomputing} pointerEvents="none">
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}
      </View>
      <FilterSheet ref={sheet} matchCount={recs.length} matchLabel="cards" />
      <CompareTray />
    </SafeAreaView>
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
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.bgElev,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.text,
  },
});
