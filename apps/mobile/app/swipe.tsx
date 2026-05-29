import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { logVisit } from "@/lib/visits";
import { buildCardKey, formatCurrency } from "@/lib/format";
import { getOfferDiscountPct, getOfferSavingValue } from "@/lib/savings";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

interface Candidate {
  bank: string;
  card: string;
  cardKey: string;
  owned: boolean;
  saving: number;
  discountPct: number | null;
  discountLabel: string;
  orderTypes: string[];
  daysLabel?: string;
  offerTitle?: string;
}

// "I'm at the counter, which card do I swipe?" — the recurring-usage feature.
// Search a restaurant; the screen instantly shows your best-saving card for
// the current bill size + day, with a one-tap log button.
export default function Swipe() {
  const router = useRouter();
  const data = useAppStore((s) => s.data);
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const orderValue = useAppStore((s) => s.orderValue);
  const setOrderValue = useAppStore((s) => s.setOrderValue);
  const owned = useAppStore((s) => s.ownedCards);

  // Swipe searches the full restaurant + offer list; load raw lazily on mount.
  useEffect(() => {
    if (!data) ensureRawOffers();
  }, [data, ensureRawOffers]);

  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [billInput, setBillInput] = useState(String(orderValue));

  const restaurants = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.offers.forEach((o) => set.add(o.restaurant));
    return Array.from(set);
  }, [data]);

  const matches = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return restaurants
      .filter((r) => r.toLowerCase().includes(qq))
      .slice(0, 8);
  }, [restaurants, q]);

  const candidates = useMemo<Candidate[]>(() => {
    if (!picked || !data) return [];
    const todayIdx = (new Date().getDay() + 6) % 7; // JS Sun=0; we use Mon=0
    const offersHere = data.offers.filter((o) => o.restaurant === picked);
    const best = new Map<string, Candidate>();
    offersHere.forEach((o) => {
      if (!o.days.includes(todayIdx)) return;
      const saving = getOfferSavingValue(o, orderValue);
      if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;
      const cardKey = buildCardKey(o.bank, o.card);
      const cand: Candidate = {
        bank: o.bank,
        card: o.card,
        cardKey,
        owned: owned.has(cardKey),
        saving: saving as number,
        discountPct: getOfferDiscountPct(o),
        discountLabel: o.discountLabel,
        orderTypes: o.orderTypes ?? [],
        daysLabel: o.daysLabel,
        offerTitle: o.offerTitle,
      };
      const cur = best.get(cardKey);
      if (!cur || cand.saving > cur.saving) best.set(cardKey, cand);
    });
    return Array.from(best.values()).sort((a, b) => {
      // Owned-first, then saving
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return b.saving - a.saving;
    });
  }, [picked, data, orderValue, owned]);

  const ownedCandidates = candidates.filter((c) => c.owned);
  const otherCandidates = candidates.filter((c) => !c.owned);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
      <Text style={styles.title}>Where are you?</Text>
      {!data ? (
        <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
      <TextInput
        style={styles.search}
        value={q}
        onChangeText={(t) => {
          setQ(t);
          if (picked) setPicked(null);
        }}
        placeholder="Type the restaurant…"
        placeholderTextColor={colors.textDim}
        autoFocus
        autoCorrect={false}
      />
      {!picked && matches.length > 0 ? (
        <View style={styles.suggestions}>
          {matches.map((m) => (
            <Pressable
              key={m}
              style={styles.suggestion}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                setPicked(m);
                setQ(m);
              }}
            >
              <Text style={styles.suggestionText}>{m}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {picked ? (
        <>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Bill</Text>
            <TextInput
              style={styles.billInput}
              value={billInput}
              onChangeText={(t) => {
                setBillInput(t);
                const n = Number(t.replace(/[^0-9]/g, ""));
                if (Number.isFinite(n) && n > 0) setOrderValue(n);
              }}
              keyboardType="numeric"
              placeholder="10000"
              placeholderTextColor={colors.textDim}
            />
          </View>

          {owned.size === 0 ? (
            <Text style={styles.helper}>
              Add your cards in My Wallet to get a personal pick. For now showing best offer overall.
            </Text>
          ) : ownedCandidates.length === 0 ? (
            <Text style={styles.helper}>
              None of your cards have a deal here today. Other cards that do:
            </Text>
          ) : null}

          {ownedCandidates.length > 0 ? (
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Use this card</Text>
              <Text style={styles.heroBank}>{ownedCandidates[0].bank}</Text>
              <Text style={styles.heroCardName}>{ownedCandidates[0].card}</Text>
              <Text style={styles.heroSaving}>~Save {formatCurrency(ownedCandidates[0].saving)}</Text>
              <Text style={styles.heroSub}>
                {ownedCandidates[0].discountLabel}
                {ownedCandidates[0].offerTitle ? ` · ${ownedCandidates[0].offerTitle}` : ""}
              </Text>
              <Pressable
                style={styles.logBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => undefined
                  );
                  const cand = ownedCandidates[0];
                  await logVisit({
                    ts: Date.now(),
                    restaurant: picked!,
                    bank: cand.bank,
                    card: cand.card,
                    bill_pkr: orderValue,
                    saving_pkr: cand.saving,
                  });
                  router.push("/visits");
                }}
              >
                <Text style={styles.logBtnText}>I used it — log visit</Text>
              </Pressable>
            </View>
          ) : null}

          {(ownedCandidates.length > 1 || otherCandidates.length > 0) ? (
            <Text style={styles.sectionLabel}>Other options today</Text>
          ) : null}

          {[...ownedCandidates.slice(1), ...otherCandidates].slice(0, 8).map((c) => (
            <View key={c.cardKey} style={styles.otherRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.otherCard}>
                  {c.bank} — {c.card}{c.owned ? " (yours)" : ""}
                </Text>
                <Text style={styles.otherSub}>
                  {c.discountLabel}{c.offerTitle ? ` · ${c.offerTitle}` : ""}
                </Text>
              </View>
              <Text style={styles.otherSaving}>~{formatCurrency(c.saving)}</Text>
            </View>
          ))}

          {candidates.length === 0 ? (
            <Text style={styles.helper}>No deals here today on any card.</Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 64 },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.bgElev,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  suggestions: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    ...shadow.card,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: { color: colors.text, fontSize: typography.size.md },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  billLabel: { color: colors.textMuted, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  billInput: {
    flex: 1,
    backgroundColor: colors.bgElev,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.text,
  },
  heroCard: {
    backgroundColor: colors.bgElev,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
    alignItems: "center",
    ...shadow.card,
  },
  heroLabel: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroBank: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroCardName: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    marginTop: 2,
  },
  heroSaving: {
    color: colors.toneEligible,
    fontSize: typography.size.display,
    fontWeight: typography.weight.black,
    marginTop: spacing.md,
  },
  heroSub: { color: colors.textMuted, fontSize: typography.size.sm, marginTop: spacing.xs, textAlign: "center" },
  logBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  logBtnText: { color: colors.textOnBrand, fontWeight: typography.weight.bold, fontSize: typography.size.md },
  helper: { color: colors.textMuted, marginTop: spacing.md, fontSize: typography.size.sm },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  otherRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElev,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  otherCard: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  otherSub: { color: colors.textMuted, fontSize: typography.size.xs, marginTop: 2 },
  otherSaving: {
    color: colors.toneEligible,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    marginLeft: spacing.sm,
  },
});
