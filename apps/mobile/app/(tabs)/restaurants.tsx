import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { RestaurantDeal } from "@/components/RestaurantRow";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { ResultsHeader } from "@/components/ResultsHeader";
import { RestaurantRow } from "@/components/RestaurantRow";
import { TopBar } from "@/components/TopBar";
import { cachedRestaurantDeals } from "@/lib/computeCache";
import { useInteractionReady } from "@/lib/useInteractionReady";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

// Stable empty list so a deferred/empty compute doesn't churn downstream memos.
const EMPTY_DEALS: RestaurantDeal[] = [];

export default function RestaurantsScreen() {
  const state = useAppStore();
  const deferredState = useDeferredValue(state);
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<RestaurantDeal>>(null);
  const [search, setSearch] = useState("");

  // This tab always needs raw offers (per-offer restaurant aggregation, no
  // precompute). Load them lazily on mount if the cold-start summary path
  // hasn't already triggered it.
  useEffect(() => {
    if (!state.data) ensureRawOffers();
  }, [state.data, ensureRawOffers]);

  // Cached restaurant deals (see computeCache). The nested recommendations pass
  // reuses the Cards-tab cache. Keyed on the cache signature so unrelated state
  // churn doesn't recompute, and revisiting a scope is instant. Defer the first
  // uncached compute past the screen transition.
  const ready = useInteractionReady();
  const dealsKey = cachedRestaurantDeals.key(deferredState);
  const { deals: allDeals, pending: dealsPending } = useMemo(() => {
    if (!deferredState.data) return { deals: EMPTY_DEALS, pending: false };
    const hit = cachedRestaurantDeals.peek(deferredState);
    if (hit) return { deals: hit, pending: false };
    if (!ready) return { deals: EMPTY_DEALS, pending: true };
    return { deals: cachedRestaurantDeals(deferredState), pending: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealsKey, ready]);
  const recomputing =
    state !== deferredState || (!state.data && state.rawLoading) || dealsPending;
  const deals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDeals;
    return allDeals.filter((d) => d.restaurant.toLowerCase().includes(q));
  }, [allDeals, search]);

  // Reset scroll to the top when the city changes. Key off deferredState (what
  // the list renders) and defer a frame, otherwise the reset fires before the
  // deferred data swaps in and FlashList's maintainVisibleContentPosition
  // re-anchors the new list mid-scroll. See index.tsx for the full rationale.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [deferredState.selectedCity, search]);

  // Debounced search analytics — fire once after the user settles on a query
  // for ~600ms instead of per-keystroke. Empty queries don't fire.
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    const t = setTimeout(() => {
      track("search_submit", {
        surface: "restaurants_list",
        query: q.toLowerCase(),
        result_count: deals.length,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [search, deals.length]);

  const activeFilters =
    state.selectedDays.size +
    state.selectedRestaurants.size +
    state.selectedBanks.size +
    state.selectedCardTypes.size +
    state.selectedCuisines.size +
    (state.monthlySalary !== null ? 1 : 0) +
    (state.accountBalance !== null ? 1 : 0);

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <TopBar />
      <CityTabs />
      <ResultsHeader
        count={deals.length}
        countLabel={`${deals.length === 1 ? "restaurant" : "restaurants"} with deals`}
        subtitle="Best card per restaurant, sorted by saving"
        filterOpenCount={activeFilters}
        onPressFilters={() => sheet.current?.open()}
      />
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${allDeals.length} restaurants…`}
          placeholderTextColor={colors.textDim}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <View style={styles.flex}>
        <FlashList
          ref={listRef}
          data={deals}
          renderItem={({ item }) => <RestaurantRow item={item} />}
          keyExtractor={(item) => `${item.city}|||${item.restaurant}`}
          contentContainerStyle={styles.list}
          // Re-sorted ranking list: disable FlashList v2's default
          // maintainVisibleContentPosition so a city switch doesn't anchor to a
          // key-stable row mid-list. We reset to the top explicitly. (index.tsx)
          maintainVisibleContentPosition={{ disabled: true }}
        />
        {recomputing ? (
          <View style={styles.recomputing} pointerEvents="none">
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}
      </View>
      <FilterSheet ref={sheet} matchCount={deals.length} matchLabel="restaurants" />
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
  list: { paddingBottom: 80, paddingTop: 4 },
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
