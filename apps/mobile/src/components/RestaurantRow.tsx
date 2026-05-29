import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

export interface RestaurantDeal {
  restaurant: string;
  city: string;
  bestSaving: number;
  bestCard: string;
  bestBank: string;
  bestDiscountPct: number | null;
  bestDiscountLabel?: string;
  offerCount: number;
}

export function RestaurantRow({ item }: { item: RestaurantDeal }) {
  const fav = useAppStore((s) => s.favoriteRestaurants.has(item.restaurant));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const logoUrl = getBankLogoUrl(item.bestBank);

  return (
    <Link
      href={{ pathname: "/restaurant/[name]", params: { name: item.restaurant, city: item.city } }}
      asChild
      onPress={() =>
        track("restaurant_open", {
          restaurant: item.restaurant,
          city: item.city,
          offer_count: item.offerCount,
          best_saving_pkr: item.bestSaving,
          source: "restaurants_list",
        })
      }
    >
      <Pressable style={styles.row}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.restaurant} numberOfLines={1}>{item.restaurant}</Text>
            <Text style={styles.city}>{item.city.toUpperCase()} · {item.offerCount} offer{item.offerCount === 1 ? "" : "s"}</Text>
          </View>
          <Pressable
            hitSlop={12}
            onPress={(e) => {
              e.stopPropagation?.();
              const wasFav = fav;
              toggleFavorite(item.restaurant);
              track("restaurant_favorite_toggle", {
                restaurant: item.restaurant,
                city: item.city,
                on: !wasFav,
                source: "restaurants_list",
              });
            }}
            style={styles.starBtn}
          >
            <Text style={{ fontSize: 22, color: fav ? colors.brand : colors.borderStrong }}>
              {fav ? "★" : "☆"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.bestRow}>
          <View style={styles.logoWrap}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={{ width: "78%", height: "78%" }} resizeMode="contain" />
            ) : (
              <Text style={styles.logoFallback}>{item.bestBank.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bestLabel}>BEST WITH</Text>
            <Text style={styles.bestCard} numberOfLines={2}>
              {item.bestBank} · {item.bestCard}
            </Text>
          </View>
          <View style={styles.savingCol}>
            <Text style={styles.savingValue}>{formatCurrency(item.bestSaving)}</Text>
            <Text style={styles.savingUnit}>per visit</Text>
            {item.bestDiscountPct ? (
              <Text style={styles.pct}>{Math.round(item.bestDiscountPct)}% off</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  restaurant: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  city: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  starBtn: { paddingHorizontal: 4 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  bestRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoFallback: {
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.xs,
  },
  bestLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  bestCard: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: 1,
  },
  savingCol: { alignItems: "flex-end", minWidth: 90 },
  savingValue: {
    color: colors.brand,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  savingUnit: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pct: {
    color: colors.toneEligible,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },
});
