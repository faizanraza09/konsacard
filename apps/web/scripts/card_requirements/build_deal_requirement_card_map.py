import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"
CARDS_PATH = ROOT / "data" / "card-requirements" / "normalized" / "cards.json"
OUT_DIR = ROOT / "data" / "card-requirements" / "normalized"


BANK_NAME_MAP = {
    "Al Baraka Bank": "Al Baraka Bank",
    "Allied Bank": "Allied Bank",
    "Askari Bank Limited": "Askari Bank Limited",
    "Bank AL Habib": "Bank AL Habib",
    "Bank Alfalah": "Bank Alfalah",
    "Bank of Punjab": "Bank of Punjab",
    "BankIslami": "BankIslami",
    "Easypaisa": "Easypaisa",
    "Faysal Bank Limited": "Faysal Bank Limited",
    "HBL Islamic Bank Limited": "HBL Islamic Bank Limited",
    "Habib Bank Limited": "HBL",
    "Habib Metro Bank": "Habib Metro Bank",
    "JS Bank": "JS Bank",
    "MCB Bank Limited": "MCB Bank Limited",
    "MCB Islamic Bank Ltd": "MCB Islamic Bank Ltd",
    "Meezan Bank": "Meezan Bank",
    "National Bank of Pakistan": "National Bank of Pakistan",
    "NBP": "National Bank of Pakistan",
    "Standard Chartered Bank": "Standard Chartered Bank Pakistan",
    "United Bank Limited (UBL)": "United Bank Limited (UBL)",
}


