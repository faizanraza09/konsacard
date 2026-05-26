import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useEffect, useMemo, useRef } from "react";
import type { RestaurantDeal } from "@/components/RestaurantRow";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { ResultsHeader } from "@/components/ResultsHeader";
import { RestaurantRow } from "@/components/RestaurantRow";
import { TopBar } from "@/components/TopBar";
import { computeRestaurantDeals } from "@/lib/restaurants";
import { useAppStore } from "@/store";
import { colors } from "@/theme";

export default function RestaurantsScreen() {
  const state = useAppStore();
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<RestaurantDeal>>(null);

  const deals = useMemo(() => computeRestaurantDeals(state), [state]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state.selectedCity]);

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
});
