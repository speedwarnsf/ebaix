import React, { useEffect } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { resolveShopifyHost } from "./lib/shopifyAppBridge";

function App() {
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const shopifyApiKey = process.env.REACT_APP_SHOPIFY_API_KEY;
  const shopifyHost = resolveShopifyHost();
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, []);
  const appBridgeConfig =
    shopifyApiKey && shopifyHost
      ? { apiKey: shopifyApiKey, host: shopifyHost, forceRedirect: !inIframe }
      : null;

  if (!appBridgeConfig) {
    return (
      <div className="min-h-screen bg-[#050305] text-white flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            loading
          </p>
          <p className="text-sm text-white/70">
            Open Nudio from Shopify Admin so we can load your store context.
          </p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="min-h-screen bg-[#050305] text-white">
      <header className="relative z-20" style={{ backgroundColor: "#050305" }}>
        <div className="w-full flex justify-center pb-4" style={{ paddingTop: "122px" }}>
          <div
            className="w-full flex flex-col items-start gap-2"
            style={{ maxWidth: "min(420px, calc(100vw - 48px))", marginLeft: "-19px" }}
          >
            <img
              src={`${process.env.PUBLIC_URL}/shopify/assets/NudioOverClear.png`}
              alt="nudio logotype"
              className="w-48 sm:w-64 h-auto"
              style={{ marginLeft: "-19px", marginTop: "-110px" }}
              loading="lazy"
            />
            <p className="text-xs text-white/50" style={{ marginTop: "-76px" }}>
              Strip distractions from your product photos.
              <br />
              Relight them in a professional studio environment.
            </p>
          </div>
        </div>
      </header>

      <main
        className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
        style={{ marginTop: "-60px" }}
      >
        <PhotoEnhancer anonKey={anonKey} supabaseUrl={supabaseUrl} />
      </main>
      <Toaster position="top-right" />
    </div>
  );

  return <AppBridgeProvider config={appBridgeConfig}>{content}</AppBridgeProvider>;
}

export default App;
