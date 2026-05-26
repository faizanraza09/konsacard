import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityTabs } from "@/components/CityTabs";
import { EligibilityBadge } from "@/components/EligibilityBadge";
import { FilterSheet, FilterSheetHandle } from "@/components/FilterSheet";
import { Pill } from "@/components/Pill";
import { ResultsHeader } from "@/components/ResultsHeader";
import { TopBar } from "@/components/TopBar";
import { computeWalletRecommendations } from "@/lib/algorithms";
import { formatCurrency } from "@/lib/format";
import { useAppStore } from "@/store";
import { WalletObjective, WalletShape } from "@/types";
import { colors, radii, shadow, spacing, typography } from "@/theme";

const OBJECTIVE_LABEL: Record<WalletObjective, string> = {
  savings: "max savings",
  coverage: "max coverage",
  roi: "best ROI",
};

export default function BuildWalletScreen() {
  const state = useAppStore();
  const sheet = useRef<FilterSheetHandle>(null);
  const listRef = useRef<FlashListRef<WalletShape>>(null);
  const result = useMemo(() => computeWalletRecommendations(state), [state]);

  const k = result.stats.K ?? state.walletSize;
  const obj = (result.stats.objective ?? "savings") as WalletObjective;

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state.selectedCity]);

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <TopBar />
      <CityTabs />
      <ResultsHeader
        count={result.ranked.length}
        countLabel="wallet ideas"
        subtitle={`Combinations of ${k} cards · ${OBJECTIVE_LABEL[obj]}`}
        onPressFilters={() => sheet.current?.open()}
      />
      <FlashList
        ref={listRef}
        ListHeaderComponent={<WalletConfig />}
        data={result.ranked}
        keyExtractor={(w) => w.walletKey}
        renderItem={({ item, index }) => <WalletCard wallet={item} rank={index + 1} />}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          result.stats.warnings.length ? (
            <View style={styles.warnBox}>
              {result.stats.warnings.map((w, i) => (
                <Text key={i} style={styles.warnText}>• {w}</Text>
              ))}
            </View>
          ) : null
        }
      />
      <FilterSheet ref={sheet} matchCount={result.ranked.length} matchLabel="wallets" />
    </SafeAreaView>
  );
}

