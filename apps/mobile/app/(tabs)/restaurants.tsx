import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RestaurantDeal } from "@/components/RestaurantRow";
import { StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { ResultsHeader } from "@/components/ResultsHeader";
import { RestaurantRow } from "@/components/RestaurantRow";
import { TopBar } from "@/components/TopBar";
import { computeRestaurantDeals } from "@/lib/restaurants";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

export default function RestaurantsScreen() {
  const state = useAppStore();
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<RestaurantDeal>>(null);
  const [search, setSearch] = useState("");

  const allDeals = useMemo(() => computeRestaurantDeals(state), [state]);
  const deals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDeals;
    return allDeals.filter((d) => d.restaurant.toLowerCase().includes(q));
  }, [allDeals, search]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state.selectedCity, search]);

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
        />
      </View>
      <FilterSheet ref={sheet} matchCount={deals.length} matchLabel="restaurants" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
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
