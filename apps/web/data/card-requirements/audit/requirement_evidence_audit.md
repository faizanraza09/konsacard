# Requirement Evidence Audit

Audit date: 2026-05-25

This report classifies filled requirement fields into direct evidence versus inferred/account-relationship fills.

## Basis Summary

### minimum_monthly_salary_pkr
- explicit_apply_flow: 2
- explicit_card_page: 24
- inferred_account_relationship: 25
- missing: 116
- other_explicit_source: 1

### minimum_account_balance_pkr
- explicit_card_page: 2
- explicit_soc_or_summary_pdf: 29
- inferred_account_relationship: 10
- missing: 78
- normalized_from_alt_balance_key: 49

### annual_fee_pkr
- explicit_card_page: 15
- explicit_soc_or_summary_pdf: 117
- inferred_account_relationship: 28
- missing: 3
- other_explicit_source: 5

## Manual Review Buckets

### salary
- flagged rows: 30
- Allied Bank | Allied Basic Debit Card | 0 | inferred_account_relationship | high
- Allied Bank | Allied UnionPay & PayPak Gold Debit Card | 41667 | inferred_account_relationship | high
- Allied Bank | Allied UnionPay PayPak Classic Debit Card | 0 | inferred_account_relationship | high
- Allied Bank | Allied Visa Classic Debit Card | 0 | inferred_account_relationship | high
- Allied Bank | Allied Youth Visa Debit Card | 0 | other_explicit_source | medium
- Allied Bank | Cash+Shop Sapphire Visa Debit Card | 0 | explicit_card_page | low
- Allied Bank | Islamic Banking VISA DebitCard | 0 | explicit_card_page | low
- Askari Bank Limited | Askari World Mastercard Credit Card | 1000000 | inferred_account_relationship | high
- Bank AL Habib | Signature Debit Card | 750000 | inferred_account_relationship | high
- Bank AL Habib | Visa Platinum Debit Card | 150000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah American Express Gold Credit Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Mastercard Optimus Credit Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Pehchaan Debit Card | 0 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Visa Corporate Credit Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Visa Platinum Credit Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Visa Ultra Cashback Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Visa Classic Credit Card | 50000 | inferred_account_relationship | high
- Bank Alfalah | Visa Gold Credit Card | 50000 | inferred_account_relationship | high
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 500000 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | 500000 | inferred_account_relationship | medium
- Faysal Bank Limited | Faysal Islami Noor Gold Card | 30000 | inferred_account_relationship | high
- Faysal Bank Limited | Faysal Islami Noor Titanium Card | 50000 | inferred_account_relationship | high
- Faysal Bank Limited | Faysal Islami Noor Velocity Card | 30000 | inferred_account_relationship | high
- Faysal Bank Limited | Faysal Islami Priority World Debit Card | 500000 | inferred_account_relationship | high
- HBL | HBL Platinum CreditCard | 400000 | inferred_account_relationship | high
- HBL Islamic Bank Limited | HBL Islamic Titanium DebitCard | None | missing | low
- JS Bank | JS Credit Card Classic | 70000 | inferred_account_relationship | high
- JS Bank | JS Credit Card Platinum | 70000 | inferred_account_relationship | high
- JS Bank | Visa Gold Credit Card | 70000 | inferred_account_relationship | high
- Meezan Bank | Meezan PayPak Debit Card | None | missing | low

### balance
- flagged rows: 62
- Al Baraka Bank | Mastercard Gold Debit Card | 100000 | normalized_from_alt_balance_key | high
- Al Baraka Bank | UnionPay Gold Debit Card | 100000 | normalized_from_alt_balance_key | high
- Allied Bank | Allied Visa Premium Debit Card | 2000000 | normalized_from_alt_balance_key | medium
- Allied Bank | Cash+Shop Sapphire Visa Debit Card | 1000 | explicit_soc_or_summary_pdf | low
- Allied Bank | Islamic Banking VISA DebitCard | 1000 | explicit_soc_or_summary_pdf | low
- Askari Bank Limited | Askari Mastercard Classic Credit Card | 150000 | normalized_from_alt_balance_key | high
- Askari Bank Limited | Askari Mastercard Gold Credit Card | 150000 | normalized_from_alt_balance_key | high
- Askari Bank Limited | Askari Mastercard Platinum Credit Card | 150000 | normalized_from_alt_balance_key | high
- Askari Bank Limited | Askari Visa Signature Debit Card | 5000000 | normalized_from_alt_balance_key | high
- Bank AL Habib | AL Habib Digital Account Classic Debit Card | 0 | normalized_from_alt_balance_key | high
- Bank AL Habib | AL Habib Digital Account Gold Debit Card | 0 | normalized_from_alt_balance_key | high
- Bank AL Habib | AL Habib Remit Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | AL Habib Woman Debit Card | 0 | normalized_from_alt_balance_key | medium
- Bank AL Habib | BAHL UnionPay Apna Debit Card | 25000 | normalized_from_alt_balance_key | high
- Bank AL Habib | PayPak Debit Card | 25000 | normalized_from_alt_balance_key | high
- Bank AL Habib | Signature Debit Card | 2000000 | normalized_from_alt_balance_key | high
- Bank AL Habib | Visa Platinum Debit Card | 200000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Islamic Power Pack Signature Debit Card | 250000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Islamic Power Pack Women Debit Card | 250000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Islamic Premier Visa Signature Debit Card | 3000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Premier Visa Platinum Credit Card | 3000000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Premier Visa Signature Credit Card | 25000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Premier Visa Signature Debit Card | 3000000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Visa Infinite Debit Card | 150000000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Visa Infinite Islamic Debit Card | 150000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Visa Islamic Signature Debit Card | 1000000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Visa Signature Debit Card | 1000000 | normalized_from_alt_balance_key | high
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 2000000 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | 2000000 | inferred_account_relationship | medium
- Faysal Bank Limited | Faysal Islami Priority Platinum Debit Card | 3000000 | inferred_account_relationship | high
- Faysal Bank Limited | Faysal Islami Priority World Debit Card | 5000000 | inferred_account_relationship | high
- HBL | HBL Business DebitCard | 40000 | normalized_from_alt_balance_key | high
- HBL | HBL Classic DebitCard | 40000 | normalized_from_alt_balance_key | medium
- HBL | HBL Gold CreditCard | 300000 | normalized_from_alt_balance_key | high
- HBL | HBL Gold DebitCard | 40000 | normalized_from_alt_balance_key | medium
- HBL | HBL Green CreditCard | 105000 | normalized_from_alt_balance_key | high
- HBL | HBL Platinum CreditCard | 1000000 | normalized_from_alt_balance_key | high
- HBL | HBL Prestige World Elite DebitCard | 5000000 | normalized_from_alt_balance_key | high
- HBL | HBL Titanium DebitCard | 40000 | normalized_from_alt_balance_key | medium
- HBL | HBL World DebitCard | 2000000 | normalized_from_alt_balance_key | medium
- ... 22 more rows omitted from markdown; see JSON.