function WalletConfig() {
  const k = useAppStore((s) => s.walletSize);
  const setK = useAppStore((s) => s.setWalletSize);
  const obj = useAppStore((s) => s.walletObjective);
  const setObj = useAppStore((s) => s.setWalletObjective);
  const noSameBank = useAppStore((s) => s.walletNoSameBank);
  const setNoSameBank = useAppStore((s) => s.setWalletNoSameBank);
  const mixed = useAppStore((s) => s.walletMixedTypes);
  const setMixed = useAppStore((s) => s.setWalletMixedTypes);
  const onOwned = useAppStore((s) => s.walletBuildOnOwned);
  const setOnOwned = useAppStore((s) => s.setWalletBuildOnOwned);
  const ownedCount = useAppStore((s) => s.ownedCards.size);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const objectives: { v: WalletObjective; label: string }[] = [
    { v: "savings", label: "Max savings" },
    { v: "coverage", label: "Max coverage" },
    { v: "roi", label: "Best ROI" },
  ];

  return (
    <View style={styles.config}>
      <Text style={styles.configTitle}>Tune your wallet</Text>

      <Label>Wallet size</Label>
      <View style={styles.pillRow}>
        {[2, 3, 4].map((n) => (
          <Pill key={n} label={`${n} cards`} active={k === n} onPress={() => setK(n)} />
        ))}
      </View>

      <Label>Objective</Label>
      <View style={styles.pillRow}>
        {objectives.map((o) => (
          <Pill key={o.v} label={o.label} active={obj === o.v} onPress={() => setObj(o.v)} />
        ))}
      </View>

      <Pressable
        style={styles.advancedToggle}
        onPress={() => setAdvancedOpen((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.advancedToggleText}>
          {advancedOpen ? "Hide advanced" : "Advanced options"}
        </Text>
        {advancedOpen ? (
          <ChevronUp size={14} color={colors.brand} strokeWidth={2.5} />
        ) : (
          <ChevronDown size={14} color={colors.brand} strokeWidth={2.5} />
        )}
      </Pressable>

      {advancedOpen ? (
        <>
          <SwitchRow label="Different banks only" value={noSameBank} onChange={setNoSameBank} />
          <SwitchRow
            label="Must include both debit and credit"
            value={mixed}
            onChange={setMixed}
          />
          {ownedCount > 0 ? (
            <SwitchRow
              label={`Build on top of my ${ownedCount} owned card${ownedCount === 1 ? "" : "s"}`}
              value={onOwned}
              onChange={setOnOwned}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.switchRow} onPress={() => onChange(!value)}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
      />
    </Pressable>
  );
}

function WalletCard({ wallet, rank }: { wallet: WalletShape; rank: number }) {
  const isTopPick = rank === 1;
  return (
    <View style={[styles.walletCard, isTopPick && styles.walletCardTop]}>
      {isTopPick ? (
        <View style={styles.topRibbon}>
          <Text style={styles.topRibbonText}>BEST COMBO</Text>
        </View>
      ) : null}
      <View style={styles.walletHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletLabel}>WALLET #{rank}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{formatCurrency(wallet.perOutingTotal)}</Text>
            <Text style={styles.heroUnit}> /outing</Text>
          </View>
          <Text style={styles.microStats}>
            <Text style={styles.microBold}>
              {wallet.coveredVenues} / {wallet.venueCount}
            </Text>{" "}
            {wallet.venueCount === 1 ? "restaurant" : "restaurants"} ·{" "}
            {wallet.feeUnknown ? "fees unknown" : `${formatCurrency(wallet.totalAnnualFee)}/yr fees`}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {wallet.picks.map((p, i) => (
        <View key={p.cardKey} style={[styles.pickRow, i === 0 && { borderTopWidth: 0 }]}>
          <View style={styles.pickBadge}>
            <Text style={styles.pickBadgeText}>{p.pinned ? "★" : i + 1}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.pickCard} numberOfLines={1}>{p.card}</Text>
            <Text style={styles.pickBank} numberOfLines={1}>{p.bank}</Text>
            <View style={styles.pickFooter}>
              <EligibilityBadge status={p.requirementStatus} />
              <Text style={styles.pickMeta}>
                +{formatCurrency(p.marginalDelta)} · {p.coveredByCard} venues
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: 80, paddingTop: 4 },
  config: {
    backgroundColor: colors.bgElev,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  configTitle: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  advancedToggleText: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  switchLabel: {
    color: colors.text,
    fontSize: typography.size.sm,
    flex: 1,
    marginRight: spacing.sm,
  },

  walletCard: {
    backgroundColor: colors.bgElev,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  walletCardTop: {
    backgroundColor: colors.bgTint,
    borderColor: colors.brandMid,
    paddingTop: spacing.sm,
  },
  topRibbon: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  topRibbonText: {
    color: colors.textOnBrand,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  walletHeader: { flexDirection: "row", alignItems: "flex-start" },
  walletLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  heroRow: { flexDirection: "row", alignItems: "baseline" },
  heroValue: {
    color: colors.brand,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    fontVariant: ["tabular-nums"],
    lineHeight: typography.size.xl + 2,
  },
  heroUnit: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  microStats: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  microBold: { color: colors.text, fontWeight: typography.weight.bold },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  pickRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pickBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginTop: 2,
  },
  pickBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
  },
  pickCard: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  pickBank: {
    color: colors.textDim,
    fontSize: typography.size.xs,
    marginTop: 1,
  },
  pickFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: "wrap",
  },
  pickMeta: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontVariant: ["tabular-nums"],
  },
  warnBox: {
    backgroundColor: colors.toneNeedsInputBg,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  warnText: {
    color: colors.toneNeedsInput,
    fontSize: typography.size.sm,
    marginBottom: 2,
  },
});
