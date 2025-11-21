import { loadStripe } from "@stripe/stripe-js";

const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

if (!STRIPE_PUBLIC_KEY) {
  console.warn("Stripe checkout disabled: missing REACT_APP_STRIPE_PUBLIC_KEY");
}

export const stripe = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;

export const CREDIT_BUNDLES = {
  small: {
    name: "10 nudios",
    credits: 10,
    price: 4.0,
    priceInCents: 400,
    stripeProductId: "prod_TJuE451l9Mq5Z4",
    badge: "TIGHT BUDGET",
  },
  medium: {
    name: "50 nudios",
    credits: 50,
    price: 6.0,
    priceInCents: 600,
    stripeProductId: "prod_TJuHWWnXFGRqXj",
    badge: "BEST VALUE",
  },
  large: {
    name: "100 nudios",
    credits: 100,
    price: 12.0,
    priceInCents: 1200,
    stripeProductId: "prod_TJuICmscUK8kQo",
    badge: "MOST POPULAR",
  },
};

export const SUBSCRIPTION = {
  name: "200 nudios/month",
  credits: 200,
  price: 14.99,
  priceInCents: 1499,
  stripeProductId: "prod_TJuJBjQB8f4Lxv",
  recurring: true,
};

export async function createCheckoutSession(request) {
  const { bundleType, userId, email, authToken } = request;
  const bundle =
    bundleType === "subscription" ? SUBSCRIPTION : CREDIT_BUNDLES[bundleType];

  // Clean tokens to remove newlines/whitespace that cause header errors
  const rawBearer = authToken ?? process.env.REACT_APP_SUPABASE_ANON_KEY;
  const rawAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const rawUrl = process.env.REACT_APP_SUPABASE_URL;

  const cleanBearer = rawBearer ? rawBearer.replace(/[\r\n\t\s]/g, '') : '';
  const cleanAnonKey = rawAnonKey ? rawAnonKey.replace(/[\r\n\t\s]/g, '') : '';
  const cleanUrl = rawUrl ? rawUrl.replace(/[\r\n\t]/g, '').trim() : '';

  const response = await fetch(
    `${cleanUrl}/functions/v1/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanBearer}`,
        apikey: cleanAnonKey,
      },
      body: JSON.stringify({
        bundleType,
        userId,
        email,
        credits: bundle.credits,
        priceInCents: bundle.priceInCents,
        isRecurring: bundleType === "subscription",
      }),
    }
  );

  if (!response.ok) throw new Error("Failed to create checkout session");
  const { sessionId, url } = await response.json();
  return { sessionId, url };
}

export async function redirectToCheckout(checkoutData) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please add REACT_APP_STRIPE_PUBLIC_KEY.");
  }

  if (checkoutData.url) {
    window.location.href = checkoutData.url;
  } else {
    throw new Error("No checkout URL provided");
  }
}
