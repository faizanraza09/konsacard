# Requirement Evidence Audit

Audit date: 2026-04-26

This report classifies filled requirement fields into direct evidence versus inferred/account-relationship fills.

## Basis Summary

### minimum_monthly_salary_pkr
- explicit_apply_flow: 1
- explicit_card_page: 75
- inferred_account_relationship: 46
- missing: 10
- other_explicit_source: 3

### minimum_account_balance_pkr
- explicit_card_page: 32
- explicit_soc_or_summary_pdf: 18
- inferred_account_relationship: 20
- missing: 36
- normalized_from_alt_balance_key: 26
- other_explicit_source: 3

### annual_fee_pkr
- explicit_card_page: 55
- explicit_soc_or_summary_pdf: 49
- inferred_account_relationship: 21
- missing: 6
- other_explicit_source: 4

## Manual Review Buckets

### salary
- flagged rows: 58
- Al Baraka Bank | Mastercard Platinum Debit Card | 0 | inferred_account_relationship | medium
- Al Baraka Bank | PayPak Standard Debit Card | 0 | inferred_account_relationship | medium
- Al Baraka Bank | UnionPay Gold Debit Card | 0 | inferred_account_relationship | medium
- Allied Bank | Allied Visa Premium Debit Card | 416667 | explicit_card_page | low
- Allied Bank | Allied Youth Visa Debit Card | 0 | other_explicit_source | low
- Askari Bank Limited | Askari PayPak Debit Card Gold | 0 | inferred_account_relationship | medium
- Askari Bank Limited | Askari Visa Signature Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | AL Habib Gold Credit Card | 20000 | explicit_card_page | low
- Bank AL Habib | AL Habib Green Credit Card | 20000 | explicit_card_page | low
- Bank AL Habib | AL Habib Remit Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | AL Habib Woman Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | BAHL UnionPay Apna Debit Card | 0 | inferred_account_relationship | low
- Bank AL Habib | BAHL UnionPay Debit Card | 0 | inferred_account_relationship | low
- Bank AL Habib | PayPak Debit Card | 0 | inferred_account_relationship | low
- Bank AL Habib | Visa Gold Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | Visa Silver Debit Card | 0 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Islamic Gold Women Debit Card | 0 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Pehchaan Debit Card | 0 | inferred_account_relationship | high
- Bank Alfalah | Bank Alfalah Premier Visa Platinum Credit Card | 50000 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Premier Visa Signature Debit Card | 0 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Visa Islamic Gold Debit Card | 0 | explicit_card_page | low
- Bank Alfalah | Bank Alfalah Visa Ultra Cashback Card | 50000 | explicit_card_page | low
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 500000 | inferred_account_relationship | medium
- Bank of Punjab | BOP Lahore Qalandars Debit Card | 0 | other_explicit_source | medium
- Bank of Punjab | BOP Mastercard Classic Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Gold Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Platinum Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Naaz Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | 300000 | inferred_account_relationship | low
- Bank of Punjab | BOP Taqwa Platinum Islamic Debit Card | 300000 | inferred_account_relationship | low
- Bank of Punjab | BOP Taqwa World Islamic Debit Card | 0 | inferred_account_relationship | low
- Bank of Punjab | BOP World Debit Card | 0 | inferred_account_relationship | low
- BankIslami | Classic Debit Mastercard | 0 | inferred_account_relationship | medium
- BankIslami | Titanium Debit Mastercard | 0 | inferred_account_relationship | medium
- HBL | HBL Platinum CreditCard | 400000 | inferred_account_relationship | medium
- HBL Islamic Bank Limited | HBL Islamic Prestige World Elite DebitCard | 0 | inferred_account_relationship | high
- Habib Metro Bank | Visa Classic Debit Card | 0 | inferred_account_relationship | high
- Habib Metro Bank | Visa Gold Debit Card | 0 | inferred_account_relationship | high
- Habib Metro Bank | Visa Platinum Debit Card | 0 | inferred_account_relationship | high
- JS Bank | Mastercard Gold Debit Card | 0 | inferred_account_relationship | medium
- ... 18 more rows omitted from markdown; see JSON.

