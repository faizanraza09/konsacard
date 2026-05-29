import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buildCardKey } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useAppStore } from "@/store";
import { colors, radii, spacing, typography } from "@/theme";

export function OwnedCardPicker() {
  const offers = useAppStore((s) => s.data?.offers);
  const cards = useMemo(() => {
    const set = new Set<string>();
    (offers || []).forEach((o) => set.add(buildCardKey(o.bank, o.card)));
    return Array.from(set);
  }, [offers]);
  const owned = useAppStore((s) => s.ownedCards);
  const toggle = useAppStore((s) => s.toggleOwnedCard);
  const [q, setQ] = useState("");

  const ownedArr = useMemo(() => Array.from(owned), [owned]);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return cards.filter((c) => c.toLowerCase().includes(qq) && !owned.has(c)).slice(0, 20);
  }, [cards, q, owned]);

  return (
    <View>
      <Text style={styles.label}>Your cards ({owned.size})</Text>
      <View style={styles.chips}>
        {ownedArr.map((ck) => {
          const [bank, card] = ck.split(" || ");
          return (
            <Pressable
              key={ck}
              style={styles.chip}
              onPress={() => {
                toggle(ck);
                track("owned_card_remove", { bank, card, total: owned.size - 1 });
              }}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {bank} • {card}
              </Text>
              <Text style={styles.chipX}>×</Text>
            </Pressable>
          );
        })}
        {owned.size === 0 ? (
          <Text style={styles.empty}>Add the cards you own to see what your wallet covers and which card to add next.</Text>
        ) : null}
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search to add a card (e.g. Allied gold)…"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        autoCorrect={false}
      />
      {filtered.map((ck) => {
        const [bank, card] = ck.split(" || ");
        return (
          <Pressable
            key={ck}
            onPress={() => {
              toggle(ck);
              setQ("");
              track("owned_card_add", { bank, card, total: owned.size + 1 });
            }}
            style={styles.suggestion}
          >
            <Text style={styles.suggestionText}>{bank} — {card}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    maxWidth: "100%",
  },
  chipText: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    maxWidth: 230,
  },
  chipX: {
    color: colors.textDim,
    fontSize: typography.size.md,
    marginLeft: spacing.xs,
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: colors.bgElev,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.text,
  },
  suggestion: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    color: colors.text,
    fontSize: typography.size.sm,
  },
});
