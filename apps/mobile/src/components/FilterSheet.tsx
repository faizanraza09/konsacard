import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";
import { Pill } from "./Pill";
import { DAY_SHORT } from "@/lib/format";

export interface FilterSheetHandle {
  open: () => void;
  close: () => void;
}

interface Props {
  matchCount?: number;
  matchLabel?: string;
}

// Banks that the average Pakistani user recognizes first. Shown by default;
// the rest are revealed under "Show all banks".
const POPULAR_BANKS = [
  "Habib Bank Limited",
  "United Bank Limited (UBL)",
  "Allied Bank",
  "Faysal Bank Limited",
  "Meezan Bank",
  "Bank Alfalah",
  "Standard Chartered Bank",
  "MCB Bank Limited",
];

// Cuisines that index well for Pakistani diners. Top of the list by default.
const POPULAR_CUISINES = [
  "Pakistani",
  "BBQ",
  "Karahi",
  "Biryani",
  "Chinese",
  "Burgers",
  "Pizza",
  "Desserts",
];

export const FilterSheet = forwardRef<FilterSheetHandle, Props>(function FilterSheet(
  { matchCount, matchLabel = "results" },
  ref
) {
  const sheet = useRef<BottomSheet>(null);
  useImperativeHandle(ref, () => ({
    open: () => sheet.current?.expand(),
    close: () => sheet.current?.close(),
  }));

  const snapPoints = useMemo(() => ["75%", "95%"], []);
  const close = useCallback(() => sheet.current?.close(), []);

  return (
    <BottomSheet
      ref={sheet}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bgElev }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Filters</Text>
          <ResetButton />
        </View>
        <TypicalBill />
        <OutingsPerWeek />
        <CardTypeSection />
        <BankSection />
        <RestaurantSection />
        <CuisineSection />
        <EligibilitySection />
        <DaysSection />
        <View style={{ height: 100 }} />
      </BottomSheetScrollView>
      <ApplyBar matchCount={matchCount} matchLabel={matchLabel} onPress={close} />
    </BottomSheet>
  );
});

