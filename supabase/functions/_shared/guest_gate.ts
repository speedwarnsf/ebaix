// Guest gate helper (3 free runs for guests, then 402)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function adminClient() {
  return createClient(
    Deno.env.get('NUDIO_PROJECT_URL')!,
    Deno.env.get('NUDIO_SERVICE_ROLE_KEY')!
  );
}

type GuestGateOutcome =
  | { blocked: true; response: Response; fingerprint?: string; remaining?: number }
  | { blocked: false; fingerprint?: string; remaining?: number };

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function getClientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for') ?? '';
  return xf.split(',')[0].trim() || '0.0.0.0';
}
async function guestFingerprint(req: Request) {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') ?? '';
  const headerId = req.headers.get('x-guest-id')?.trim() ?? '';
  const salt = Deno.env.get('NUDIO_GUEST_SALT') ?? '';
  const base = `${ip}|${ua}`;
  const extra = (!ip || ip === '0.0.0.0') && headerId ? `|${headerId}` : '';
  return await sha256Hex(`${base}${extra}|${salt}`);
}

export async function guestGate(req: Request): Promise<GuestGateOutcome> {
  // If a valid logged-in JWT is present, skip guest logic
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const { data, error } = await adminClient().auth.getUser(m[1]);
    if (!error && data?.user) return { blocked: false };
  }

  // Guest: enforce N free/month (default 3)
  const limit = Number(Deno.env.get('NUDIO_FREE_CREDITS_PER_MONTH') ?? '3');
  const fp = await guestFingerprint(req);
  const { data, error } = await adminClient().rpc('consume_guest_credit', { p_fingerprint: fp, p_limit: limit });
  console.log('guest-gate', { fingerprint: fp, data, error });
  if (error) {
    console.error('guest-quota-check-failed', error);
    return {
      blocked: true,
      response: new Response(JSON.stringify({
        error: 'guest-quota-check-failed',
        details: error.message ?? error.code ?? 'unknown'
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    };
  }
  const row = Array.isArray(data) ? data[0] : (data as any);
  if (!row?.allowed) {
    return {
      blocked: true,
      response: new Response(JSON.stringify({
        error: 'guest-limit-reached',
        remaining: 0,
        message: `You’ve used your ${limit} free nudios for this month. Sign in to continue.`
      }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
      fingerprint: fp,
      remaining: 0,
    };
  }
  return {
    blocked: false,
    fingerprint: fp,
    remaining: typeof row.remaining === 'number' ? row.remaining : Math.max(limit - (row.used ?? 0), 0),
  };
}
