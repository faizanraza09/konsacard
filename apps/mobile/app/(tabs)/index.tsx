import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type { CardRecommendation } from "@/types";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, TextInput, View } from "react-native";
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
import { loadOffers, loadRequirements } from "@/data";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

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
  const setData = useAppStore((s) => s.setData);
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<CardRecommendation>>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const allRecs = useMemo(() => computeRecommendations(state), [state]);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync().catch(() => undefined);
    try {
      const [bundle, reqs] = await Promise.all([loadOffers(), loadRequirements()]);
      setData(bundle, reqs);
    } finally {
      setRefreshing(false);
    }
  }, [setData]);

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
      </View>
      <FilterSheet ref={sheet} matchCount={recs.length} matchLabel="cards" />
      <CompareTray />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
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