MANUAL_ALIASES = {
    "Al Baraka Bank": {
        "PayPak Debit Card": "PayPak Standard Debit Card",
        "Nexgen Habib University PayPak Debit Card": "Nexgen Student PayPak Debit Card",
        "Nexgen IVS PayPak Debit Card": "Nexgen Student PayPak Debit Card",
        "Nexgen Riphah University PayPak Debit Card": "Nexgen Student PayPak Debit Card",
        "Mastercard World Elite Debit Card": "Mastercard Platinum Debit Card",
    },
    "Allied Bank": {
        "Cash+Shop Classic Visa Debit Card": "Allied Visa Classic Debit Card",
        "Cash+Shop Sapphire 200 Visa Debit Card": "Allied Visa Platinum Debit Card",
        "Gold UPI & PayPak Debit Card": "Allied UnionPay & PayPak Gold Debit Card",
        "Classic UPI & PayPak Debit Card": "Allied UnionPay PayPak Classic Debit Card",
        "Classic Plus UPI & PayPak Debit Card": "Allied UPI & PayPak Classic Plus",
        "Khanum Classic Plus UPI & PayPak Debit Card": "Allied UPI & PayPak Classic Plus",
        "UnionPay PayPak Basic Debit Card": "Allied Basic Debit Card",
        "Youth VISA DebitCard": "Allied Youth Visa Debit Card",
        "UPI & Paypak myWallet Debit Card": "Allied UPI & PayPak Classic Plus",
        "UnionPay PayPak Prepaid Card": "Allied UnionPay PayPak Classic Debit Card",
    },
    "Askari Bank Limited": {
        "Askari Classic Credit Card": "Askari Mastercard Classic Credit Card",
        "Askari Gold Credit Card": "Askari Mastercard Gold Credit Card",
        "Askari Platinum Credit Card": "Askari Mastercard Platinum Credit Card",
        "Askari PayPak Gold Debit Card": "Askari PayPak Debit Card Gold",
        "Askari Visa Classic Debit Card": "Askari Visa Debit Card Classic",
        "Askari World Credit Card": "Askari World Mastercard Credit Card",
        "Askari Corporate Credit Card": "Askari Mastercard Classic Credit Card",
        "Askari PayPak Classic Debit Card": "Askari PayPak Debit Card Gold",
        "Askari PayPak Little Champs Debit Card": "Askari Visa Debit Card Classic",
        "Askari Sahar Visa Debit Card": "Askari Visa Debit Card Classic",
        "Askari Visa Gold Debit Card": "Askari Visa Debit Card Classic",
        "Askari Visa Platinum Debit Card": "Askari Visa Signature Debit Card",
    },
    "Bank AL Habib": {
        "AL Habib Digital Visa Gold Debit Card": "AL Habib Digital Account Gold Debit Card",
        "AL Habib Digital Visa Silver Debit Card": "AL Habib Digital Account Classic Debit Card",
        "AL Habib Remit Visa Silver Debit Card": "AL Habib Remit Debit Card",
        "AL Habib Woman Visa Silver Debit Card": "AL Habib Woman Debit Card",
        "BAHL UnionPay Apna Debit Card": "BAHL UnionPay Apna Debit Card",
        "BAHL UnionPay Debit Card": "BAHL UnionPay Debit Card",
        "Mastercard Gold Credit Card": "AL Habib Gold Credit Card",
        "Mastercard Green Credit Card": "AL Habib Green Credit Card",
        "PayPak Debit Card": "PayPak Debit Card",
        "Visa Gold Debit Card": "Visa Gold Debit Card",
        "Visa Signature Debit Card": "Signature Debit Card",
        "Visa Silver Debit Card": "Visa Silver Debit Card",
    },
    "Bank Alfalah": {
        "Bank Alfalah American Express Gold Credit Card": "Bank Alfalah American Express Gold Credit Card",
        "Bank Alfalah Islamic Power Pack Signature Debit Card": "Bank Alfalah Islamic Power Pack Signature Debit Card",
        "Bank Alfalah Islamic Premier Visa Signature Debit Card": "Bank Alfalah Islamic Premier Visa Signature Debit Card",
        "Bank Alfalah Islamic Women Power Pack Visa Debit Card": "Bank Alfalah Islamic Power Pack Women Debit Card",
        "Bank Alfalah Islamic Women Visa Gold Debit Card": "Bank Alfalah Islamic Gold Women Debit Card",
        "Bank Alfalah Mastercard Optimus Credit Card": "Bank Alfalah Mastercard Optimus Credit Card",
        "Bank Alfalah PayPak Classic Debit Card": "Bank Alfalah PayPak Classic Debit Card",
        "Bank Alfalah PayPak Islamic Classic Debit Card": "Bank Alfalah PayPak Islamic Classic Debit Card",
        "Bank Alfalah Islamic Premier Visa Infinite Debit Card": "Bank Alfalah Visa Infinite Islamic Debit Card",
        "Bank Alfalah Pehchaan Visa Debit Card": "Bank Alfalah Pehchaan Debit Card",
        "Bank Alfalah Premier Visa Infinite Credit Card": "Bank Alfalah Premier Visa Signature Credit Card",
        "Bank Alfalah Premier Visa Infinite Debit Card": "Bank Alfalah Visa Infinite Debit Card",
        "Bank Alfalah Premier Visa Platinum Credit Card": "Bank Alfalah Premier Visa Platinum Credit Card",
        "Bank Alfalah Premier Visa Signature Debit Card": "Bank Alfalah Premier Visa Signature Debit Card",
        "Bank Alfalah Ultra Visa Credit Card": "Bank Alfalah Visa Ultra Cashback Card",
        "Bank Alfalah Visa Classic Credit Card": "Visa Classic Credit Card",
        "Bank Alfalah Visa Classic Debit Card": "Visa Classic Debit Card",
        "Bank Alfalah Visa Corporate Credit Card": "Bank Alfalah Visa Corporate Credit Card",
        "Bank Alfalah Visa Gold Credit Card": "Visa Gold Credit Card",
        "Bank Alfalah Visa Gold Debit Card": "Visa Gold Debit Card",
        "Bank Alfalah Visa Islamic Classic Debit Card": "Bank Alfalah Visa Islamic Classic Debit Card",
        "Bank Alfalah Visa Islamic Gold Debit Card": "Bank Alfalah Visa Islamic Gold Debit Card",
        "Bank Alfalah Visa Islamic Signature Debit Card": "Bank Alfalah Visa Islamic Signature Debit Card",
        "Bank Alfalah Visa Platinum Credit Card": "Bank Alfalah Visa Platinum Credit Card",
        "Bank Alfalah Visa Platinum Debit Card": "Visa Platinum Debit Card",
        "Bank Alfalah Visa Signature Debit Card": "Visa Signature Debit Card",
    },
    "Bank of Punjab": {
        "KHAAS Platinum Mastercard Debit Card": "BOP KHAAS Platinum Debit Card",
        "Lahore Qalandar's Mastercard Debit Card": "BOP Lahore Qalandars Debit Card",
        "Lahore Qalandars Gold Credit Card": "BOP Mastercard Lahore Qalandar Business Credit Card",
        "Mastercard Gold Debit Card": "BOP Mastercard Gold Debit Card",
        "Mastercard Platinum Credit Card": "BOP Mastercard Platinum Credit Card",
        "Mastercard Platinum Debit Card": "BOP Mastercard Platinum Debit Card",
        "Mastercard Silver Debit Card": "BOP Mastercard Classic Debit Card",
        "Mastercard Taqwa KHAAS Platinum Islamic Debit Card": "BOP Taqwa KHAAS Platinum Islamic Debit Card",
        "Mastercard Taqwa Platinum Islamic Debit Card": "BOP Taqwa Platinum Islamic Debit Card",
        "Mastercard Taqwa World Islamic Debit Card": "BOP Taqwa World Islamic Debit Card",
        "Mastercard Women Naaz Debit Card": "BOP Naaz Debit Card",
        "Mastercard World Credit Card": "BOP Mastercard World Credit Card",
        "Mastercard World Debit Card": "BOP World Debit Card",
    },
    "BankIslami": {
        "Mastercard Classic Debit Card": "Classic Debit Mastercard",
        "Mastercard Titanium Debit Card": "Titanium Debit Mastercard",
    },
    "Faysal Bank Limited": {
        "Amal Mastercard Gold Debit Card": "Faysal Islami Mastercard Amal Gold Debit Card",
        "Amal Mastercard Platinum Debit Card": "Faysal Islami Mastercard Amal Platinum Debit Card",
        "Faysal Islami Noor Gold  Card": "Faysal Islami Noor Gold Card",
        "Faysal Islami Noor Titanium  Card": "Faysal Islami Noor Titanium Card",
        "Faysal Islami Noor World  Card": "Faysal Islami Noor World Card",
    },
    "HBL Islamic Bank Limited": {
        "HBL Islamic Classic Business DebitCard": "HBL Islamic Business DebitCard",
        "HBL Islamic Classic DebitCard": "HBL Islamic Mastercard Standard Debit Card",
        "HBL Islamic Gold DebitCard": "HBL Islamic Mastercard Gold Debit Card",
        "HBL Islamic World Business DebitCard": "HBL World Islamic Business DebitCard",
        "HBL Islamic World DebitCard": "HBL Islamic World Debit Card",
        "HBL Islamic World Elite DebitCard": "HBL Islamic Prestige World Elite DebitCard",
    },
    "Habib Bank Limited": {
        "HBL DebitCard": "HBL Classic DebitCard",
        "HBL Classic Business DebitCard": "HBL Business DebitCard",
        "HBL Gold DebitCard": "HBL Gold DebitCard",
        "HBL Visa Infinite CreditCard": "HBL Platinum CreditCard",
        "HBL World Business DebitCard": "HBL World Business DebitCard",
        "HBL World DebitCard": "HBL World DebitCard",
        "HBL World Elite DebitCard": "HBL Prestige World Elite DebitCard",
        "HBL Konnect Debit Card": "HBL Classic DebitCard",
    },
    "Habib Metro Bank": {
        "Visa Classic Debit Card": "Visa Classic Debit Card",
        "Visa Gold Debit Card": "Visa Gold Debit Card",
        "Visa Platinum Debit Card": "Visa Platinum Debit Card",
        "Visa Signature Business Card": "Business Debit Card",
    },
    "JS Bank": {
        "Visa Classic Credit Card": "JS Credit Card Classic",
        "Visa Platinum Credit Card": "JS Credit Card Platinum",
    },
    "MCB Bank Limited": {
        "PayPak Classic Debit Card": "PayPak Debit Card",
        "PayPak Gold Debit Card": "PayPak Debit Card",
        "Visa Platinum Debit Card": "MCB Visa Platinum Debit Card",
        "Visa Signature Debit Card": "MCB Visa Signature Debit Card",
    },
    "MCB Islamic Bank Ltd": {
        "PayPak Classic Debit Card": "MCB Islamic PayPak Classic Debit Card",
        "UnionPay Qadar Classic Debit Card": "MCB Islamic Qadar Classic Debit Card",
        "UnionPay Qadar Gold Debit Card": "MCB Islamic Qadar Gold Debit Card",
        "Visa Classic Debit Card": "MCB Islamic Visa Classic Debit Card",
        "Visa Platinum Debit Card": "MCB Islamic Platinum Debit Card",
        "Visa Platinum Business Debit Card": "MCB Islamic Platinum Debit Card",
        "UnionPay Platinum Debit Card": "MCB Islamic Platinum Debit Card",
        "Visa FCY Debit Card": "MCB Islamic Visa Classic Debit Card",
        "Visa Gold Debit Card": "MCB Islamic Qadar Gold Debit Card",
        "Visa Junior Club Debit Card": "MCB Islamic Visa Classic Debit Card",
        "Visa Niswan Debit Card": "MCB Islamic Visa Classic Debit Card",
    },
    "Meezan Bank": {
        "Classic Mastercard Debit Card": "Meezan Master Classic Debit Card",
        "Classic Visa Debit Card": "Meezan Visa Silver Debit Card",
        "Gold Visa Debit Card": "Meezan Visa Gold Debit Card",
        "Kids Club Visa Debit Card - Boys": "Meezan Kids & Teens Card",
        "Kids Club Visa Debit Card - Girls": "Meezan Kids & Teens Card",
        "PayPak Debit Card": "Meezan PayPak Debit Card",
        "Platinum Mastercard Debit Card": "Meezan Platinum MasterCard Debit Card",
        "Platinum Visa Debit Card": "Meezan Visa Platinum Debit Card",
        "Titanium Mastercard Debit Card": "Meezan Titanium MasterCard Debit Card",
        "Visa Infinite Debit Card": "Meezan Visa Infinite Debit Card",
        "Visa Student Debit Card": "Meezan Visa Student Debit Card",
        "Visa Women First Debit Card": "Meezan Women First Debit Card",
        "Mastercard World Debit Card": "Meezan World Debit Card",
        "Visa Charge Card": "Meezan Visa Gold Debit Card",
    },
    "United Bank Limited (UBL)": {
        "UBL Mastercard Signature Debit Card": "UBL Mastercard Signature Debit Card",
        "UBL Ameen Premium Debit Mastercard": "UBL Ameen Premium Debit MasterCard",
        "UBL Ameen PayPak Debit Card": "UBL PayPak Debit Card",
        "UBL Ameen VISA Premium Debit Card": "UBL Visa Premium Debit Card",
        "UBL Mastercard WIZ Virtual Prepaid Card": "UBL Wiz Virtual Prepaid Card",
        "UBL Pay Pak Debit Card": "UBL PayPak Debit Card",
        "UBL Union Pay Debit Card": "UBL UnionPay International Debit Card",
        "UBL Urooj Visa Debit Card": "UBL Visa Urooj Debit Card",
        "UBL VISA Premium Debit Card": "UBL Visa Premium Debit Card",
        "UBL Visa Classic Credit Card": "UBL Credit Card Classic",
        "UBL Visa Freelancer Debit Card": "UBL Visa Freelancer Debit Card",
        "UBL Visa Gold Credit Card": "UBL Credit Card Gold",
        "Visa FCY Business Debit Card": "UBL Visa FCY Business Debit Card",
        "UBL Visa Infinite Debit Card": "UBL Visa Infinite Debit Card",
        "UBL Visa Platinum Credit Card": "UBL Visa Platinum Credit Card",
        "UBL Visa Premium Plus Debit Card": "UBL Visa Premium Debit Card",
    },
}