### balance
- flagged rows: 60
- Allied Bank | Allied Visa Premium Debit Card | 2000000 | normalized_from_alt_balance_key | low
- Allied Bank | Allied Youth Visa Debit Card | 10000 | explicit_soc_or_summary_pdf | low
- Askari Bank Limited | Askari Mastercard Classic Credit Card | 150000 | normalized_from_alt_balance_key | medium
- Askari Bank Limited | Askari Mastercard Gold Credit Card | 150000 | normalized_from_alt_balance_key | medium
- Askari Bank Limited | Askari Mastercard Platinum Credit Card | 150000 | normalized_from_alt_balance_key | medium
- Askari Bank Limited | Askari Visa Signature Debit Card | 5000000 | normalized_from_alt_balance_key | medium
- Askari Bank Limited | Askari World Mastercard Credit Card | 2000000 | normalized_from_alt_balance_key | high
- Bank AL Habib | AL Habib Gold Credit Card | 25000 | normalized_from_alt_balance_key | low
- Bank AL Habib | AL Habib Green Credit Card | 25000 | normalized_from_alt_balance_key | low
- Bank AL Habib | AL Habib Remit Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | AL Habib Woman Debit Card | 0 | inferred_account_relationship | medium
- Bank AL Habib | BAHL UnionPay Apna Debit Card | 25000 | inferred_account_relationship | low
- Bank AL Habib | BAHL UnionPay Debit Card | 0 | inferred_account_relationship | low
- Bank AL Habib | PayPak Debit Card | 25000 | inferred_account_relationship | low
- Bank AL Habib | Signature Debit Card | 2000000 | normalized_from_alt_balance_key | high
- Bank AL Habib | Visa Platinum Debit Card | 200000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Islamic Power Pack Signature Debit Card | 250000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Islamic Power Pack Women Debit Card | 250000 | normalized_from_alt_balance_key | high
- Bank Alfalah | Bank Alfalah Islamic Premier Visa Signature Debit Card | 3000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Premier Visa Platinum Credit Card | 3000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Premier Visa Signature Debit Card | 3000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Visa Islamic Gold Debit Card | None | missing | low
- Bank Alfalah | Bank Alfalah Visa Islamic Signature Debit Card | 1000000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Bank Alfalah Visa Ultra Cashback Card | 0 | explicit_card_page | low
- Bank Alfalah | Visa Classic Credit Card | 75000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Visa Gold Credit Card | 75000 | normalized_from_alt_balance_key | medium
- Bank Alfalah | Visa Signature Debit Card | 1000000 | normalized_from_alt_balance_key | medium
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 2000000 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Gold Credit Card | 0 | other_explicit_source | medium
- Bank of Punjab | BOP Mastercard Platinum Credit Card | 0 | other_explicit_source | medium
- Bank of Punjab | BOP Naaz Debit Card | 1000 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | None | missing | low
- Bank of Punjab | BOP Taqwa Platinum Islamic Debit Card | None | missing | low
- Bank of Punjab | BOP Taqwa World Islamic Debit Card | None | missing | low
- Bank of Punjab | BOP World Credit Card | 0 | other_explicit_source | medium
- Bank of Punjab | BOP World Debit Card | None | missing | low
- Faysal Bank Limited | Faysal Islami Noor World Card | 0 | inferred_account_relationship | high
- Faysal Bank Limited | Priority Platinum Debit Card | 3000000 | inferred_account_relationship | medium
- Faysal Bank Limited | Priority World Debit Card | 3000000 | inferred_account_relationship | medium
- HBL | HBL Gold CreditCard | 300000 | normalized_from_alt_balance_key | medium
- ... 20 more rows omitted from markdown; see JSON.

