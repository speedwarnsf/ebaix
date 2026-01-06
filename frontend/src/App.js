import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { BrowserRouter as Router, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { Toaster, toast } from "sonner";
import { PhotoEnhancer } from "./components/ui/PhotoEnhancer";
import { AuthOverlay } from "./components/ui/AuthOverlay";
import { ResetPassword } from "./components/ui/ResetPassword";
import PrivacyPolicy from "./components/ui/PrivacyPolicy";
import TermsOfService from "./components/ui/TermsOfService";
import { useSession } from "./context/SessionContext";
import { LensLab } from "./components/lenslab";
import { AffiliateIntro } from "./components/ui/AffiliateIntro";

const GUEST_BASELINE = {
  freeCreditsLimit: 3,
  freeCreditsRemaining: 3,
};

const computeGuestStorageKey = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return `nudio_guest_usage_${currentMonth}`;
};

const readGuestRemainingFromStorage = () => {
  if (typeof window === "undefined") {
    return GUEST_BASELINE.freeCreditsRemaining;
  }
  const storageKey = computeGuestStorageKey();
  const raw = window.localStorage.getItem(storageKey);
  const used = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(used)) {
    return GUEST_BASELINE.freeCreditsRemaining;
  }
  return Math.max(GUEST_BASELINE.freeCreditsLimit - used, 0);
};

const cleanAuthHeaders = (token) => {
  if (!token) return null;
  return token.replace(/[\r\n\t\s]/g, '').trim();
};

