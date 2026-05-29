import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { loadOffers, loadRequirements } from "@/data";
import type {
  AlgorithmState,
  OffersBundle,
  RequirementsPack,
  SummaryBundle,
  ViewMode,
  WalletObjective,
} from "@/types";
import type { SavingWindow } from "@/lib/algorithms";

// Persistable subset of state. We store Sets as arrays in JSON and rehydrate.
interface PersistedShape {
  selectedCity: string;
  selectedDays: number[];
  selectedRestaurants: string[];
  selectedBanks: string[];
  selectedCardTypes: string[];
  selectedCards: string[];
  selectedCuisines: string[];
  orderValue: number;
  useEligibility: boolean;
  monthlySalary: number | null;
  accountBalance: number | null;
  outingsPerWeek: number;
  ownedCards: string[];
  walletSize: number;
  walletBuildOnOwned: boolean;
  walletMaxFee: number | null;
  walletNoSameBank: boolean;
  walletMixedTypes: boolean;
  walletObjective: WalletObjective;
  walletMustInclude: string[];
  favoriteRestaurants: string[];
  compareList: string[];
  viewMode: ViewMode;
  savingWindow: SavingWindow;
}

export interface AppState extends AlgorithmState {
  viewMode: ViewMode;
  bootstrapping: boolean;
  hydrated: boolean;
  /** Precomputed cold-start summary (small). Used to render the Cards tab at
   * the default scope without loading the ~21 MB raw offers. */
  summary: SummaryBundle | null;
  /** True while raw offers are being lazily fetched on demand. */
  rawLoading: boolean;
  /** Card keys (in `${bank} || ${card}` shape) the user is staging for the
   * compare modal. Capped at 2 by `toggleCompare`. UI state, not algorithm
   * state — left out of AlgorithmState so it doesn't pollute the algorithm
   * signature. */
  compareList: string[];
  /** Saving-window view for the per-card hero saving: /outing | /month | /year.
   * UI-only (display reframing of the same per-outing number) — deliberately
   * kept out of AlgorithmState so it doesn't bust the recommendation cache. */
  savingWindow: SavingWindow;
  setSavingWindow: (w: SavingWindow) => void;
  toggleCompare: (cardKey: string) => void;
  clearCompare: () => void;
  setData: (data: OffersBundle, requirements: RequirementsPack | null) => void;
  setSummary: (summary: SummaryBundle) => void;
  /** Idempotent lazy loader: if raw `data` isn't loaded yet, fetch it once and
   * call `setData`. Concurrent callers share a single in-flight promise. */
  ensureRawOffers: () => Promise<void>;
  setBootstrapping: (v: boolean) => void;
  setViewMode: (v: ViewMode) => void;
  setSelectedCity: (city: string) => void;
  toggleDay: (day: number) => void;
  setDays: (days: Set<number>) => void;
  toggleRestaurant: (name: string) => void;
  setRestaurants: (names: Set<string>) => void;
  toggleBank: (bank: string) => void;
  setBanks: (b: Set<string>) => void;
  toggleCardType: (t: string) => void;
  setCardTypes: (t: Set<string>) => void;
  toggleCuisine: (c: string) => void;
  setCuisines: (s: Set<string>) => void;
  setOrderValue: (v: number) => void;
  setOutingsPerWeek: (v: number) => void;
  setMonthlySalary: (v: number | null) => void;
  setAccountBalance: (v: number | null) => void;
  setUseEligibility: (v: boolean) => void;
  toggleOwnedCard: (cardKey: string) => void;
  setOwnedCards: (s: Set<string>) => void;
  setWalletSize: (k: number) => void;
  setWalletBuildOnOwned: (v: boolean) => void;
  setWalletMaxFee: (v: number | null) => void;
  setWalletNoSameBank: (v: boolean) => void;
  setWalletMixedTypes: (v: boolean) => void;
  setWalletObjective: (o: WalletObjective) => void;
  toggleMustInclude: (cardKey: string) => void;
  setMustInclude: (s: Set<string>) => void;
  toggleFavorite: (name: string) => void;
  resetFilters: () => void;
}

