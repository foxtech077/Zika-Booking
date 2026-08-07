# Changelog

All notable changes to Kainook are documented here.

## [1.0.0] - 2026-08-07

First feature release of the rebranded Kainook worldwide booking platform.

### Added

- Guest and provider registration with email verification, OAuth, password recovery, and admin 2FA.
- Hotel, apartment, and car listing creation with category-specific validation and hotel accreditation workflows.
- Worldwide listing search, geocoding, map-based discovery, favourites, recently viewed listings, and multi-currency pricing.
- Five-minute reservation locks with one renewal, server-synchronised timers, bounded payment grace handling, and stale-payment cleanup.
- Stripe and Tara payment rails with webhooks, refunds, payouts, confirmation emails, PDF vouchers, and QR booking documents.
- Hotels, apartments, and car rentals with booking references in the `KAIN-XXXXXX-CC` format.
- Voucher wallets, activity promotions, loyalty tiers, AfriPoints, reviews, provider replies, and listing moderation.
- Two-way iCal channel manager integration with polling, UID deduplication, retry backoff, and external availability blocks.
- Provider dashboards for bookings, earnings, availability, calendars, channels, reviews, payments, and messaging.
- Admin dashboard with hotel accreditation, moderation, vouchers, promotions, reports, finance, commissions, messaging, and audit views.
- Android, iOS, and web application foundations with push notifications, payment methods, deep links, and provider workflows.

### Security

- DB-backed admin session introspection with revocation and inactivity enforcement.
- Typed admin permissions and country-scoped authorization for payment, refund, payout, and merchant APIs.
- Immutable audit logging for sensitive administrative financial actions.
- Automatic refunds when captured payments cannot produce a confirmed booking.
- Server-side payment idempotency and provider webhook processing safeguards.

### Operations

- Background workers for payment cleanup, payouts, booking completion, iCal polling, exchange rates, voucher warnings, commission scheduling, and notifications.
- PostgreSQL, Redis, object storage, CDN, email, push notification, maps, payment, and FX integrations wired for deployment.
- Docker and CI/CD deployment configuration for the platform services and applications.

### Branding

- Product identity rebranded from ZikaBooking to Kainook across the platform and booking references.
