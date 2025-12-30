const deriveHostFromShop = (shop) => {
  if (!shop || typeof shop !== "string") return null;
  const suffix = ".myshopify.com";
  const store = shop.endsWith(suffix) ? shop.slice(0, -suffix.length) : shop;
  if (!store) return null;
  return window.btoa(`admin.shopify.com/store/${store}`);
};

const deriveShopFromHost = (host) => {
  if (!host || typeof host !== "string") return null;
  try {
    const decoded = window.atob(host);
    const match = decoded.match(/admin\.shopify\.com\/store\/([^/]+)/i);
    if (!match) return null;
    return `${match[1]}.myshopify.com`;
  } catch (error) {
    return null;
  }
};

export const resolveShopifyHost = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");
  if (host) {
    window.sessionStorage.setItem("shopifyHost", host);
    return host;
  }
  const storedHost = window.sessionStorage.getItem("shopifyHost");
  if (storedHost) return storedHost;
  const shop = params.get("shop");
  const derived = deriveHostFromShop(shop);
  if (derived) {
    window.sessionStorage.setItem("shopifyHost", derived);
    return derived;
  }
  return null;
};

export const resolveShopifyShop = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop");
  if (shop) {
    window.sessionStorage.setItem("shopifyShop", shop);
    return shop;
  }
  const storedShop = window.sessionStorage.getItem("shopifyShop");
  if (storedShop) return storedShop;
  const host = params.get("host");
  const derived = deriveShopFromHost(host);
  if (derived) {
    window.sessionStorage.setItem("shopifyShop", derived);
    return derived;
  }
  return null;
};
