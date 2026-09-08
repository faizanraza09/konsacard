// Mirrors BANK_LOGO_FILES from card-match-pk/assets/state.js. Bank-name slugs
// are normalized identically to the web side so a single asset set serves both.

const BANK_LOGO_FILES: Record<string, string> = {
  albarakabank: "al-baraka-bank.png",
  alliedbank: "allied-bank.png",
  askaribanklimited: "askari-bank.png",
  bankalhabib: "bank-al-habib.png",
  bankalfalah: "bank-alfalah.png",
  bankofpunjab: "bank-of-punjab.png",
  bankislami: "bankislami.png",
  easypaisa: "easypaisa.png",
  faysalbanklimited: "faysal-bank.png",
  habibbanklimited: "hbl.png",
  habibmetrobank: "habib-metro.png",
  hblislamicbanklimited: "hbl-islamic.png",
  jsbank: "js-bank.png",
  mcbbanklimited: "mcb-bank.png",
  mcbislamicbankltd: "mcb-islamic.png",
  meezanbank: "meezan-bank.png",
  mobilinkmicrofinancebanklimited: "mobilink-microfinance-bank.png",
  nationalbankofpakistan: "national-bank-of-pakistan.png",
  soneribanklimited: "soneri-bank.png",
  standardcharteredbank: "standard-chartered.png",
  unitedbanklimitedubl: "ubl.png",
};

function bankKey(bank: string): string {
  return String(bank || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function getBankLogoUrl(bank: string): string | null {
  const file = BANK_LOGO_FILES[bankKey(bank)];
  if (!file) return null;
  const origin = (process.env.EXPO_PUBLIC_DATA_ORIGIN || "https://konsacard.pk").replace(/\/$/, "");
  return `${origin}/assets/bank-logos/${file}`;
}
