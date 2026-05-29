import { rankViaApi, rankApiEnabled } from "@/data";
import type { AlgorithmState } from "@/types";

// AsyncStorage is imported transitively by @/data; mock it so the module loads
// under jest without a native binding.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function makeState(over: Partial<AlgorithmState> = {}): AlgorithmState {
  return {
    data: null,
    requirements: null,
    selectedCity: "lahore",
    selectedDays: new Set([1, 3, 5]),
    selectedRestaurants: new Set(["KFC", "OPTP"]),
    selectedBanks: new Set(["HBL"]),
    selectedCardTypes: new Set(["credit"]),
    selectedCards: new Set(["HBL || Platinum"]),
    selectedCuisines: new Set(["Fast Food"]),
    orderValue: 25000,
    useEligibility: true,
    monthlySalary: 150000,
    accountBalance: null,
    outingsPerWeek: 3,
    ownedCards: new Set(["HBL || Green"]),
    walletSize: 2,
    walletBuildOnOwned: false,
    walletMaxFee: null,
    walletNoSameBank: false,
    walletMixedTypes: false,
    walletObjective: "savings",
    walletMustInclude: new Set(),
    favoriteRestaurants: new Set(),
    ...over,
  };
}

describe("rankApiEnabled", () => {
  const prev = process.env.EXPO_PUBLIC_USE_RANK_API;
  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_RANK_API = prev;
  });

  it("defaults ON when unset", () => {
    delete process.env.EXPO_PUBLIC_USE_RANK_API;
    expect(rankApiEnabled()).toBe(true);
  });

  it.each(["0", "false", "off", "no", "FALSE"])("is OFF for %s", (v) => {
    process.env.EXPO_PUBLIC_USE_RANK_API = v;
    expect(rankApiEnabled()).toBe(false);
  });

  it("is ON for 1/true", () => {
    process.env.EXPO_PUBLIC_USE_RANK_API = "1";
    expect(rankApiEnabled()).toBe(true);
  });
});

describe("rankViaApi payload serialization", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("converts Sets to arrays, maps city, and omits raw/wallet fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as never)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ recs: [{ bank: "HBL", card: "Platinum" }] }),
      } as never);

    const recs = await rankViaApi(makeState());
    expect(recs).toEqual([{ bank: "HBL", card: "Platinum" }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/rank$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json"
    );

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      city: "lahore",
      orderValue: 25000,
      selectedDays: [1, 3, 5],
      selectedRestaurants: ["KFC", "OPTP"],
      selectedBanks: ["HBL"],
      selectedCardTypes: ["credit"],
      selectedCards: ["HBL || Platinum"],
      selectedCuisines: ["Fast Food"],
      monthlySalary: 150000,
      accountBalance: null,
      useEligibility: true,
      outingsPerWeek: 3,
    });
    // Never leak the heavy / irrelevant state to the server.
    expect(body).not.toHaveProperty("data");
    expect(body).not.toHaveProperty("requirements");
    expect(body).not.toHaveProperty("ownedCards");
    expect(body).not.toHaveProperty("walletSize");
  });

  it("includes limit/offset only when provided", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch" as never)
      .mockResolvedValue({ ok: true, json: async () => ({ recs: [] }) } as never);

    await rankViaApi(makeState(), { limit: 20, offset: 40 });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    );
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(40);
  });

  it("throws on non-2xx so callers can fall back", async () => {
    jest
      .spyOn(global, "fetch" as never)
      .mockResolvedValue({ ok: false, status: 500 } as never);
    await expect(rankViaApi(makeState())).rejects.toThrow(/500/);
  });
});
