export const resolveShopifyHost = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");
  if (host) {
    window.sessionStorage.setItem("shopifyHost", host);
    return host;
  }
  return window.sessionStorage.getItem("shopifyHost");
};

export const resolveShopifyShop = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop");
  if (shop) {
    window.sessionStorage.setItem("shopifyShop", shop);
    return shop;
  }
  return window.sessionStorage.getItem("shopifyShop");
};
