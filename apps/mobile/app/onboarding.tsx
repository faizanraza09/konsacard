import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  CreditCard,
  Globe,
  Landmark,
  MapPin,
  Receipt,
  Smartphone,
  Sparkles,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store";
import { colors, radii, shadow, spacing, typography } from "@/theme";

const KEY = "konsacard-onboarded-v1";

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Option = { value: string; label: string; sub?: string; Icon: IconType };

// First-run onboarding. Mirrors the web's 3-step onboarding (city → typical
// bill → card type): one lovely intro, then three questions that actually set
// state, so a brand-new user lands on a ranking personalized to them instead
// of the generic "all cities, PKR 10,000" default. The standalone "Find My
// Card" quiz (app/quiz.tsx) reuses the same questions — keep the two in step.
const STEPS: { key: string; question: string; caption: string; options: Option[] }[] = [
  {
    key: "city",
    question: "Where do you usually dine out?",
    caption: "Deals vary by city, so we'll focus on yours.",
    options: [
      { value: "all", label: "Multiple cities", Icon: Globe },
      { value: "karachi", label: "Karachi", Icon: MapPin },
      { value: "lahore", label: "Lahore", Icon: MapPin },
      { value: "islamabad", label: "Islamabad", Icon: MapPin },
    ],
  },
  {
    key: "orderValue",
    question: "What's a typical bill for you?",
    caption: "So your savings match what you usually spend.",
    options: [
      { value: "3000", label: "Under 5,000", sub: "PKR", Icon: Receipt },
      { value: "8000", label: "5,000 – 10,000", sub: "PKR", Icon: Receipt },
      { value: "15000", label: "10,000 – 20,000", sub: "PKR", Icon: Receipt },
      { value: "30000", label: "Over 20,000", sub: "PKR", Icon: Receipt },
    ],
  },
  {
    key: "cardType",
    question: "Which card works for you?",
    caption: "We'll only rank cards you can get.",
    options: [
      { value: "debit", label: "Debit card", Icon: Landmark },
      { value: "credit", label: "Credit card", Icon: CreditCard },
      { value: "other", label: "Digital wallet", Icon: Smartphone },
      { value: "all", label: "I'm open to all", Icon: Sparkles },
    ],
  },
];

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v !== "1";
  } catch {
    return true;
  }
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setCity = useAppStore((s) => s.setSelectedCity);
  const setCardTypes = useAppStore((s) => s.setCardTypes);
  const setOrderValue = useAppStore((s) => s.setOrderValue);

  // step 0 = intro, steps 1..3 = the three questions.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const markDone = async () => {
    try {
      await AsyncStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };

  // Skip = mark onboarded and browse the generic ranking (web parity escape).
  const skip = async () => {
    await markDone();
    router.replace("/");
  };

  const applyAndFinish = async (final: Record<string, string>) => {
    if (final.city) setCity(final.city);
    if (final.cardType && final.cardType !== "all") setCardTypes(new Set([final.cardType]));
    if (final.orderValue) setOrderValue(Number(final.orderValue));
    await markDone();
    router.replace("/");
  };

  const onPick = (value: string) => {
    const key = STEPS[step - 1].key;
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step >= STEPS.length) applyAndFinish(next);
    else setStep(step + 1);
  };

  // ── Intro ──────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.topRow}>
          <View />
          <Pressable onPress={skip} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.introBody}>
          <Image
            source={require("../assets/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="KonsaCard"
          />
          <Text style={styles.brandWord}>
            konsa<Text style={styles.brandWordAccent}>card</Text>
          </Text>
          <Text style={styles.introTitle}>The right card for every meal out.</Text>
          <Text style={styles.introBodyText}>
            Answer 3 quick questions and we'll show the cards that save you the
            most when you eat out.
          </Text>

          <View style={styles.stats}>
            <Stat value="21" label="banks" />
            <View style={styles.statDivider} />
            <Stat value="200+" label="cards" />
            <View style={styles.statDivider} />
            <Stat value="1,250+" label="restaurants" />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => setStep(1)}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.ctaText}>Get started</Text>
          <ChevronRight size={20} color={colors.textOnBrand} strokeWidth={2.5} />
        </Pressable>
      </View>
    );
  }

  // ── Question steps ─────────────────────────────────────────────────────
  const current = STEPS[step - 1];
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.topRow}>
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.segment, i <= step - 1 && styles.segmentActive]} />
          ))}
        </View>
        <Pressable onPress={skip} hitSlop={12} style={styles.skipBtn}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.qBody}>
        <Text style={styles.kicker}>STEP {step} OF {STEPS.length}</Text>
        <Text style={styles.question}>{current.question}</Text>
        <Text style={styles.caption}>{current.caption}</Text>

        <View style={styles.options}>
          {current.options.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => onPick(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
            >
              <View style={styles.optionIcon}>
                <o.Icon size={20} color={colors.brand} strokeWidth={2} />
              </View>
              <Text style={styles.optionText}>{o.label}</Text>
              {o.sub ? <Text style={styles.optionSub}>{o.sub}</Text> : null}
              <ChevronRight size={18} color={colors.textDim} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={() => setStep(step - 1)} style={styles.backBtn} hitSlop={8}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 },
  skipBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  skip: { color: colors.textDim, fontSize: typography.size.md, fontWeight: typography.weight.semibold },

  // Intro
  introBody: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.sm },
  logo: { width: 96, height: 96, borderRadius: radii.xl, marginBottom: spacing.lg },
  brandWord: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  brandWordAccent: { color: colors.brand },
  introTitle: {
    color: colors.text,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.black,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  introBodyText: {
    color: colors.textMid,
    fontSize: typography.size.md,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: spacing.sm,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xxxl,
    gap: spacing.lg,
  },
  stat: { alignItems: "center" },
  statValue: { color: colors.brand, fontSize: typography.size.xl, fontWeight: typography.weight.black },
  statLabel: { color: colors.textDim, fontSize: typography.size.xs, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  // Questions
  progress: { flexDirection: "row", gap: spacing.xs, flex: 1, marginRight: spacing.md },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  segmentActive: { backgroundColor: colors.brand },
  qBody: { flex: 1, justifyContent: "center" },
  kicker: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  question: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  caption: { color: colors.textMid, fontSize: typography.size.md, lineHeight: 21, marginTop: spacing.xs, marginBottom: spacing.xl },
  options: { gap: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgElev,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  optionPressed: { backgroundColor: colors.brandLight, borderColor: colors.brandMid, transform: [{ scale: 0.985 }] },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  optionSub: { color: colors.textDim, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, marginRight: spacing.xs },

  backBtn: { alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  backText: { color: colors.textDim, fontSize: typography.size.md, fontWeight: typography.weight.semibold },

  // CTA
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radii.pill,
    ...shadow.card,
  },
  ctaPressed: { backgroundColor: colors.brandDark, transform: [{ scale: 0.99 }] },
  ctaText: { color: colors.textOnBrand, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
});
