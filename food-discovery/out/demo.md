# Food-Discovery — ranking + synthesis demo

Deterministic scorer: `0.3·quality + 0.45·dishMatch + 0.25·savings` (proximity omitted — no user location in demo).

## "best biryani in Karachi"

**Answer:** Based on the rankings, I highly recommend trying the Biryani Scene in Karachi - it has a perfect score of 7 out of 7 reviews and an impressive 4.9-star rating on Google! Reviewers rave about its delicious biryani, so you won't want to miss this top pick. To make your visit even more convenient, you can pay with your card at the Biryani Scene using their payment options.

| # | branch | score | dish | evidence | google | card offer |
|--|--|--|--|--|--|--|
| 1 | Biryani Scene | Karachi best Biryani | 0.714 | 1 | branch(n=7) | 4.9★/20 | — |
| 2 | The White Biryani | 0.696 | 1 | branch+brand_prior(n=3) | 4.1★/1416 | — |
| 3 | ALLAH WALA BIRYANI Tariq Road Branch | 0.615 | 0.833 | branch+brand_prior(n=3) | 4★/1594 | — |
| 4 | Ghazi Biryani & Pakwan Centre | 0.252 | 0 | branch+brand_prior(n=1) | 4.2★/700 | — |
| 5 | Ghousia Biryani | 0.246 | 0 | branch+brand_prior(n=2) | 4.1★/729 | — |

## "best karahi in Karachi"

**Answer:** If you're looking for the best karahi in Karachi, I highly recommend Tayyabi'z Restaurant! With a perfect score of 4.1/5 on Google and over 2036 reviews, it's clear that this restaurant serves up delicious and authentic karahi dishes. Unfortunately, they don't offer card payments, so be prepared to pay cash or bring your own!

| # | branch | score | dish | evidence | google | card offer |
|--|--|--|--|--|--|--|
| 1 | Tayyabi'z Restaurant۔ طیبیز ریسٹورنٹ | 0.696 | 1 | branch+brand_prior(n=1) | 4.1★/2036 | — |
| 2 | Bombay Koyla Karhai | 0.258 | 0 | branch+brand_prior(n=1) | 4.3★/3039 | — |
| 3 | Chaska Koyla Karahi چسکا کوئلہ کڑاھی | 0.247 | 0 | branch+brand_prior(n=1) | 4.1★/169 | — |

## "best nihari in Lahore"

**Answer:** If you're looking for the best nihari in Lahore, I highly recommend Muhammadi Nahari House (Lahore) with a perfect score of 1 from multiple sources and an impressive 4.7-star rating on Google! Reviewers rave about this iconic spot, making it a must-visit for any food enthusiast. Unfortunately, they don't accept card payments, so be prepared to pay cash.

| # | branch | score | dish | evidence | google | card offer |
|--|--|--|--|--|--|--|
| 1 | Muhammadi Nahari House | 0.731 | 1 | brand_prior(n=0) | 4.7★/1301 | — |
| 2 | Muhammadi Nehari House - Fazaia | 0.731 | 1 | branch+brand_prior(n=2) | 4.7★/1319 | — |
| 3 | Muhammadi Nahari House | 0.722 | 1 | branch+brand_prior(n=1) | 4.6★/262 | — |
| 4 | Muhammadi Nahari House | 0.696 | 1 | brand_prior(n=0) | 4.1★/1984 | — |
| 5 | Muhammadi Nehari House Bahria Town | 0.633 | 0.833 | branch+brand_prior(n=3) | 4.3★/1306 | — |

## "best bbq in Lahore"

**Answer:** If you're looking for the best BBQ in Lahore, I highly recommend Courtyard Grill! With a score of 0.9 out of 5, it's clear that this place is a fan favorite, with an impressive 4.5-star rating on Google and 50% discounts available with the Bank Alfalah Islamic Premier Visa Infinite Debit Card. Try it out and enjoy your delicious BBQ!

| # | branch | score | dish | evidence | google | card offer |
|--|--|--|--|--|--|--|
| 1 | Courtyard Grill | 0.924 | 0.9 | branch(n=5) | 4.5★/760 | 50% Bank Alfalah [brand] |
| 2 | Butt Karahi and BBQ | 0.275 | 0 | branch+brand_prior(n=1) | 4.7★/182 | — |

## "best restaurant in Islamabad"

**Answer:** Based on the rankings, I highly recommend Coco Cafe in Islamabad, with a perfect score of 4.3/78 on Google and an overall rating of 0.6. This popular spot offers a great dining experience, backed by numerous positive reviews. To make your meal even more affordable, use your Meezan Bank Mastercard World Debit Card to enjoy a 20% discount!

| # | branch | score | dish | evidence | google | card offer |
|--|--|--|--|--|--|--|
| 1 | Coco Cafe | 0.692 | 0.6 | - | 4.3★/78 | 20% Meezan Bank [brand] |
| 2 | The Hot Spot | 0.611 | 0.6 | - | 4.3★/2716 | 10% National Bank of Pakistan [brand] |
| 3 | Tree House Cafe | 0.55 | 0.6 | - | 4.7★/637 | — |
| 4 | Cavo Rooftop | 0.544 | 0.6 | - | 4.8★/78 | — |
| 5 | MOJO's Lounge | 0.531 | 0.6 | - | 4.4★/143 | — |

