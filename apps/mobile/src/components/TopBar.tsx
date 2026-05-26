import { Link } from "expo-router";
import { MessageCircle, Target, Zap } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme";

// Single primary action on the top bar — Swipe, the high-engagement gimmick.
// Quiz and Chat are demoted to icon-only secondary actions; they still live
// here so first-time users discover them, but they no longer fight Swipe for
// the user's eye.
export function TopBar() {
  return (
    <View style={styles.row}>
      <Text style={styles.wordmark} numberOfLines={1}>
        konsa<Text style={styles.brand}>card</Text>
      </Text>
      <View style={styles.actions}>
        <Link href="/chat" asChild>
          <Pressable
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityLabel="Ask KonsaCard"
            accessibilityRole="button"
          >
            <MessageCircle size={18} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        </Link>
        <Link href="/quiz" asChild>
          <Pressable
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityLabel="Find my card quiz"
            accessibilityRole="button"
          >
            <Target size={18} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        </Link>
        <Link href="/swipe" asChild>
          <Pressable
            style={styles.ctaBtn}
            hitSlop={4}
            accessibilityLabel="Swipe lookup"
            accessibilityRole="button"
          >
            <Zap size={16} color={colors.textOnBrand} strokeWidth={2.5} fill={colors.textOnBrand} />
            <Text style={styles.ctaBtnText}>Swipe</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    flex: 1,
    letterSpacing: -0.3,
  },
  brand: { color: colors.brand },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElev,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  ctaBtnText: {
    color: colors.textOnBrand,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
