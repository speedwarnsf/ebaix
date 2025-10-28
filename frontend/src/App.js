import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Toaster, toast } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";
import { AuthOverlay } from "./components/ui/AuthOverlay";
import { useSession } from "./context/SessionContext";

const GUEST_BASELINE = {
  freeCreditsLimit: 3,
  freeCreditsRemaining: 3,
};

const buildHeaders = ({ accessToken, anonKey }) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken ?? anonKey}`,
  apikey: anonKey,
});

function App() {
  const {
    sessionRole,
    userEmail,
    accessToken,
    userId,
    openOverlay,
    signOut,
  } = useSession();

  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;

  const [usageSummary, setUsageSummary] = useState(GUEST_BASELINE);
  const [usageError, setUsageError] = useState(null);

  useEffect(() => {
    if (sessionRole !== "member" || !userEmail || !accessToken) {
      setUsageError(null);
      if (sessionRole === "guest") {
        setUsageSummary((prev) => ({
          ...GUEST_BASELINE,
          freeCreditsRemaining:
            typeof prev?.freeCreditsRemaining === "number"
              ? prev.freeCreditsRemaining
              : GUEST_BASELINE.freeCreditsRemaining,
        }));
      }
      return;
    }

    let mounted = true;

    const fetchUsage = async () => {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/usage-summary`,
          {
            method: "POST",
            headers: buildHeaders({ accessToken, anonKey }),
            body: JSON.stringify({ userEmail }),
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Usage fetch failed");
        }

        const payload = await response.json();
        if (mounted) {
          setUsageSummary(payload.usage ?? null);
          setUsageError(null);
        }
      } catch (error) {
        if (!mounted) return;
        setUsageError("We couldn’t load your studio stats just yet.");
        toast.error("Usage data is warming up—your next nudio is still ready.");
      }
    };

    fetchUsage();

    return () => {
      mounted = false;
    };
  }, [accessToken, anonKey, sessionRole, supabaseUrl, userEmail]);

  const statusChip = useMemo(() => {
    if (sessionRole === "member") {
      return `Signed in as ${userEmail}`;
    }
    if (sessionRole === "guest") {
      const remaining =
        typeof usageSummary?.freeCreditsRemaining === "number"
          ? usageSummary.freeCreditsRemaining
          : 3;
      return `Guest mode • ${remaining}/3 nudios this month`;
    }
    return "Choose how you’d like to create nudios";
  }, [sessionRole, usageSummary?.freeCreditsRemaining, userEmail]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AuthOverlay />

      <header className="bg-[#e1d0d0] border-b border-slate-200">
        <div className="w-full max-w-5xl mx-auto px-0 sm:px-0 py-0 flex flex-col">
          <img
            src="/nudioheader.jpg"
            alt="Nudio showcase"
            className="w-full h-auto object-cover"
          />
        </div>

        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 max-w-xl">
              Shoot or drop in your product photo, tap the button and we'll deliver a listing ready nudio in seconds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-white/70 border border-slate-200 rounded-full px-4 py-2 text-xs sm:text-sm text-slate-700 font-medium">
              {statusChip}
            </span>
            <button
              onClick={openOverlay}
              className="text-xs sm:text-sm font-medium text-slate-900 underline underline-offset-4"
            >
              Switch mode
            </button>
            {sessionRole === "member" && (
              <button
                onClick={signOut}
                className="text-xs sm:text-sm text-slate-500 underline underline-offset-4"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <PhotoEnhancer
          sessionRole={sessionRole}
          userEmail={userEmail}
          userId={userId}
          usageSummary={usageSummary}
          onUsageUpdate={setUsageSummary}
          usageError={usageError}
          accessToken={accessToken}
          anonKey={anonKey}
          supabaseUrl={supabaseUrl}
        />
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;
