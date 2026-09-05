export enum QueueName {
  Auth = "auth-jobs",
  Listing = "listing-jobs",
  /** CPU-bound media work, kept off the Listing queue. */
  ListingMedia = "listing-media-jobs",
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
  IcalFeedSync = "ical-feed-sync",
  CommissionScheduler = "commission-scheduler",
  GeoVerificationExpirer = "geo-verification-expirer",
  ExchangeRateRefresher = "exchange-rate-refresher",
  ReservationTimerWarning = "reservation-timer-warning",
  DeviceTokenCleanup = "device-token-cleanup",
  DeviceTokenCleanupBatch = "device-token-cleanup-batch",
  NotificationPushBatch = "notification-push-batch",
  PhotoDerivatives = "photo-derivatives",
}

export enum PaymentJob {
  PayoutJob = "payout-job",
  RefundRetryJob = "refund-retry-job",
  StalePaymentCanceller = "stale-payment-canceller",
  EmailRetryJob = "email-retry-job",
  EmailReconciliationJob = "email-reconciliation-job",
}
