export enum QueueName {
  Auth = "auth-jobs",
  Listing = "listing-jobs",
  Payment = "payment-jobs",
}

export enum AuthJob {
  TokenPurger = "token-purger",
  AuditLogPurger = "audit-log-purger",
}

export enum ListingJob {
  PendingPaymentCanceller = "pending-payment-canceller",
  BookingCompletion = "booking-completion",
  VoucherExpiryWarner = "voucher-expiry-warner",
  IcalPoller = "ical-poller",
  CommissionScheduler = "commission-scheduler",
  GeoVerificationExpirer = "geo-verification-expirer",
  ExchangeRateRefresher = "exchange-rate-refresher",
}

export enum PaymentJob {
  PayoutJob = "payout-job",
  RefundRetryJob = "refund-retry-job",
  StalePaymentCanceller = "stale-payment-canceller",
}