const buildHeaders = ({ accessToken, anonKey }) => {
  const cleanAccessToken = accessToken ? cleanAuthHeaders(accessToken) : null;
  const cleanAnonKey = anonKey ? cleanAuthHeaders(anonKey) : null;

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cleanAccessToken ?? cleanAnonKey}`,
    apikey: cleanAnonKey,
  };
};

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sessionRole,
    userEmail,
    accessToken,
    userId,
    openOverlay,
    signOut,
  } = useSession();
  const isResetRoute = location.pathname === "/reset-password";
  const isPrivacyRoute = location.pathname === "/privacy-policy";
  const isTermsRoute = location.pathname === "/terms-of-service";
  const isLensLabRoute = location.pathname === "/lens-lab";
  const isMainAppRoute =
    !isResetRoute && !isPrivacyRoute && !isTermsRoute && !isLensLabRoute;
  const isSignedIn = sessionRole === "member" || sessionRole === "guest";
  const handleLensLabLaunch = useCallback(() => {
    navigate("/lens-lab");
  }, [navigate]);

  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;

  const [usageSummary, setUsageSummary] = useState(GUEST_BASELINE);
  const [usageError, setUsageError] = useState(null);
  const rewardfulConversion = useRef({ sessionId: null, converted: false });
  const handleUsageUpdate = useCallback(
    (update) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("handleUsageUpdate", { update, sessionRole });
      }
      if (update && typeof update.freeCreditsRemaining === "number") {
        setUsageSummary((prev) => ({
          ...prev,
          ...update,
        }));
        return;
      }

      if (sessionRole === "guest") {
        const remaining = readGuestRemainingFromStorage();
        setUsageSummary((prev) => ({
          ...prev,
          freeCreditsLimit: GUEST_BASELINE.freeCreditsLimit,
          freeCreditsRemaining: remaining,
        }));
        return;
      }

      if (!update) {
        setUsageSummary(GUEST_BASELINE);
      }
    },
    [sessionRole]
  );

  useEffect(() => {
    if (sessionRole === "member") {
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.get("start") === "nudio") {
      openOverlay();
      params.delete("start");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : "",
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [location.hash, location.pathname, location.search, navigate, openOverlay, sessionRole]);

  useEffect(() => {
    if (!isMainAppRoute) {
      return;
    }

    if (sessionRole !== "member" || !userEmail || !accessToken) {
      setUsageError(null);
      if (sessionRole === "guest") {
        handleUsageUpdate(null);
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
        console.error("Usage fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          userEmail,
          accessToken: !!accessToken,
          supabaseUrl
        });
        setUsageError("We couldn't load your studio stats just yet.");
        toast.error("Usage data is warming up—your next nudio is still ready.");
      }
    };

    fetchUsage();

    return () => {
      mounted = false;
    };
  }, [accessToken, anonKey, handleUsageUpdate, isMainAppRoute, sessionRole, supabaseUrl, userEmail]);

  useEffect(() => {
    if (!isMainAppRoute) {
      return undefined;
    }

    if (sessionRole !== "guest" || typeof window === "undefined") {
      return undefined;
    }

    const syncFromStorage = () => handleUsageUpdate(null);
    syncFromStorage();

    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [handleUsageUpdate, isMainAppRoute, sessionRole]);

  useEffect(() => {
    if (!isMainAppRoute || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(location.search);
    const successFlag = params.get("success");
    const sessionId = params.get("session_id");
    const bundleTypeParam = params.get("bundle");

    if (successFlag !== "true" || !sessionId) {
      return;
    }

    const cleanUpParams = () => {
      params.delete("success");
      params.delete("session_id");
      params.delete("bundle");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
          hash: location.hash,
        },
        { replace: true },
      );
    };

    if (bundleTypeParam !== "subscription") {
      cleanUpParams();
      return;
    }

    // Avoid duplicate conversions for the same checkout session
    if (
      rewardfulConversion.current.sessionId === sessionId &&
      rewardfulConversion.current.converted
    ) {
      return;
    }

    const sanitizedEmail = (userEmail ?? "").trim().toLowerCase();
    if (!sanitizedEmail) {
      // Remember the session id so we can retry once the email becomes available
      rewardfulConversion.current.sessionId = sessionId;
      return;
    }

    try {
      window.rewardful?.("convert", { email: sanitizedEmail });
      rewardfulConversion.current = { sessionId, converted: true };
    } catch (rewardfulError) {
      console.warn("Rewardful conversion failed:", rewardfulError);
      rewardfulConversion.current.sessionId = sessionId;
      return;
    }

    cleanUpParams();
  }, [isMainAppRoute, location.hash, location.pathname, location.search, navigate, userEmail]);

  const statusChip = useMemo(() => {
    if (sessionRole === "member") {
      return `Signed in as ${userEmail}`;
    }
    if (sessionRole === "guest") {
      let storageRemaining = null;
      if (typeof window !== "undefined") {
        try {
          const storageKey = computeGuestStorageKey();
          const raw = window.localStorage.getItem(storageKey);
          const used = raw ? parseInt(raw, 10) : 0;
          if (!Number.isNaN(used)) {
            storageRemaining = Math.max(
              0,
              GUEST_BASELINE.freeCreditsLimit - used
            );
          }
        } catch {
          storageRemaining = null;
        }
      }
      const remaining =
        typeof storageRemaining === "number"
          ? storageRemaining
          : typeof usageSummary?.freeCreditsRemaining === "number"
          ? usageSummary.freeCreditsRemaining
          : GUEST_BASELINE.freeCreditsRemaining;
      return `Guest mode • ${remaining}/3 nudios this month`;
    }
    return "Choose how you’d like to create nudios";
  }, [sessionRole, usageSummary?.freeCreditsRemaining, userEmail]);

  if (!isMainAppRoute) {
    if (isResetRoute) {
      return <ResetPassword />;
    }
    if (isPrivacyRoute) {
      return <PrivacyPolicy />;
    }
    if (isTermsRoute) {
      return <TermsOfService />;
    }
    if (isLensLabRoute) {
      return (
        <>
          <LensLab
            onBack={() => navigate("/")}
            sessionRole={sessionRole}
            usageSummary={usageSummary}
            accessToken={accessToken}
            anonKey={anonKey}
            supabaseUrl={supabaseUrl}
            onUsageUpdate={handleUsageUpdate}
            userEmail={userEmail}
          />
          <AuthOverlay />
        </>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#050305] text-white">
      <AuthOverlay />
      {isSignedIn ? (
        <>
          <header style={{ backgroundColor: "#050305" }}>
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-start">
              <img
                src="/affiliate/assets/NudioOverClear.png"
                alt="nudio logotype"
                className="w-40 sm:w-56 h-auto"
                loading="lazy"
              />
            </div>

            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 hidden sm:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-white/70 max-w-xl">
                  Shoot or drop in your product photo, tap the button and we'll deliver a listing ready nudio in seconds.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs sm:text-sm text-white font-medium">
                  {statusChip}
                </span>
                <button
                  onClick={openOverlay}
                  className="text-xs sm:text-sm font-medium text-white underline underline-offset-4"
                >
                  Sign in / Join
                </button>
                {sessionRole === "member" && (
                  <button
                    onClick={signOut}
                    className="text-xs sm:text-sm text-white/60 underline underline-offset-4"
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="relative -mt-8 sm:-mt-12 z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <PhotoEnhancer
              sessionRole={sessionRole}
              userEmail={userEmail}
              userId={userId}
              usageSummary={usageSummary}
              onUsageUpdate={handleUsageUpdate}
              usageError={usageError}
              accessToken={accessToken}
              anonKey={anonKey}
              supabaseUrl={supabaseUrl}
              onLensLabLaunch={handleLensLabLaunch}
            />
          </main>
          <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-10 text-xs text-slate-500 flex items-center gap-4">
            <a className="underline underline-offset-4" href="/terms-of-service">
              Terms of Service
            </a>
            <a className="underline underline-offset-4" href="/privacy-policy">
              Privacy Policy
            </a>
          </footer>
        </>
      ) : (
        <AffiliateIntro
          onLaunch={openOverlay}
          onLabs={handleLensLabLaunch}
          isMember={sessionRole === "member"}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
