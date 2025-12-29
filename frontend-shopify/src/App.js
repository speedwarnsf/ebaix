import React from "react";
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
  const appBridgeConfig =
    shopifyApiKey && shopifyHost
      ? { apiKey: shopifyApiKey, host: shopifyHost, forceRedirect: true }
      : null;

  const content = (
    <div className="min-h-screen bg-[#050305] text-white">
      <header style={{ backgroundColor: "#050305" }}>
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-start gap-3">
          <img
            src="/affiliate/assets/NudioOverClear.png"
            alt="nudio logotype"
            className="w-40 sm:w-56 h-auto"
            loading="lazy"
          />
          <p className="text-sm text-white/70 max-w-2xl">
            Strip distractions from your product photos. Relight them in a professional studio environment.
          </p>
        </div>
      </header>

      <main className="relative -mt-8 sm:-mt-12 z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <PhotoEnhancer anonKey={anonKey} supabaseUrl={supabaseUrl} />
      </main>
      <Toaster position="top-right" />
    </div>
  );

  if (!appBridgeConfig) {
    return content;
  }

  return <AppBridgeProvider config={appBridgeConfig}>{content}</AppBridgeProvider>;
}

export default App;
