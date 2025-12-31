import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ProfileRole = 'free' | 'owner' | 'reseller';

interface UsageProfile {
  id: string;
  email: string;
  role: ProfileRole;
  credits_balance: number;
  free_credits_used: number;
  free_period_start: string | null;
  created_at?: string;
  updated_at?: string;
}

interface UsageSummary {
  role: ProfileRole;
  creditsBalance: number;
  freeCreditsUsed: number;
  freeCreditsLimit: number;
  freeCreditsRemaining: number;
  freePeriodStart: string | null;
  unlimited: boolean;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing for usage tracking');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const OWNER_EMAILS = new Set(
  (Deno.env.get('NUDIO_OWNER_EMAILS') ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const RESELLER_EMAILS = new Set(
  (Deno.env.get('NUDIO_RESELLER_EMAILS') ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const FREE_CREDITS_PER_MONTH = Number(Deno.env.get('NUDIO_FREE_CREDITS_PER_MONTH') ?? '3');
const STARTER_RESELLER_CREDITS = Number(Deno.env.get('NUDIO_RESELLER_STARTER_CREDITS') ?? '50');

export function extractUserEmail(body: Record<string, unknown> | undefined, req: Request): string | null {
  const fromBody = typeof body?.userEmail === 'string' ? body.userEmail : null;
  const fromHeader = req.headers.get('x-user-email');
  const email = (fromBody ?? fromHeader ?? '').trim().toLowerCase();
  return email || null;
}

function monthStartIso(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function determineAutoRole(email: string): ProfileRole | null {
  if (OWNER_EMAILS.has(email)) return 'owner';
  if (RESELLER_EMAILS.has(email)) return 'reseller';
  return null;
}

function usageFromProfile(profile: UsageProfile): UsageSummary {
  const unlimited = profile.role === 'owner';
  const freeRemaining = unlimited
    ? Infinity
    : Math.max(FREE_CREDITS_PER_MONTH - profile.free_credits_used, 0);

  return {
    role: profile.role,
    creditsBalance: profile.credits_balance,
    freeCreditsUsed: profile.free_credits_used,
    freeCreditsLimit: FREE_CREDITS_PER_MONTH,
    freeCreditsRemaining: unlimited ? Infinity : freeRemaining,
    freePeriodStart: profile.free_period_start,
    unlimited,
  };
}

export async function ensureProfile(email: string): Promise<UsageProfile> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error('User email required for usage tracking');
  }

  const targetRole = determineAutoRole(normalized);
  const monthStart = monthStartIso();

  const { data, error } = await supabaseAdmin
    .from<UsageProfile>('profiles')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    const insertPayload: Partial<UsageProfile> = {
      email: normalized,
      role: targetRole ?? 'free',
      credits_balance: targetRole === 'reseller' ? STARTER_RESELLER_CREDITS : 0,
      free_credits_used: 0,
      free_period_start: monthStart,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from<UsageProfile>('profiles')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertError || !inserted) {
      throw insertError ?? new Error('Failed to create usage profile');
    }

    return inserted;
  }

  const updates: Partial<UsageProfile> = {};
  let needsUpdate = false;

  if (!data.free_period_start || data.free_period_start !== monthStart) {
    updates.free_period_start = monthStart;
    updates.free_credits_used = 0;
    needsUpdate = true;
  }

  if (targetRole === 'owner' && data.role !== 'owner') {
    updates.role = 'owner';
    needsUpdate = true;
  } else if (targetRole === 'reseller' && data.role !== 'reseller') {
    updates.role = 'reseller';
    if (data.credits_balance < STARTER_RESELLER_CREDITS) {
      updates.credits_balance = STARTER_RESELLER_CREDITS;
    }
    needsUpdate = true;
  } else if (!targetRole && (data.role === 'owner' || data.role === 'reseller')) {
    // keep existing elevated roles even if env changes
  }

  if (needsUpdate) {
    updates.updated_at = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from<UsageProfile>('profiles')
      .update(updates)
      .eq('email', normalized)
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      throw updateError ?? new Error('Failed to update usage profile');
    }
    return updated;
  }

  return data;
}

interface CreditOptions {
  creditCost?: number;
  requirePaidCredits?: boolean;
}

function normalizeCost(options?: CreditOptions) {
  const requested = options?.creditCost ?? 1;
  if (!Number.isFinite(requested)) return 1;
  return Math.max(1, Math.floor(requested));
}

export function canConsumeCredit(
  profile: UsageProfile,
  options?: CreditOptions,
): { allowed: boolean; message?: string } {
  const creditCost = normalizeCost(options);
  const requirePaid = options?.requirePaidCredits === true;
  if (profile.role === 'owner') {
    return { allowed: true };
  }

  const paidBalance = profile.credits_balance;
  const freeRemaining = Math.max(FREE_CREDITS_PER_MONTH - profile.free_credits_used, 0);

  if (requirePaid) {
    if (paidBalance >= creditCost) {
      return { allowed: true };
    }
    return {
      allowed: false,
      message: `Labs requires ${creditCost} paid nudios.`,
    };
  }

  if (paidBalance >= creditCost) {
    return { allowed: true };
  }

  if (freeRemaining >= creditCost) {
    return { allowed: true };
  }

  if (freeRemaining <= 0) {
    return {
      allowed: false,
      message: `Free tier limit reached (${FREE_CREDITS_PER_MONTH} nudio shoots this month).`,
    };
  }

  const totalAvailable = paidBalance + freeRemaining;
  if (totalAvailable < creditCost) {
    return {
      allowed: false,
      message: 'Not enough credits remaining for this request.',
    };
  }

  return { allowed: true };
}

export async function consumeCredit(
  profile: UsageProfile,
  options?: CreditOptions,
): Promise<{ profile: UsageProfile; usage: UsageSummary }> {
  if (profile.role === 'owner') {
    return { profile, usage: usageFromProfile(profile) };
  }

  const creditCost = normalizeCost(options);
  const requirePaid = options?.requirePaidCredits === true;
  const updates: Partial<UsageProfile> = { updated_at: new Date().toISOString() };

  let paidToUse = 0;
  let freeToUse = 0;

  if (requirePaid) {
    paidToUse = creditCost;
  } else {
    paidToUse = Math.min(profile.credits_balance, creditCost);
    freeToUse = creditCost - paidToUse;
  }

  const remainingFreeCapacity = Math.max(FREE_CREDITS_PER_MONTH - profile.free_credits_used, 0);
  if (freeToUse > remainingFreeCapacity) {
    freeToUse = remainingFreeCapacity;
  }

  if (paidToUse > 0) {
    updates.credits_balance = profile.credits_balance - paidToUse;
  }

  if (freeToUse > 0) {
    updates.free_credits_used = profile.free_credits_used + freeToUse;
  }

  const { data: updated, error } = await supabaseAdmin
    .from<UsageProfile>('profiles')
    .update(updates)
    .eq('email', profile.email)
    .select()
    .maybeSingle();

  if (error || !updated) {
    throw error ?? new Error('Failed to consume credit');
  }

  return { profile: updated, usage: usageFromProfile(updated) };
}

export async function getUsageSummary(email: string): Promise<{ profile: UsageProfile; usage: UsageSummary }> {
  const profile = await ensureProfile(email);
  return { profile, usage: usageFromProfile(profile) };
}
