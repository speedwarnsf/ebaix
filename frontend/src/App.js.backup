import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Toaster } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";

function App() {
  const [userEmail, setUserEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("nudio:userEmail") ?? "";
  });
  const [usageSummary, setUsageSummary] = useState(null);
  const [usageError, setUsageError] = useState(null);

  const sanitizedEmail = useMemo(() => userEmail.trim().toLowerCase(), [userEmail]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nudio:userEmail", userEmail ?? "");
    }
  }, [userEmail]);

  useEffect(() => {
    if (!sanitizedEmail) {
      setUsageSummary(null);
      setUsageError("Enter your email to track credits");
      return;
    }

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
            body: JSON.stringify({ userEmail: sanitizedEmail }),
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
  }, [sanitizedEmail]);

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
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What email should we use to track your nudio credits?
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
            className="w-full max-w-md border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {usageError && sanitizedEmail && (
            <p className="mt-2 text-sm text-red-500">
              {usageError}
            </p>
          )}
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <PhotoEnhancer
          userEmail={sanitizedEmail}
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
