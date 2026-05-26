import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getOfferDiscountPct, getOfferSavingValue } from "@/lib/savings";
import { formatCurrency } from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

// Initial page size for the offers list. We don't paginate per se on mobile
// (FlatList in a ScrollView is an anti-pattern), so we render N at a time
// and let the user tap "Show more" to grow the visible set. With a typical
// 30-80 offers per restaurant this hits the sweet spot of "instant to read
// the top picks" + "no infinite scroll surprise".
const OFFER_PAGE_SIZE = 12;

export default function RestaurantDetail() {
  const params = useLocalSearchParams<{ name: string; city?: string }>();
  const restaurantName = params.name;
  const data = useAppStore((s) => s.data);
  const orderValue = useAppStore((s) => s.orderValue);
  const ownedCards = useAppStore((s) => s.ownedCards);
  const fav = useAppStore((s) => s.favoriteRestaurants.has(restaurantName));
  const toggleFav = useAppStore((s) => s.toggleFavorite);
  const [offerSearch, setOfferSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(OFFER_PAGE_SIZE);

  const enrichment = data?.restaurantsEnrichment[restaurantName];
  const offers = useMemo(() => {
    if (!data) return [];
    return data.offers
      .filter((o) => o.restaurant === restaurantName && (!params.city || o.city === params.city))
      .map((o) => ({
        offer: o,
        saving: getOfferSavingValue(o, orderValue) || 0,
        pct: getOfferDiscountPct(o),
        owned: ownedCards.has(`${o.bank} || ${o.card}`),
      }))
      .sort((a, b) => b.saving - a.saving);
  }, [data, restaurantName, params.city, orderValue, ownedCards]);

  // Substring-match against bank, card name, and discount label so the user
  // can find offers by "mcb", "visa", "platinum", or "50%". Search resets the
  // visible count so the user doesn't have to scroll their filtered list.
  const filteredOffers = useMemo(() => {
    const q = offerSearch.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((row) =>
      [row.offer.bank, row.offer.card, row.offer.discountLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [offers, offerSearch]);

  const shownOffers = filteredOffers.slice(0, visibleCount);
  const hasMore = filteredOffers.length > shownOffers.length;

  const branches =
    (params.city && enrichment?.branchesByCity?.[params.city]) ||
    (enrichment?.branchesByCity
      ? Object.values(enrichment.branchesByCity).flat()
      : []);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 64 }}>
      <Stack.Screen
        options={{
          title: restaurantName,
          headerBackTitle: " ",
          headerBackButtonDisplayMode: "minimal",
          headerRight: () => (
            <Pressable onPress={() => toggleFav(restaurantName)} hitSlop={10}>
              <Text style={{ fontSize: 22, color: fav ? colors.brand : colors.textDim, marginRight: spacing.md }}>
                {fav ? "★" : "☆"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.hero}>
        <Text style={styles.name}>{restaurantName}</Text>
        {enrichment?.servesCuisine?.length ? (
          <Text style={styles.cuisine}>{enrichment.servesCuisine.join(" · ")}</Text>
        ) : null}
        {enrichment?.description ? (
          <Text style={styles.desc}>{enrichment.description}</Text>
        ) : null}
      </View>

      <Section title={`All offers (${filteredOffers.length}${offerSearch ? ` of ${offers.length}` : ""})`}>
        {offers.length > 6 ? (
          <TextInput
            value={offerSearch}
            onChangeText={(v) => {
              setOfferSearch(v);
              setVisibleCount(OFFER_PAGE_SIZE);
            }}
            placeholder="Search bank, card or %…"
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        ) : null}
        {filteredOffers.length === 0 ? (
          <Text style={styles.muted}>
            {offerSearch ? "No offers match that search." : "No offers in current scope."}
          </Text>
        ) : (
          shownOffers.map((row, i) => (
            <Link
              key={`${row.offer.bank}|${row.offer.card}|${i}`}
              href={{
                pathname: "/card/[id]",
                params: { id: `${row.offer.bank}||${row.offer.card}` },
              }}
              asChild
            >
              <Pressable style={styles.offerRow}>
                <OfferLogo bank={row.offer.bank} />
                <View style={styles.offerBody}>
                  <View style={styles.offerTopRow}>
                    <Text style={styles.offerCard} numberOfLines={1}>
                      {row.offer.card}
                    </Text>
                    {row.owned ? (
                      <View style={styles.ownChip}>
                        <Text style={styles.ownChipText}>OWNED</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.offerBank} numberOfLines={1}>
                    {row.offer.bank}
                  </Text>
                  <View style={styles.offerMetaRow}>
                    {row.pct ? (
                      <View style={styles.pctChip}>
                        <Text style={styles.pctChipText}>{Math.round(row.pct)}%</Text>
                      </View>
                    ) : null}
                    <Text style={styles.offerMeta} numberOfLines={1}>
                      {row.offer.daysLabel || "All Days"}
                      {row.offer.capPkr ? ` · cap ${formatCurrency(row.offer.capPkr)}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.offerSavingCol}>
                  <Text style={styles.offerSaving}>{formatCurrency(row.saving)}</Text>
                  <Text style={styles.offerSavingUnit}>per visit</Text>
                </View>
              </Pressable>
            </Link>
          ))
        )}
        {hasMore ? (
          <Pressable
            style={styles.showMoreBtn}
            onPress={() => setVisibleCount((n) => n + OFFER_PAGE_SIZE)}
          >
            <Text style={styles.showMoreText}>
              Show {Math.min(OFFER_PAGE_SIZE, filteredOffers.length - visibleCount)} more
            </Text>
          </Pressable>
        ) : null}
      </Section>

      {branches.length > 0 ? (
        <Section title={`Branches (${branches.length})`}>
          {branches.map((b, i) => (
            <View key={i} style={styles.branch}>
              <Text style={styles.branchName}>{b.name}</Text>
              <Text style={styles.branchAddr} numberOfLines={2}>{b.address}</Text>
              <View style={styles.branchActions}>
                {b.telephone ? (
                  <Pressable
                    style={styles.miniBtn}
                    onPress={() => Linking.openURL(`tel:${b.telephone}`)}
                  >
                    <Text style={styles.miniBtnText}>Call</Text>
                  </Pressable>
                ) : null}
                {b.lat && b.lng ? (
                  <Pressable
                    style={styles.miniBtn}
                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${b.lat},${b.lng}`)}
                  >
                    <Text style={styles.miniBtnText}>Map</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function OfferLogo({ bank }: { bank: string }) {
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
  hero: {
    backgroundColor: colors.bgElev,
    padding: spacing.xl,
    ...shadow.card,
  },
  name: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
  },
  cuisine: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginTop: 4,
  },
  desc: {
    color: colors.text,
    fontSize: typography.size.sm,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.bgElev,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  muted: { color: colors.textMuted, fontSize: typography.size.sm },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
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
  offerBody: { flex: 1, minWidth: 0, gap: 2 },
  offerTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  offerCard: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    flexShrink: 1,
  },
  ownChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  ownChipText: {
    color: colors.textOnBrand,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  offerBank: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  offerMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  pctChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.toneEligibleBg,
  },
  pctChipText: {
    color: colors.toneEligible,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
  },
  offerMeta: { color: colors.textMuted, fontSize: typography.size.xs, flexShrink: 1 },
  offerSavingCol: { alignItems: "flex-end", minWidth: 80 },
  offerSaving: {
    color: colors.toneEligible,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  offerSavingUnit: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  branch: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  branchName: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  branchAddr: { color: colors.textMuted, fontSize: typography.size.xs, marginTop: 2 },
  branchActions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  miniBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSubtle,
  },
  miniBtnText: { color: colors.text, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  searchInput: {
    backgroundColor: colors.bgSubtle,
    color: colors.text,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  showMoreBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
  },
  showMoreText: {
    color: colors.brand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