function ApplyBar({
  matchCount,
  matchLabel,
  onPress,
}: {
  matchCount?: number;
  matchLabel: string;
  onPress: () => void;
}) {
  const count = typeof matchCount === "number" ? matchCount : null;
  const label = count === null ? "Apply filters" : `Show ${count.toLocaleString("en-US")} ${matchLabel}`;
  return (
    <View style={styles.applyBar}>
      <Pressable style={styles.applyBtn} onPress={onPress} accessibilityRole="button">
        <Text style={styles.applyBtnText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function ResetButton() {
  const reset = useAppStore((s) => s.resetFilters);
  return (
    <Pressable onPress={reset} hitSlop={8}>
      <Text style={styles.resetBtn}>Reset all</Text>
    </Pressable>
  );
}

function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

function ShowMoreToggle({
  expanded,
  hiddenCount,
  onPress,
}: {
  expanded: boolean;
  hiddenCount: number;
  onPress: () => void;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.showMore}>
        {expanded ? "Show less" : `Show all (+${hiddenCount})`}
      </Text>
    </Pressable>
  );
}

function TypicalBill() {
  const value = useAppStore((s) => s.orderValue);
  const setValue = useAppStore((s) => s.setOrderValue);
  const presets = [1000, 3000, 5000, 10000, 20000, 30000];
  return (
    <View style={styles.section}>
      <SectionLabel>Typical Bill</SectionLabel>
      <Text style={styles.bigValue}>PKR {value.toLocaleString("en-US")}</Text>
      <View style={styles.pillRow}>
        {presets.map((p) => (
          <Pill key={p} label={`${p / 1000}K`} active={value === p} onPress={() => setValue(p)} />
        ))}
      </View>
    </View>
  );
}

function OutingsPerWeek() {
  const value = useAppStore((s) => s.outingsPerWeek);
  const setValue = useAppStore((s) => s.setOutingsPerWeek);
  return (
    <View style={styles.section}>
      <SectionLabel>Times eating out / week</SectionLabel>
      <View style={styles.pillRow}>
        {[1, 2, 3, 5, 7].map((n) => (
          <Pill key={n} label={`${n}x`} active={value === n} onPress={() => setValue(n)} />
        ))}
      </View>
    </View>
  );
}

function CardTypeSection() {
  const selected = useAppStore((s) => s.selectedCardTypes);
  const toggle = useAppStore((s) => s.toggleCardType);
  const types = [
    { v: "debit", l: "Debit" },
    { v: "credit", l: "Credit" },
    { v: "other", l: "Wallet" },
  ];
  return (
    <View style={styles.section}>
      <SectionLabel>Card type</SectionLabel>
      <View style={styles.pillRow}>
        {types.map((t) => (
          <Pill key={t.v} label={t.l} active={selected.has(t.v)} onPress={() => toggle(t.v)} />
        ))}
      </View>
    </View>
  );
}

function BankSection() {
  const offers = useAppStore((s) => s.data?.offers);
  const banksInData = useMemo(() => {
    const set = new Set<string>();
    (offers || []).forEach((o) => set.add(o.bank));
    return Array.from(set).sort();
  }, [offers]);
  const selected = useAppStore((s) => s.selectedBanks);
  const toggle = useAppStore((s) => s.toggleBank);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return banksInData;
    return banksInData.filter((b) => b.toLowerCase().includes(qq));
  }, [banksInData, q]);

  // When searching, show all matches. Otherwise show the popular list +
  // any selected-but-unpopular, with the rest behind "Show all".
  const searching = q.trim().length > 0;
  const popularInData = POPULAR_BANKS.filter((p) => banksInData.includes(p));
  const collapsed = useMemo(() => {
    const set = new Set<string>([...popularInData, ...Array.from(selected)]);
    return Array.from(set).filter((b) => banksInData.includes(b));
  }, [popularInData, selected, banksInData]);
  const visible = searching ? filtered : expanded ? filtered : collapsed;
  const hiddenCount = searching ? 0 : Math.max(0, filtered.length - collapsed.length);

  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Banks</Text>
        {selected.size ? <Text style={styles.sectionCount}>{selected.size}</Text> : null}
        <View style={{ flex: 1 }} />
        <ShowMoreToggle
          expanded={expanded}
          hiddenCount={hiddenCount}
          onPress={() => setExpanded(!expanded)}
        />
      </View>
      <BottomSheetTextInput
        style={styles.searchInput}
        placeholder="Search banks…"
        value={q}
        onChangeText={setQ}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <View style={styles.pillRow}>
        {visible.slice(0, 60).map((b) => (
          <Pill key={b} label={b} active={selected.has(b)} onPress={() => toggle(b)} />
        ))}
      </View>
    </View>
  );
}

function RestaurantSection() {
  const offers = useAppStore((s) => s.data?.offers);
  const selectedCity = useAppStore((s) => s.selectedCity);
  const restaurants = useMemo(() => {
    const sel = (selectedCity || "all").toLowerCase();
    const allowed = (city: string) => sel === "all" || sel === city.toLowerCase();
    const all = (offers || [])
      .filter((o) => allowed(o.city))
      .map((o) => o.restaurant);
    return Array.from(new Set(all)).sort();
  }, [offers, selectedCity]);
  const selected = useAppStore((s) => s.selectedRestaurants);
  const toggle = useAppStore((s) => s.toggleRestaurant);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return restaurants.filter((r) => r.toLowerCase().includes(qq)).slice(0, 40);
  }, [restaurants, q]);
  return (
    <View style={styles.section}>
      <SectionLabel count={selected.size}>Restaurants</SectionLabel>
      <BottomSheetTextInput
        style={styles.searchInput}
        placeholder="Type to search…"
        value={q}
        onChangeText={setQ}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
      />
      <View style={styles.pillRow}>
        {Array.from(selected).map((name) => (
          <Pill key={`sel-${name}`} label={name} active onPress={() => toggle(name)} />
        ))}
        {filtered.map((r) =>
          selected.has(r) ? null : (
            <Pill key={r} label={r} onPress={() => toggle(r)} />
          )
        )}
      </View>
    </View>
  );
}