const defaults: AlgorithmState & { viewMode: ViewMode } = {
  data: null,
  requirements: null,
  selectedCity: "all",
  selectedDays: new Set<number>(),
  selectedRestaurants: new Set<string>(),
  selectedBanks: new Set<string>(),
  selectedCardTypes: new Set<string>(),
  selectedCards: new Set<string>(),
  selectedCuisines: new Set<string>(),
  orderValue: 10000,
  useEligibility: false,
  monthlySalary: null,
  accountBalance: null,
  outingsPerWeek: 1,
  ownedCards: new Set<string>(),
  walletSize: 2,
  walletBuildOnOwned: false,
  walletMaxFee: null,
  walletNoSameBank: false,
  walletMixedTypes: false,
  walletObjective: "savings",
  walletMustInclude: new Set<string>(),
  favoriteRestaurants: new Set<string>(),
  viewMode: "cards",
};

// Module-level memo of the in-flight raw-offers load so concurrent
// `ensureRawOffers()` callers (multiple screens mounting at once) share one
// fetch instead of each kicking off their own ~21 MB download.
let rawOffersInFlight: Promise<void> | null = null;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaults,
      bootstrapping: true,
      hydrated: false,
      summary: null,
      rawLoading: false,
      compareList: [],
      savingWindow: "yr",

      setSavingWindow: (savingWindow) => set({ savingWindow }),
      toggleCompare: (cardKey) =>
        set((s) => {
          if (s.compareList.includes(cardKey)) {
            return { compareList: s.compareList.filter((k) => k !== cardKey) };
          }
          if (s.compareList.length >= 2) return s; // cap at 2
          return { compareList: [...s.compareList, cardKey] };
        }),
      clearCompare: () => set({ compareList: [] }),

      setData: (data, requirements) =>
        set((s) => ({
          data,
          // Preserve already-loaded requirements when a lazy raw-load passes
          // null (boot loaded them separately).
          requirements: requirements ?? s.requirements,
          bootstrapping: false,
        })),
      setSummary: (summary) => set({ summary }),
      ensureRawOffers: () => {
        if (get().data) return Promise.resolve();
        if (rawOffersInFlight) return rawOffersInFlight;
        set({ rawLoading: true });
        rawOffersInFlight = (async () => {
          try {
            // Requirements are normally loaded at boot; load them here too in
            // case boot took the summary path and they aren't present yet.
            const needReqs = !get().requirements;
            const [bundle, reqs] = await Promise.all([
              loadOffers(),
              needReqs ? loadRequirements() : Promise.resolve(null),
            ]);
            get().setData(bundle, reqs);
          } finally {
            set({ rawLoading: false });
            rawOffersInFlight = null;
          }
        })();
        return rawOffersInFlight;
      },
      setBootstrapping: (v) => set({ bootstrapping: v }),
      setViewMode: (viewMode) => set({ viewMode }),
      setSelectedCity: (selectedCity) => set({ selectedCity }),

      toggleDay: (day) =>
        set((s) => {
          const next = new Set(s.selectedDays);
          if (next.has(day)) next.delete(day);
          else next.add(day);
          return { selectedDays: next };
        }),
      setDays: (selectedDays) => set({ selectedDays }),

      toggleRestaurant: (name) =>
        set((s) => {
          const next = new Set(s.selectedRestaurants);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return { selectedRestaurants: next };
        }),
      setRestaurants: (s) => set({ selectedRestaurants: s }),

      toggleBank: (bank) =>
        set((s) => {
          const next = new Set(s.selectedBanks);
          if (next.has(bank)) next.delete(bank);
          else next.add(bank);
          return { selectedBanks: next };
        }),
      setBanks: (s) => set({ selectedBanks: s }),

      toggleCardType: (t) =>
        set((s) => {
          const next = new Set(s.selectedCardTypes);
          if (next.has(t)) next.delete(t);
          else next.add(t);
          return { selectedCardTypes: next };
        }),
      setCardTypes: (s) => set({ selectedCardTypes: s }),

      toggleCuisine: (c) =>
        set((s) => {
          const next = new Set(s.selectedCuisines);
          if (next.has(c)) next.delete(c);
          else next.add(c);
          return { selectedCuisines: next };
        }),
      setCuisines: (s) => set({ selectedCuisines: s }),

      setOrderValue: (orderValue) => set({ orderValue }),
      setOutingsPerWeek: (outingsPerWeek) => set({ outingsPerWeek }),
      setMonthlySalary: (monthlySalary) =>
        set((s) => ({
          monthlySalary,
          useEligibility: monthlySalary !== null || s.accountBalance !== null || s.useEligibility,
        })),
      setAccountBalance: (accountBalance) =>
        set((s) => ({
          accountBalance,
          useEligibility: accountBalance !== null || s.monthlySalary !== null || s.useEligibility,
        })),
      setUseEligibility: (useEligibility) => set({ useEligibility }),

      toggleOwnedCard: (cardKey) =>
        set((s) => {
          const next = new Set(s.ownedCards);
          if (next.has(cardKey)) next.delete(cardKey);
          else next.add(cardKey);
          return { ownedCards: next };
        }),
      setOwnedCards: (s) => set({ ownedCards: s }),

      setWalletSize: (walletSize) => set({ walletSize: Math.max(2, Math.min(4, walletSize)) }),
      setWalletBuildOnOwned: (walletBuildOnOwned) => set({ walletBuildOnOwned }),
      setWalletMaxFee: (walletMaxFee) => set({ walletMaxFee }),
      setWalletNoSameBank: (walletNoSameBank) => set({ walletNoSameBank }),
      setWalletMixedTypes: (walletMixedTypes) => set({ walletMixedTypes }),
      setWalletObjective: (walletObjective) => set({ walletObjective }),

      toggleMustInclude: (cardKey) =>
        set((s) => {
          const next = new Set(s.walletMustInclude);
          if (next.has(cardKey)) next.delete(cardKey);
          else next.add(cardKey);
          return { walletMustInclude: next };
        }),
      setMustInclude: (s) => set({ walletMustInclude: s }),

      toggleFavorite: (name) =>
        set((s) => {
          const next = new Set(s.favoriteRestaurants);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return { favoriteRestaurants: next };
        }),

      resetFilters: () =>
        set((s) => ({
          selectedDays: new Set<number>(),
          selectedRestaurants: new Set<string>(),
          selectedBanks: new Set<string>(),
          selectedCardTypes: new Set<string>(),
          selectedCards: new Set<string>(),
          selectedCuisines: new Set<string>(),
          orderValue: 10000,
          outingsPerWeek: 1,
          monthlySalary: null,
          accountBalance: null,
          useEligibility: false,
        })),
    }),
    {
      name: "konsacard-state-v1",
      storage: createJSONStorage<AppState>(() => AsyncStorage, {
        // Sets are not JSON-native — convert at the boundary.
        replacer: (_key, value) => {
          if (value instanceof Set) return { __set: Array.from(value) };
          return value;
        },
        reviver: (_key, value) => {
          if (
            value &&
            typeof value === "object" &&
            "__set" in value &&
            Array.isArray((value as { __set: unknown }).__set)
          ) {
            return new Set((value as { __set: unknown[] }).__set);
          }
          return value;
        },
      }),
      partialize: (state) =>
        ({
          selectedCity: state.selectedCity,
          selectedDays: state.selectedDays,
          selectedRestaurants: state.selectedRestaurants,
          selectedBanks: state.selectedBanks,
          selectedCardTypes: state.selectedCardTypes,
          selectedCards: state.selectedCards,
          selectedCuisines: state.selectedCuisines,
          orderValue: state.orderValue,
          useEligibility: state.useEligibility,
          monthlySalary: state.monthlySalary,
          accountBalance: state.accountBalance,
          outingsPerWeek: state.outingsPerWeek,
          ownedCards: state.ownedCards,
          walletSize: state.walletSize,
          walletBuildOnOwned: state.walletBuildOnOwned,
          walletMaxFee: state.walletMaxFee,
          walletNoSameBank: state.walletNoSameBank,
          walletMixedTypes: state.walletMixedTypes,
          walletObjective: state.walletObjective,
          walletMustInclude: state.walletMustInclude,
          favoriteRestaurants: state.favoriteRestaurants,
          viewMode: state.viewMode,
          savingWindow: state.savingWindow,
        }) as unknown as AppState,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hydrated = true;
      },
    }
  )
);

export type { PersistedShape };
