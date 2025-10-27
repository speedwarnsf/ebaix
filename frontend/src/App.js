import React, { useEffect, useState } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";

function App() {
  const userEmail = "speedwarnsf@gmail.com";
  const [usageSummary, setUsageSummary] = useState(null);
  const [usageError, setUsageError] = useState(null);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/usage-summary`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userEmail }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load usage summary");
        }

        const data = await response.json();
        setUsageSummary(data.usage ?? null);
        setUsageError(null);
      } catch (error) {
        console.error("Usage summary error:", error);
        setUsageError(error.message);
      }
    };

    loadUsage();
  }, [userEmail]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#e1d0d0] border-b border-slate-200">
        <div className="w-full max-w-5xl mx-auto px-0 sm:px-0 py-0 flex flex-col">
          <img
            src="/nudioheader.jpg"
            alt="nudio header"
            className="w-full h-auto object-cover"
          />
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <PhotoEnhancer
          userEmail={userEmail}
          usageSummary={usageSummary}
          onUsageUpdate={setUsageSummary}
          usageError={usageError}
        />
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;
