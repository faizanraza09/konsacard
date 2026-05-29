import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { evaluateEligibility } from "@/lib/eligibility";
import { computeRecommendations } from "@/lib/algorithms";
import { formatCurrency } from "@/lib/format";
import { getBankLogoUrl } from "@/lib/bankLogo";
import { getOfferDiscountPct, getOfferSavingValue } from "@/lib/savings";
import { useAppStore } from "@/store";

const RESTAURANT_PAGE_SIZE = 12;
import {
  colors,
  eligibilityTone,
  radii,
  scoreColor,
  shadow,
  spacing,
  typography,
} from "@/theme";

// Card detail screen.
//
// Structure:
//  1. Header strip (no duplicate title — Stack header handles the card name).
//     Bank logo + bank name + eligibility dot + card type chip.
//  2. Saving hero — big PKR/outing + score on the right.
//  3. Stats grid — coverage / avg discount / median cap.
//  4. Requirements — 3 inset rows + fee waiver if present.
//  5. Research notes — collapsed by default (toggle).
//  6. Top wins — top 3 restaurants.
export default function CardDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAppStore();
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const [bank, card] = (params.id || "").split("||");
  const [notesOpen, setNotesOpen] = useState(false);
  const [restSearch, setRestSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(RESTAURANT_PAGE_SIZE);

  // Detail reads the full offers list (all restaurants for this card), so it
  // always needs raw offers. Reached only via navigation, never cold start.
  useEffect(() => {
    if (!state.data) ensureRawOffers();
  }, [state.data, ensureRawOffers]);

  const recs = useMemo(() => computeRecommendations(state), [state]);
  const rec = recs.find((r) => r.bank === bank && r.card === card);
  const eligibility = useMemo(() => evaluateEligibility(state, bank, card), [state, bank, card]);
  const logoUrl = getBankLogoUrl(bank);

  // Every restaurant this specific card has an active offer at, aggregated to
  // one row per restaurant (best offer wins ties). We compute from the raw
  // offers list rather than reusing rec.topMatches because topMatches caps at
  // 3 — but the user wants to browse, search, and page through *all* of them.
  const allCardRestaurants = useMemo(() => {
    if (!state.data) return [] as Array<{
      restaurant: string;
      city: string;
      saving: number;
      pct: number | null;
      discountLabel: string;
      daysLabel?: string;
      capPkr: number | null;
    }>;
    const orderValue = state.orderValue;
    const bestPerRestaurant = new Map<
      string,
      {
        restaurant: string;
        city: string;
        saving: number;
        pct: number | null;
        discountLabel: string;
        daysLabel?: string;
        capPkr: number | null;
      }
    >();
    for (const o of state.data.offers) {
      if (o.bank !== bank || o.card !== card) continue;
      const saving = getOfferSavingValue(o, orderValue) || 0;
      if (!Number.isFinite(saving) || saving <= 0) continue;
      const key = `${o.city}|||${o.restaurant}`;
      const existing = bestPerRestaurant.get(key);
      if (!existing || saving > existing.saving) {
        bestPerRestaurant.set(key, {
          restaurant: o.restaurant,
          city: o.city,
          saving,
          pct: getOfferDiscountPct(o),
          discountLabel: o.discountLabel || "",
          daysLabel: o.daysLabel,
          capPkr: o.capPkr ?? null,
        });
      }
    }
    return Array.from(bestPerRestaurant.values()).sort((a, b) => b.saving - a.saving);
  }, [state.data, state.orderValue, bank, card]);

  const filteredRestaurants = useMemo(() => {
    const q = restSearch.trim().toLowerCase();
    if (!q) return allCardRestaurants;
    return allCardRestaurants.filter((r) =>
      [r.restaurant, r.city, r.discountLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [allCardRestaurants, restSearch]);

  const shownRestaurants = filteredRestaurants.slice(0, visibleCount);
  const hasMoreRestaurants = filteredRestaurants.length > shownRestaurants.length;

  // Raw offers still loading: show a spinner rather than a misleading
  // "not found" (the rec can't exist until offers are in memory).
  if (!state.data) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Stack.Screen options={{ title: card || "Card" }} />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!rec) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Stack.Screen options={{ title: card || "Card" }} />
        <Text style={styles.text}>Card not found in current scope.</Text>
      </View>
    );
  }

  const tone = eligibilityTone(eligibility.tone);
  const hasNotes =
    (eligibility.cardNotes?.length ?? 0) > 0 || (eligibility.bankGaps?.length ?? 0) > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Stack.Screen
        options={{
          title: card,
          headerTintColor: colors.text,
          headerBackTitle: " ",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      {/* Identity strip */}
      <View style={styles.idStrip}>
        <View style={styles.logoWrap}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: "78%", height: "78%" }}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.logoFallback}>{bank.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.bankName} numberOfLines={1}>{bank}</Text>
          <Text style={styles.cardName} numberOfLines={2}>{card}</Text>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={[styles.elig, { backgroundColor: tone.bg }]}>
          <View style={[styles.eligDot, { backgroundColor: tone.color }]} />
          <Text style={[styles.eligText, { color: tone.color }]}>{eligibility.label}</Text>
        </View>
        {rec.cardCategory ? (
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>
              {rec.cardCategory.charAt(0).toUpperCase() + rec.cardCategory.slice(1)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Saving + score hero */}
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>Estimated saving</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{formatCurrency(rec.avgExpectedSaving)}</Text>
            <Text style={styles.heroUnit}> /outing</Text>
          </View>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreNum, { color: scoreColor(rec.score) }]}>
            {rec.score.toFixed(1)}
          </Text>
          <Text style={styles.scoreLabel}>FIT</Text>
          <View style={[styles.scoreBar, { backgroundColor: scoreColor(rec.score) }]} />
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statRow}>
        <MiniStat
          label="Coverage"
          value={`${Math.round(rec.coverage * 100)}%`}
          sub={`${rec.coveredVenueCount} of ${rec.totalVenueCount}`}
        />
        <MiniStat
          label="Avg discount"
          value={rec.averageDiscount !== null ? `${Math.round(rec.averageDiscount)}%` : "—"}
        />
        <MiniStat
          label="Median cap"
          value={rec.medianCap ? formatCurrency(rec.medianCap) : "—"}
        />
      </View>

      {/* Requirements */}
      <Section title="Requirements">
        {eligibility.criteria.filter(Boolean).length === 0 ? (
          <Text style={styles.muted}>No public criteria captured for this card.</Text>
        ) : (
          <View style={styles.reqGroup}>
            <ReqRow
              label="Min. salary"
              value={
                eligibility.salaryReq === null
                  ? "Not listed"
                  : eligibility.salaryReq === 0
                  ? "None required"
                  : `${eligibility.salaryIsEstimated ? "~" : ""}${formatCurrency(
                      eligibility.salaryReq
                    )} / month`
              }
              estimated={eligibility.salaryIsEstimated}
            />
            <ReqRow
              label="Min. balance"
              value={
                eligibility.balanceReq === null
                  ? "Not listed"
                  : eligibility.balanceReq === 0
                  ? "None required"
                  : `${eligibility.balanceIsEstimated ? "~" : ""}${formatCurrency(
                      eligibility.balanceReq
                    )}`
              }
              estimated={eligibility.balanceIsEstimated}
            />
            <ReqRow
              label="Annual fee"
              value={
                eligibility.annualFeePkr === null
                  ? eligibility.annualFeeWaiverRule
                    ? "Conditional"
                    : "Not listed"
                  : eligibility.annualFeePkr === 0
                  ? "No annual fee"
                  : formatCurrency(eligibility.annualFeePkr)
              }
            />
          </View>
        )}
        {eligibility.annualFeeWaiverRule ? (
          <View style={styles.waiverCard}>
            <Text style={styles.waiverLabel}>Fee waiver</Text>
            <Text style={styles.waiverText}>{eligibility.annualFeeWaiverRule}</Text>
          </View>
        ) : null}
      </Section>

      {/* All restaurants this card covers. Replaces the old "Top wins" (which
          truncated at 3) — surfaces every venue with a search + Show-more
          pager so users can verify the card hits their actual hangouts. */}
      {allCardRestaurants.length > 0 ? (
        <Section
          title={`Restaurants covered (${
            restSearch ? `${filteredRestaurants.length} of ` : ""
          }${allCardRestaurants.length})`}
        >
          {allCardRestaurants.length > 6 ? (
            <TextInput
              value={restSearch}
              onChangeText={(v) => {
                setRestSearch(v);
                setVisibleCount(RESTAURANT_PAGE_SIZE);
              }}
              placeholder="Search restaurant, city or %…"
              placeholderTextColor={colors.textDim}
              style={styles.searchInput}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          ) : null}
          {filteredRestaurants.length === 0 ? (
            <Text style={styles.muted}>No restaurants match that search.</Text>
          ) : (
            shownRestaurants.map((r, i) => (
              <Link
                key={`${r.city}|${r.restaurant}`}
                href={{
                  pathname: "/restaurant/[name]",
                  params: { name: r.restaurant, city: r.city },
                }}
                asChild
              >
                <Pressable style={StyleSheet.flatten([styles.winRow, i === 0 ? { borderTopWidth: 0 } : null])}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.winRestaurant} numberOfLines={1}>
                      {r.restaurant}
                    </Text>
                    <Text style={styles.winSub} numberOfLines={1}>
                      {r.city.toUpperCase()}
                      {r.discountLabel ? ` · ${r.discountLabel}` : ""}
                      {r.daysLabel ? ` · ${r.daysLabel}` : ""}
                    </Text>
                  </View>
                  <View style={styles.winRight}>
                    <Text style={styles.winSaving}>{formatCurrency(r.saving)}</Text>
                    <Text style={styles.winUnit}>/visit</Text>
                  </View>
                </Pressable>
              </Link>
            ))
          )}
          {hasMoreRestaurants ? (
            <Pressable
              style={styles.showMoreBtn}
              onPress={() => setVisibleCount((n) => n + RESTAURANT_PAGE_SIZE)}
            >
              <Text style={styles.showMoreText}>
                Show {Math.min(RESTAURANT_PAGE_SIZE, filteredRestaurants.length - visibleCount)} more
              </Text>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      {/* Research notes — collapsed by default. Useful for transparency but
          shouldn't crowd the page on first read. */}
      {hasNotes ? (
        <View style={styles.notesWrap}>
          <Pressable
            style={styles.notesToggle}
            onPress={() => setNotesOpen((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.notesToggleText}>
              {notesOpen ? "Hide research details" : "Show research details"}
            </Text>
            {notesOpen ? (
              <ChevronUp size={16} color={colors.brand} strokeWidth={2.5} />
            ) : (
              <ChevronDown size={16} color={colors.brand} strokeWidth={2.5} />
            )}
          </Pressable>
          {notesOpen ? (
            <View style={styles.notesBody}>
              {eligibility.detail ? (
                <Text style={styles.muted}>{eligibility.detail}</Text>
              ) : null}
              {eligibility.cardNotes?.length ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>NOTES</Text>
                  {eligibility.cardNotes.map((n, i) => (
                    <Text key={i} style={styles.noteText}>· {n}</Text>
                  ))}
                </View>
              ) : null}
              {eligibility.bankGaps?.length ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>BANK GAPS</Text>
                  {eligibility.bankGaps.map((n, i) => (
                    <Text key={i} style={styles.noteText}>· {n}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
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

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
      {sub ? <Text style={styles.miniStatSub}>{sub}</Text> : null}
    </View>
  );
}

function ReqRow({
  label,
  value,
  estimated,
}: {
  label: string;
  value: string;
  estimated?: boolean;
}) {
  return (
    <View style={styles.reqRow}>
      <Text style={styles.reqLabel}>{label}</Text>
      <Text style={[styles.reqValue, estimated && styles.reqValueEst]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 80, paddingTop: spacing.md },
  center: { alignItems: "center", justifyContent: "center" },
  text: { color: colors.text, fontSize: typography.size.md },

  // Identity strip
  idStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  logoFallback: {
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  bankName: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardName: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    lineHeight: typography.size.lg + 4,
    marginTop: 1,
  },

  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  elig: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  eligDot: { width: 7, height: 7, borderRadius: 4 },
  eligText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  typeChip: {
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  typeChipText: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  // Saving hero
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  heroLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  heroValue: {
    color: colors.brand,
    fontSize: typography.size.display,
    fontWeight: typography.weight.black,
    lineHeight: typography.size.display + 2,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    color: colors.textMuted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  scoreCol: { alignItems: "flex-end", minWidth: 56 },
  scoreNum: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  scoreLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 1,
  },
  scoreBar: { width: 26, height: 3, borderRadius: 2, marginTop: 4 },

  // Stats grid
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  miniStat: {
    flex: 1,
    backgroundColor: colors.bgElev,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  miniStatLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  miniStatValue: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  miniStatSub: { color: colors.textMuted, fontSize: typography.size.xs, marginTop: 1 },

  // Sections
  section: {
    backgroundColor: colors.bgElev,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  muted: { color: colors.textMuted, fontSize: typography.size.sm, lineHeight: 20 },

  reqGroup: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  reqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reqLabel: { color: colors.textMuted, fontSize: typography.size.sm },
  reqValue: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  reqValueEst: { color: colors.textMuted },

  waiverCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.brandLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandMid,
  },
  waiverLabel: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  waiverText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: 19,
  },

  // Top wins
  winRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  winRestaurant: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  winSub: { color: colors.textMuted, fontSize: typography.size.xs, marginTop: 2 },
  winRight: { alignItems: "flex-end", marginLeft: spacing.sm },
  winSaving: {
    color: colors.brand,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
  },
  winUnit: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
  },

  // Notes (collapsible)
  notesWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  notesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  notesToggleText: {
    color: colors.brand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  notesBody: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noteBlock: { marginTop: spacing.xs },
  noteLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  noteText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: 19,
    marginTop: 1,
  },
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
