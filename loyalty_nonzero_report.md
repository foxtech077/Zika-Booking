
## Scenario 1 – Confirmed Booking (USD conversion + loyalty)
[User Before] loyaltyPoints=0 tier=bronze
| Field | Value |
|---|---|
| Booking ID | 361885cf-dc9d-4c42-9647-d0af27555520 |
| Status | confirmed |
| Original Currency | INR |
| Original Amount | 5500 |
| Converted USD | 58.2285 |
| Base Points (floor) | 58 |
| User Tier | bronze |
| Tier Multiplier | 1 |
| Expected Earned Points | 58 |
| Actual booking.earnedPoints | 58 |
| User loyaltyPoints Before | 0 |
| User loyaltyPoints After | 58 |
| Balance Delta | 58 |
| **PASS?** | ✅ PASS |

## Scenario 2 – Cancelled Booking (no loyalty points)
| Field | Value |
|---|---|
| Booking ID | 809b773c-2891-48a4-81a8-ba6d6fd94426 |
| Status | pending_payment |
| booking.earnedPoints | 0 |
| User loyaltyPoints Before Cancel | 58 |
| User loyaltyPoints After Cancel | 58 |
| Balance Delta | 0 |
| **PASS?** | ✅ PASS |

## Summary
| Scenario | Result |
|---|---|
| Confirmed Booking – loyalty points calculated correctly | ✅ PASS |
| Cancelled Booking – no loyalty points awarded | ✅ PASS |
| USD Conversion working | ✅ YES |

**Overall: ✅ ALL PASS**