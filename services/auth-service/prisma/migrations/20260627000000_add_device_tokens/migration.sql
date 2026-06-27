-- CreateTable: DeviceToken
-- Notification table already exists; this migration only adds DeviceToken.

CREATE TABLE auth."DeviceToken" (
    "id"        TEXT          NOT NULL,
    "userId"    TEXT          NOT NULL,
    "token"     VARCHAR(500)  NOT NULL,
    "platform"  VARCHAR(10)   NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_userId_token_key" ON auth."DeviceToken"("userId", "token");
CREATE INDEX "DeviceToken_userId_idx" ON auth."DeviceToken"("userId");

-- AddForeignKey
ALTER TABLE auth."DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES auth."User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
