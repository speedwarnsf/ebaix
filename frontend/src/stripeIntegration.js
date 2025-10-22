import { loadStripe } from "@stripe/stripe-js";

const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;
export const stripe = loadStripe(STRIPE_PUBLIC_KEY);

export const CREDIT_BUNDLES = {
  small: {
    name: "10 Listings",
    credits: 10,
    price: 4.0,
    priceInCents: 400,
    stripeProductId: "prod_ebai_10",
  },
  medium: {
    name: "50 Listings",
    credits: 50,
    price: 6.0,
    priceInCents: 600,
    stripeProductId: "prod_ebai_50",
    badge: "BEST VALUE",
  },
  large: {
    name: "100 Listings",
    credits: 100,
    price: 12.0,
    priceInCents: 1200,
    stripeProductId: "prod_ebai_100",
    badge: "MOST POPULAR",
  },
};

export const SUBSCRIPTION = {
  name: "200 Listings/Month",
  credits: 200,
  price: 14.99,
  priceInCents: 1499,
  stripeProductId: "prod_ebai_subscription",
  recurring: true,
};

export async function createCheckoutSession(request) {
  const { bundleType, userId, email } = request;
  const bundle = bundleType === "subscription" ? SUBSCRIPTION : CREDIT_BUNDLES[bundleType];

  const response = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-checkout-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
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
  const { sessionId } = await response.json();
  return sessionId;
}

export async function redirectToCheckout(sessionId) {
  const stripeInstance = await stripe;
  if (!stripeInstance) throw new Error("Stripe failed to load");

  const { error } = await stripeInstance.redirectToCheckout({ sessionId });
  if (error) throw new Error(error.message);
}
