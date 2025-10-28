-- Create credit_transactions table for logging payment transactions
CREATE TABLE credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount integer NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
    bundle_type text,
    stripe_session_id text,
    payment_intent_id text,
    is_subscription boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Add RLS policies
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Only authenticated users can insert transactions (typically via functions)
CREATE POLICY "Authenticated users can insert transactions" ON credit_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_credit_transactions_stripe_session_id ON credit_transactions(stripe_session_id);

-- Add subscription_active and stripe_customer_id columns to profiles if they don't exist
DO $$
BEGIN
    -- Add subscription_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'subscription_active'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_active boolean DEFAULT false;
    END IF;

    -- Add stripe_customer_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
    END IF;
END $$;