import {
  extractUserEmail,
  getUsageSummary,
} from '../_shared/usage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-guest-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> | undefined;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }

    const email = extractUserEmail(body, req);
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'User email required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    const { usage } = await getUsageSummary(email);

    return new Response(
      JSON.stringify({ usage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Usage summary error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Failed to load usage summary' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
