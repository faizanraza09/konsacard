import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type { CardRecommendation } from "@/types";
import * as Haptics from "expo-haptics";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  // promo banner removed for now — see WelcomeStrip. These hooks drove the
  // strip's scroll-fade; restore alongside the WelcomeStrip render.
  // Extrapolation,
  // interpolate,
  // useAnimatedScrollHandler,
  // useAnimatedStyle,
  // useSharedValue,
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
// promo banner removed for now — see WelcomeStrip
// import { WelcomeStrip } from "@/components/WelcomeStrip";
import { cachedRecommendations } from "@/lib/computeCache";
import { useInteractionReady } from "@/lib/useInteractionReady";
import { evaluateEligibility } from "@/lib/eligibility";
import { normalizeCityValue } from "@/lib/format";
import { loadOffers, loadRequirements, loadSummary, rankApiEnabled, rankViaApi } from "@/data";
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

// promo banner removed for now — see WelcomeStrip. Fade constants kept for an
// easy restore.
// const FADE_END = 80;
// const STRIP_MAX_HEIGHT = 72;

// Stable empty list so a deferred/empty compute doesn't churn downstream memos.
const EMPTY_RECS: CardRecommendation[] = [];

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

  // The cache signature captures every algorithm input that changes the
  // result. We reuse it both for the local compute cache and to key API
  // responses so a stale response for a previous scope is ignored.
  const recsKey = cachedRecommendations.key(deferredState);

  // ---- Server ranking API path -------------------------------------------
  // For a non-default scope, when the API is enabled, fetch the (already
  // scored/sorted/eligibility-baked) ranking from the server instead of
  // parsing the 21 MB raw bundle on the phone. We debounce settings changes
  // ~250ms, ignore out-of-order responses by comparing the response's key to
  // the current one, and on ANY failure (offline, timeout, non-2xx) flag this
  // key as "fell back" so the local raw path takes over.
  const apiEnabled = rankApiEnabled();
  // Only the API path applies when we have no raw data, aren't at the default
  // (summary-served) scope, and the flag is on.
  const apiScope = apiEnabled && !state.data && summaryRecs === null;
  const [apiRecs, setApiRecs] = useState<{ key: string; recs: CardRecommendation[] } | null>(null);
  // Keys whose API call failed/timed out — fall back to raw for these. The ref
  // holds the durable set; the counter bump is only to force a re-render when a
  // failure flips the resolution from API → raw for the current key.
  const fellBackRef = useRef<Set<string>>(new Set());
  const [, bumpFellBack] = useState(0);

  const apiHit = apiScope && apiRecs?.key === recsKey ? apiRecs.recs : null;
  const apiFellBack = apiScope && fellBackRef.current.has(recsKey);
  const apiInFlight = apiScope && apiHit === null && !apiFellBack;

  useEffect(() => {
    if (!apiScope) return;
    if (apiRecs?.key === recsKey) return; // already have a response for this scope
    if (fellBackRef.current.has(recsKey)) return; // already failed → raw path owns it
    let cancelled = false;
    const controller = new AbortController();
    const t = setTimeout(() => {
      rankViaApi(deferredState, { signal: controller.signal })
        .then((recs) => {
          if (cancelled) return; // scope changed before the response landed
          setApiRecs({ key: recsKey, recs });
        })
        .catch(() => {
          if (cancelled) return;
          // Offline / timeout / disabled-server → fall back to raw for this key.
          fellBackRef.current.add(recsKey);
          bumpFellBack((n) => n + 1);
        });
    }, 250);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(t);
    };
    // recsKey captures every input that affects the result; deferredState is
    // read fresh inside but the effect only re-runs when the scope key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiScope, recsKey]);

  // ---- Local raw compute (offline fallback) ------------------------------
  // We only load + compute on raw offers when the API can't serve this scope:
  // the flag is off, raw data is already present, or the API failed for this
  // key. Crucially we do NOT call ensureRawOffers() while an API request is in
  // flight, so the online path never eagerly parses the 21 MB bundle.
  const needsRaw =
    !state.data &&
    summaryRecs === null &&
    (!apiEnabled || (apiScope && apiFellBack));
  useEffect(() => {
    if (needsRaw) ensureRawOffers();
  }, [needsRaw, ensureRawOffers]);

  // Heavy recommendation compute, served from the module-level cache. Keyed on
  // the cache signature (only the inputs that change the result) so unrelated
  // state churn — toggling compare, loading flags — no longer recomputes, and
  // revisiting a city/scope you've already seen is an instant cache hit. On a
  // genuine cache miss we defer the work past the screen transition (ready),
  // showing the recomputing spinner meanwhile so navigation stays smooth.
  const ready = useInteractionReady();
  const { recs: computedRecs, pending: recsPending } = useMemo(() => {
    if (!deferredState.data) return { recs: EMPTY_RECS, pending: false };
    const hit = cachedRecommendations.peek(deferredState);
    if (hit) return { recs: hit, pending: false };
    if (!ready) return { recs: EMPTY_RECS, pending: true };
    return { recs: cachedRecommendations(deferredState), pending: false };
    // recsKey captures every input that affects the result; deferredState is
    // read fresh inside but only re-run when the key or readiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recsKey, ready]);
  // Resolution order: default scope → summary; non-default + API → server recs;
  // non-default + fallback → local compute.
  const allRecs = summaryRecs ?? apiHit ?? computedRecs;
  // "Recomputing" overlay: deferred lag while React catches up, an in-flight
  // API request, the lazy raw load for a fallback scope, or a deferred first
  // local compute of a new scope.
  const recomputing =
    state !== deferredState ||
    apiInFlight ||
    (needsRaw && rawLoading) ||
    recsPending;
  const recs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRecs;
    return allRecs.filter(
      (r) => r.card.toLowerCase().includes(q) || r.bank.toLowerCase().includes(q)
    );
  }, [allRecs, search]);
  const compareCount = useAppStore((s) => s.compareList.length);
  // promo banner removed for now — see WelcomeStrip
  // const topPick = recs[0] ?? null;
  // const cityLabel =
  //   state.selectedCity === "all"
  //     ? "All cities"
  //     : state.selectedCity.charAt(0).toUpperCase() + state.selectedCity.slice(1);

  // Reset list scroll when the city tab changes so the new list reads from the
  // top, not from wherever the previous city left off. Key off deferredState
  // (the value the list actually renders), not the immediate state: keying off
  // state.selectedCity fires a commit too early — before the deferred data
  // swaps in — so FlashList's maintainVisibleContentPosition (on by default in
  // v2) re-anchors the new list mid-scroll. The rAF lets the new data lay out
  // first, then we pin it to the top.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [deferredState.selectedCity, search]);

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

  // promo banner removed for now — see WelcomeStrip. The scroll-driven fade
  // existed only to collapse the strip; restore alongside the WelcomeStrip render.
  // const scrollY = useSharedValue(0);
  // const onScroll = useAnimatedScrollHandler((event) => {
  //   scrollY.value = event.contentOffset.y;
  // });
  //
  // const stripStyle = useAnimatedStyle(() => {
  //   const opacity = interpolate(
  //     scrollY.value,
  //     [0, FADE_END],
  //     [1, 0],
  //     Extrapolation.CLAMP
  //   );
  //   const height = interpolate(
  //     scrollY.value,
  //     [0, FADE_END],
  //     [STRIP_MAX_HEIGHT, 0],
  //     Extrapolation.CLAMP
  //   );
  //   return { opacity, height, overflow: "hidden" };
  // });

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
      {/* promo banner removed for now — see WelcomeStrip
      <Animated.View style={stripStyle}>
        <WelcomeStrip topPick={topPick} cityLabel={cityLabel} />
      </Animated.View>
      */}
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
          // This is a re-sorted ranking list, not a chat feed. FlashList v2
          // enables maintainVisibleContentPosition by default, which anchors
          // scroll to a key-stable row across data changes — so switching city
          // jumps to wherever the previously-top card now ranks (e.g. #9)
          // instead of the top. Disable it; we reset to the top explicitly.
          maintainVisibleContentPosition={{ disabled: true }}
          contentContainerStyle={{
            paddingTop: 4,
            // Bump the bottom inset while the compare tray is floating so the
            // last card can scroll fully into view above it. Tray height with
            // two stacked chips is ~120, plus the 8px gap to the tab bar.
            paddingBottom: compareCount > 0 ? 144 : 24,
          }}
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
