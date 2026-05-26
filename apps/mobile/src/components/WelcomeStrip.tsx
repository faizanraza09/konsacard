import { Sparkles } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { CardRecommendation } from "@/types";
import { formatCurrency } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme";

interface Props {
  topPick: CardRecommendation | null;
  cityLabel: string;
}

// A short, conversational strip that surfaces the *one* thing the user
// probably came for: the best card for tonight in their city, framed as a
// recommendation instead of a database stat. Sits above ResultsHeader.
//
// Designed to feel like a friend's text, not a dashboard: "Tonight's top
// pick: <card> saves PKR <n> at <restaurant>".
export function WelcomeStrip({ topPick, cityLabel }: Props) {
  if (!topPick) return null;

  const restaurant = topPick.topMatches[0]?.restaurant ?? null;
  const lead = greeting();

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Sparkles size={14} color={colors.brand} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.lead} numberOfLines={1}>
          {lead}
          {cityLabel ? ` · ${cityLabel}` : ""}
        </Text>
        <Text style={styles.value} numberOfLines={2}>
          <Text style={styles.valueBold}>{topPick.card}</Text>
          {restaurant
            ? ` saves ${formatCurrency(topPick.avgExpectedSaving)} at ${restaurant}`
            : ` saves ${formatCurrency(topPick.avgExpectedSaving)} per outing`}
        </Text>
      </View>
    </View>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Good morning";
  if (hour >= 11 && hour < 16) return "Good afternoon";
  if (hour >= 16 && hour < 21) return "Looking for dinner?";
  return "Late night plans?";
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgTint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElev,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  lead: {
    color: colors.brand,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginTop: 2,
    lineHeight: typography.size.sm + 4,
    fontVariant: ["tabular-nums"],
  },
  valueBold: {
    fontWeight: typography.weight.bold,
  },
});
