-- CreateTable: auth.loyalty_transactions
CREATE TABLE auth.loyalty_transactions (
  id            VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::text,
  user_id       VARCHAR(255) NOT NULL,
  type          VARCHAR(30)  NOT NULL,
  points        INTEGER      NOT NULL,
  balance_after INTEGER      NOT NULL,
  booking_id    VARCHAR(255),
  description   VARCHAR(255),
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth."User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX loyalty_transactions_user_id_idx    ON auth.loyalty_transactions(user_id);
CREATE INDEX loyalty_transactions_booking_id_idx ON auth.loyalty_transactions(booking_id);