def canon(value: str) -> str:
    value = value.lower()
    value = value.replace("&", " and ")
    value = value.replace("debitcard", "debit card").replace("creditcard", "credit card")
    value = re.sub(
        r"\b(bank|alfalah|allied|askari|bahl|habib|metro|meezan|mcb|ubl|hbl|bop|js|faysal)\b",
        " ",
        value,
    )
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def main() -> None:
    with OFFERS_PATH.open("r", encoding="utf-8") as handle:
        offers = json.load(handle)["offers"]
    with CARDS_PATH.open("r", encoding="utf-8") as handle:
        req_cards = json.load(handle)

    deal_cards_by_bank = defaultdict(set)
    for offer in offers:
        deal_cards_by_bank[offer["bank"]].add(offer["card"])

    req_cards_by_bank = defaultdict(list)
    req_card_by_bank_and_name = {}
    req_canon_by_bank = defaultdict(lambda: defaultdict(list))
    for card in req_cards:
        req_cards_by_bank[card["bank_name"]].append(card)
        req_card_by_bank_and_name[(card["bank_name"], card["card_name"])] = card
        req_canon_by_bank[card["bank_name"]][canon(card["card_name"])].append(card)

    mappings = []
    summary = []

    for deal_bank in sorted(deal_cards_by_bank):
        req_bank = BANK_NAME_MAP.get(deal_bank)
        matched = 0
        unmatched = []
        manual_aliases = MANUAL_ALIASES.get(deal_bank, {})

        for deal_card_name in sorted(deal_cards_by_bank[deal_bank]):
            mapping = {
                "deal_bank_name": deal_bank,
                "requirement_bank_name": req_bank,
                "deal_card_name": deal_card_name,
                "matched": False,
                "match_method": None,
                "requirement_card_id": None,
                "requirement_card_name": None,
            }

            if req_bank is None:
                mapping["match_method"] = "unmapped_bank"
            else:
                alias_target = manual_aliases.get(deal_card_name)
                if alias_target:
                    card = req_card_by_bank_and_name.get((req_bank, alias_target))
                    if card:
                        mapping.update(
                            {
                                "matched": True,
                                "match_method": "manual_alias",
                                "requirement_card_id": card["card_id"],
                                "requirement_card_name": card["card_name"],
                            }
                        )
                else:
                    candidates = req_canon_by_bank[req_bank].get(canon(deal_card_name), [])
                    if len(candidates) == 1:
                        card = candidates[0]
                        mapping.update(
                            {
                                "matched": True,
                                "match_method": "canonical_exact",
                                "requirement_card_id": card["card_id"],
                                "requirement_card_name": card["card_name"],
                            }
                        )

            if mapping["matched"]:
                matched += 1
            else:
                unmatched.append(deal_card_name)

            mappings.append(mapping)

        total = len(deal_cards_by_bank[deal_bank])
        summary.append(
            {
                "deal_bank_name": deal_bank,
                "requirement_bank_name": req_bank,
                "matched_cards": matched,
                "total_deal_cards": total,
                "coverage_pct": round((matched / total * 100), 1) if total else 0.0,
                "unmatched_deal_cards": unmatched,
            }
        )

    summary.sort(key=lambda item: item["deal_bank_name"])

    with (OUT_DIR / "deal_requirement_card_map.json").open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(mappings, handle, indent=2)
        handle.write("\n")

    with (OUT_DIR / "deal_requirement_coverage_summary.json").open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
