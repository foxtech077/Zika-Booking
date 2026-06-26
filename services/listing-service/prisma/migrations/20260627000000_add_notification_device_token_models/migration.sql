-- Ensures Notification and DeviceToken exist in the auth schema.
-- Safe to run even if Notification was already created by the auth-service.

CREATE TABLE IF NOT EXISTS auth."Notification" (
    "id"        TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "type"      VARCHAR(50)   NOT NULL,
    "title"     VARCHAR(100)  NOT NULL,
    "body"      TEXT          NOT NULL,
    "isRead"    BOOLEAN       NOT NULL DEFAULT false,
    "data"      JSONB                  DEFAULT '{}',
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON auth."Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx"  ON auth."Notification"("isRead");

CREATE TABLE IF NOT EXISTS auth."DeviceToken" (
    "id"        TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "token"     VARCHAR(500)  NOT NULL,
    "platform"  VARCHAR(10)   NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_userId_token_key" ON auth."DeviceToken"("userId", "token");
CREATE INDEX         IF NOT EXISTS "DeviceToken_userId_idx"       ON auth."DeviceToken"("userId");