### annual_fee
- flagged rows: 38
- Allied Bank | Allied Visa Premium Debit Card | 19500 | explicit_soc_or_summary_pdf | low
- Allied Bank | Allied Youth Visa Debit Card | None | missing | low
- Bank AL Habib | AL Habib Gold Credit Card | 6000 | explicit_soc_or_summary_pdf | low
- Bank AL Habib | AL Habib Green Credit Card | 4000 | explicit_soc_or_summary_pdf | low
- Bank AL Habib | BAHL UnionPay Apna Debit Card | 3000 | inferred_account_relationship | low
- Bank AL Habib | BAHL UnionPay Debit Card | 1250 | inferred_account_relationship | low
- Bank AL Habib | PayPak Debit Card | 0 | inferred_account_relationship | low
- Bank AL Habib | Visa Gold Debit Card | 4500 | inferred_account_relationship | medium
- Bank AL Habib | Visa Silver Debit Card | 3700 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Premier Visa Platinum Credit Card | 0 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Premier Visa Signature Debit Card | 0 | inferred_account_relationship | medium
- Bank Alfalah | Bank Alfalah Visa Islamic Gold Debit Card | 3800 | explicit_card_page | low
- Bank Alfalah | Bank Alfalah Visa Ultra Cashback Card | 9000 | explicit_soc_or_summary_pdf | low
- Bank of Punjab | BOP KHAAS Platinum Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Classic Debit Card | 2600 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Gold Credit Card | 6250 | other_explicit_source | medium
- Bank of Punjab | BOP Mastercard Gold Debit Card | 3300 | inferred_account_relationship | medium
- Bank of Punjab | BOP Mastercard Platinum Credit Card | 12500 | other_explicit_source | medium
- Bank of Punjab | BOP Mastercard Platinum Debit Card | 5500 | inferred_account_relationship | medium
- Bank of Punjab | BOP Naaz Debit Card | 0 | inferred_account_relationship | medium
- Bank of Punjab | BOP Taqwa KHAAS Platinum Islamic Debit Card | 0 | inferred_account_relationship | low
- Bank of Punjab | BOP Taqwa Platinum Islamic Debit Card | 5500 | inferred_account_relationship | low
- Bank of Punjab | BOP Taqwa World Islamic Debit Card | 15000 | inferred_account_relationship | low
- Bank of Punjab | BOP World Credit Card | 25000 | other_explicit_source | medium
- Bank of Punjab | BOP World Debit Card | 15000 | explicit_soc_or_summary_pdf | low
- HBL | HBL Platinum CreditCard | 22000 | inferred_account_relationship | medium
- Habib Metro Bank | Visa Classic Debit Card | 3300 | inferred_account_relationship | high
- Habib Metro Bank | Visa Gold Debit Card | 4400 | inferred_account_relationship | high
- Habib Metro Bank | Visa Platinum Debit Card | 7500 | inferred_account_relationship | high
- MCB Bank Limited | MCB Visa Platinum Debit Card | None | missing | low
- MCB Bank Limited | PayPak Debit Card | 0 | other_explicit_source | low
- Meezan Bank | Meezan PayPak Debit Card | 2500 | explicit_soc_or_summary_pdf | low
- Meezan Bank | Meezan Visa Infinite Debit Card | 42500 | explicit_soc_or_summary_pdf | low
- Meezan Bank | Meezan World Debit Card | 27500 | explicit_soc_or_summary_pdf | low
- United Bank Limited (UBL) | UBL Credit Card Classic | 6000 | explicit_soc_or_summary_pdf | low
- United Bank Limited (UBL) | UBL Credit Card Gold | 12000 | explicit_soc_or_summary_pdf | low
- United Bank Limited (UBL) | UBL Mastercard Signature Debit Card | 0 | inferred_account_relationship | medium
- United Bank Limited (UBL) | UBL UnionPay International Debit Card | 2300 | inferred_account_relationship | high

