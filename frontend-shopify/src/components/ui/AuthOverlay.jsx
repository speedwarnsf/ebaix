import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "../../context/SessionContext";
import {
  CREDIT_BUNDLES,
  SUBSCRIPTION,
} from "../../stripeIntegration";

export function AuthOverlay() {
  const {
    showOverlay,
    startGuest,
    signInWithPassword,
    resetPassword,
    userEmail,
    hasSession,
    dismissOverlay,
    rememberMe,
    setRememberPreference,
    signOut,
  } = useSession();

  const [stage, setStage] = useState("choices");
  const [email, setEmail] = useState(userEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(rememberMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prevOverlayState = useRef(showOverlay);

  useEffect(() => {
    if (showOverlay && !prevOverlayState.current) {
      setStage(hasSession ? "resume" : "choices");
      setEmail(userEmail);
      setPassword("");
      setError("");
    }
    prevOverlayState.current = showOverlay;
  }, [hasSession, showOverlay, userEmail]);

  useEffect(() => {
    if (showOverlay) {
      setRemember(rememberMe);
    }
  }, [rememberMe, showOverlay]);

  const handleRememberChange = (value) => {
    setRemember(value);
    setRememberPreference(value);
  };

  const canSubmit = email.trim() && password.trim();

  if (!showOverlay) return null;

  const handleGuest = () => {
    const firstGuestRun = !hasSession && stage !== "resume";
    startGuest();
    if (firstGuestRun) {
      toast.success("Guest mode unlocked—three nudios are on us this month!");
    } else {
      toast("Visiting as a guest—existing credits stay put.");
    }
  };

  const handleContinue = () => {
    dismissOverlay();
    toast.success("Welcome back—let’s make another nudio sparkle!");
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError("");

    try {
      await signInWithPassword({
        email: email.trim(),
        password: password.trim(),
        remember,
      });
      toast.success("You're in! Your studio is warmed up.");
    } catch (authError) {
      const message =
        authError?.message?.replace?.(
          "Invalid login credentials",
          "That combo didn't work—give it another try."
        ) ?? "We couldn't sign you in just yet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await resetPassword(email.trim());
      toast.success("Password reset email sent! Check your inbox.");
      setStage("signin");
    } catch (resetError) {
      const message = resetError?.message ?? "We couldn't send the reset email.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    dismissOverlay();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center pb-8 px-4">
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[4px]" />
      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#0b070f]/95 px-5 py-6 text-white shadow-[0_20px_50px_rgba(8,4,18,0.55)]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close sign-in panel"
          className="absolute right-4 top-4 text-white/50 hover:text-white transition"
        >
          ×
        </button>
        {stage === "choices" && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-white">
              Sign in or keep exploring
            </h2>
            <button
              onClick={() => setStage("signin")}
              className="w-full rounded-2xl bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white font-semibold py-3 shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)] transition"
            >
              Sign in
            </button>
            <button
              onClick={handleGuest}
              className="w-full rounded-2xl border border-white/15 bg-white/5 text-white font-medium py-3 hover:bg-white/10 transition"
            >
              Continue as guest
            </button>
            <button
              onClick={() => setStage("signup")}
              className="w-full rounded-2xl border border-white/15 bg-white/5 text-white font-medium py-3 hover:bg-white/10 transition"
            >
              See pricing & sign up
            </button>
          </div>
        )}

        {stage === "resume" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Signed in as {userEmail}
            </h2>
            <button
              onClick={handleContinue}
              className="w-full rounded-2xl bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white font-semibold py-3 shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)] transition"
            >
              Continue
            </button>
            <button
              onClick={() => setStage("signin")}
              className="w-full rounded-2xl border border-white/15 bg-white/5 text-white font-medium py-3 hover:bg-white/10 transition"
            >
              Switch account
            </button>
            <button
              onClick={handleGuest}
              className="w-full text-white/60 text-sm underline underline-offset-4"
            >
              Browse as guest
            </button>
            <button
              onClick={signOut}
              className="w-full text-white/40 text-xs underline underline-offset-4"
            >
              Sign out
            </button>
          </div>
        )}

        {stage === "signin" && (
          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                Log in to your studio
              </h2>
              <p className="text-sm text-white/70">
                Keep your nudios, bundles, and prompts synced everywhere.
              </p>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-white/80">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-white/15 bg-white/5 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                required
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-white/80">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-white/15 bg-white/5 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                required
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => handleRememberChange(event.target.checked)}
                className="h-4 w-4 rounded border-white/25 text-[#f472b6] bg-transparent focus:ring-white/40"
              />
              Remember this device
            </label>

            {error && <p className="text-sm text-rose-200">{error}</p>}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!canSubmit || busy}
                className="w-full rounded-2xl bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white font-semibold py-3 shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)] disabled:from-slate-500 disabled:to-slate-600 disabled:cursor-not-allowed transition"
              >
                {busy ? "Signing you in..." : "Enter the studio"}
              </button>
              <button
                type="button"
                onClick={() => setStage("forgot")}
                className="w-full text-white/70 text-sm underline underline-offset-4"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setStage("choices")}
                className="w-full text-white/60 text-sm underline underline-offset-4"
              >
                Back to welcome
              </button>
            </div>
          </form>
        )}

        {stage === "signup" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                Choose the bundle that fits
              </h2>
              <p className="text-sm text-white/70">
                Unlock nudios instantly — sign in after selecting a plan to complete checkout.
              </p>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(CREDIT_BUNDLES).map(([key, bundle]) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white/90 space-y-3"
                  >
                    {bundle.badge && (
                      <span className="inline-flex rounded-full border border-white/20 px-3 py-0.5 text-[10px] uppercase tracking-[0.4em] text-white/70">
                        {bundle.badge === "best value" ? "tight budget" : bundle.badge}
                      </span>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-base font-semibold text-white">
                        {bundle.name}
                      </p>
                      <p className="text-xs text-white/60">One-time bundle</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-white">
                        ${bundle.price}
                      </p>
                      <p className="text-xs text-white/60">
                        {bundle.credits} nudios · ${(bundle.price / bundle.credits).toFixed(2)} each
                      </p>
                    </div>
                    <p className="text-xs text-white/60">
                      Sign in to purchase and the bundle lands in your studio immediately.
                    </p>
                    <button
                      onClick={() => setStage("signin")}
                      className="w-full rounded-full border border-white/20 bg-white/5 text-white text-xs font-semibold py-2 hover:bg-white/10 transition"
                    >
                      Sign in to buy
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-3 text-white">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">subscription</p>
                  <p className="text-lg font-semibold">{SUBSCRIPTION.name}</p>
                  <p className="text-sm text-white/70">
                    {SUBSCRIPTION.description ?? "Ideal for power sellers ready for unlimited nudios."}
                  </p>
                </div>
                <p className="text-2xl font-semibold">
                  ${SUBSCRIPTION.price}
                  <span className="text-sm font-normal text-white/70">/month</span>
                </p>
                <p className="text-xs text-white/60">
                  Includes unlimited nudios plus fastest access to new features.
                </p>
                <button
                  onClick={() => setStage("signin")}
                  className="w-full rounded-full border border-white/20 bg-white/5 text-white text-xs font-semibold py-2 hover:bg-white/10 transition"
                >
                  Subscribe
                </button>
              </div>
            </div>
            <button
              onClick={() => setStage("choices")}
              className="w-full rounded-full border border-white/15 bg-white/5 text-white font-medium py-3 hover:bg-white/10 transition"
            >
              Back
            </button>
          </div>
        )}

        {stage === "forgot" && (
          <form className="space-y-5" onSubmit={handleForgotPassword}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                Reset your password
              </h2>
              <p className="text-sm text-white/70">
                Enter your email address and we'll send you a password reset link.
              </p>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-white/80">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-white/15 bg-white/5 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                required
              />
            </label>

            {error && <p className="text-sm text-rose-200">{error}</p>}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!email.trim() || busy}
                className="w-full rounded-2xl bg-gradient-to-r from-[#f472b6] to-[#c084fc] text-white font-semibold py-3 shadow-[0_10px_30px_rgba(244,114,182,0.35)] hover:shadow-[0_12px_35px_rgba(192,132,252,0.4)] disabled:from-slate-500 disabled:to-slate-600 disabled:cursor-not-allowed transition"
              >
                {busy ? "Sending reset email..." : "Send reset email"}
              </button>
              <button
                type="button"
                onClick={() => setStage("signin")}
                className="w-full text-white/70 text-sm underline underline-offset-4"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