function CuisineSection() {
  const enrichment = useAppStore((s) => s.data?.restaurantsEnrichment);
  const cuisines = useMemo(() => {
    const set = new Set<string>();
    Object.values(enrichment || {}).forEach((e) => {
      (e.servesCuisine || []).forEach((c) => set.add(c));
    });
    return Array.from(set).sort();
  }, [enrichment]);
  const selected = useAppStore((s) => s.selectedCuisines);
  const toggle = useAppStore((s) => s.toggleCuisine);
  const [expanded, setExpanded] = useState(false);

  if (cuisines.length === 0) return null;

  const popularInData = POPULAR_CUISINES.filter((c) => cuisines.includes(c));
  const collapsed = useMemo(() => {
    const set = new Set<string>([...popularInData, ...Array.from(selected)]);
    return Array.from(set).filter((c) => cuisines.includes(c));
  }, [popularInData, selected, cuisines]);
  const visible = expanded ? cuisines : collapsed;
  const hiddenCount = Math.max(0, cuisines.length - collapsed.length);

  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Cuisines</Text>
        {selected.size ? <Text style={styles.sectionCount}>{selected.size}</Text> : null}
        <View style={{ flex: 1 }} />
        <ShowMoreToggle
          expanded={expanded}
          hiddenCount={hiddenCount}
          onPress={() => setExpanded(!expanded)}
        />
      </View>
      <View style={styles.pillRow}>
        {visible.map((c) => (
          <Pill key={c} label={c} active={selected.has(c)} onPress={() => toggle(c)} />
        ))}
      </View>
    </View>
  );
}

function EligibilitySection() {
  const monthlySalary = useAppStore((s) => s.monthlySalary);
  const accountBalance = useAppStore((s) => s.accountBalance);
  const setMonthly = useAppStore((s) => s.setMonthlySalary);
  const setBalance = useAppStore((s) => s.setAccountBalance);
  return (
    <View style={styles.section}>
      <SectionLabel>Eligibility</SectionLabel>
      <View style={styles.eligRow}>
        <View style={styles.eligField}>
          <Text style={styles.eligLabel}>Monthly salary</Text>
          <BottomSheetTextInput
            style={styles.searchInput}
            keyboardType="numeric"
            placeholder="e.g. 100,000"
            placeholderTextColor={colors.textDim}
            value={monthlySalary === null ? "" : String(monthlySalary)}
            onChangeText={(t) => setMonthly(t.trim() === "" ? null : Number(t.replace(/[^0-9]/g, "")) || null)}
          />
        </View>
        <View style={styles.eligField}>
          <Text style={styles.eligLabel}>Account balance</Text>
          <BottomSheetTextInput
            style={styles.searchInput}
            keyboardType="numeric"
            placeholder="e.g. 250,000"
            placeholderTextColor={colors.textDim}
            value={accountBalance === null ? "" : String(accountBalance)}
            onChangeText={(t) => setBalance(t.trim() === "" ? null : Number(t.replace(/[^0-9]/g, "")) || null)}
          />
        </View>
      </View>
    </View>
  );
}

function DaysSection() {
  const selected = useAppStore((s) => s.selectedDays);
  const toggle = useAppStore((s) => s.toggleDay);
  return (
    <View style={styles.section}>
      <SectionLabel>Going-out days</SectionLabel>
      <View style={styles.pillRow}>
        {DAY_SHORT.map((d, i) => (
          <Pill key={d} label={d} active={selected.has(i)} onPress={() => toggle(i)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  resetBtn: {
    color: colors.brand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  section: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCount: {
    marginLeft: spacing.xs,
    backgroundColor: colors.brand,
    color: colors.textOnBrand,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: typography.size.xs,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  showMore: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  bigValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  searchInput: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  eligRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  eligField: {
    flex: 1,
  },
  eligLabel: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginBottom: spacing.xs,
  },
  applyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bgElev,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    color: colors.textOnBrand,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
  },
});