### annual_fee
- flagged rows: 36
- Allied Bank | Cash+Shop Sapphire Visa Debit Card | 3000 | explicit_soc_or_summary_pdf | low
- Allied Bank | Islamic Banking VISA DebitCard | 2900 | explicit_soc_or_summary_pdf | low
- Bank Alfalah | Bank Alfalah American Express Gold Credit Card | 13000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Mastercard Optimus Credit Card | 16000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Visa Corporate Credit Card | 6000 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Visa Platinum Credit Card | 23000 | inferred_account_relationship | high
- Bank Alfalah | Visa Gold Credit Card | 13000 | inferred_account_relationship | high
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Lahore Qalandars Debit Card | 3000 | inferred_account_relationship | high
- Bank of Punjab | BOP Mastercard Classic Debit Card | 2800 | inferred_account_relationship | high
- Bank of Punjab | BOP Mastercard Gold Credit Card | 6250 | other_explicit_source | high
- Bank of Punjab | BOP Mastercard Gold Debit Card | 3600 | inferred_account_relationship | high
- Bank of Punjab | BOP Mastercard Lahore Qalandar Business Credit Card | 5000 | other_explicit_source | high
- Bank of Punjab | BOP Mastercard Platinum Credit Card | 12500 | other_explicit_source | high
- Bank of Punjab | BOP Mastercard Platinum Debit Card | 6000 | inferred_account_relationship | high
- Bank of Punjab | BOP Mastercard World Credit Card | 25000 | other_explicit_source | high
- Bank of Punjab | BOP Naaz Debit Card | 2400 | inferred_account_relationship | high
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa Platinum Islamic Debit Card | 6000 | inferred_account_relationship | high
- Bank of Punjab | BOP Taqwa World Islamic Debit Card | 18000 | inferred_account_relationship | high
- Bank of Punjab | BOP World Debit Card | 18000 | inferred_account_relationship | high
- HBL | HBL Nisa DebitCard | 3000 | inferred_account_relationship | medium
- HBL | HBL Platinum CreditCard | 22000 | inferred_account_relationship | high
- HBL | HBL World DebitCard | 20000 | inferred_account_relationship | medium
- HBL Islamic Bank Limited | HBL Islamic Mastercard Standard Debit Card | 3000 | inferred_account_relationship | medium
- HBL Islamic Bank Limited | HBL Islamic Prestige World Elite DebitCard | 0 | inferred_account_relationship | high
- HBL Islamic Bank Limited | HBL Islamic Titanium DebitCard | 3000 | other_explicit_source | low
- MCB Bank Limited | MCB Visa Platinum Debit Card | 14000 | inferred_account_relationship | high
- MCB Bank Limited | Nayab Visa Debit Card | 4000 | inferred_account_relationship | high
- MCB Bank Limited | Visa Fun Club Debit Card | 1000 | inferred_account_relationship | high
- MCB Islamic Bank Ltd | MCB Islamic PayPak Classic Debit Card | 2750 | inferred_account_relationship | high
- MCB Islamic Bank Ltd | MCB Islamic Platinum Debit Card | 9600 | inferred_account_relationship | high
- MCB Islamic Bank Ltd | MCB Islamic Qadar Classic Debit Card | 3250 | inferred_account_relationship | high
- MCB Islamic Bank Ltd | MCB Islamic Qadar Gold Debit Card | 4000 | inferred_account_relationship | high
- MCB Islamic Bank Ltd | MCB Islamic Visa Classic Debit Card | 3400 | inferred_account_relationship | high
- Meezan Bank | Meezan PayPak Debit Card | 2500 | explicit_soc_or_summary_pdf | low

