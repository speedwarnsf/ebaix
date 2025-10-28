import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "../../context/SessionContext";

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

  useEffect(() => {
    if (showOverlay) {
      setStage(hasSession ? "resume" : "choices");
      setEmail(userEmail);
      setPassword("");
      setError("");
      setRemember(rememberMe);
    }
  }, [hasSession, rememberMe, showOverlay, userEmail]);

  const canSubmit = email.trim() && password.trim();

  if (!showOverlay) return null;

  const handleGuest = () => {
    startGuest();
    toast.success("Guest mode unlocked—three nudios are on us this month!");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl px-8 py-10 space-y-6">
        {stage === "choices" && (
          <>
            <h2 className="text-2xl font-semibold text-slate-900">
              Welcome to Nudio ✨
            </h2>
            <p className="text-sm text-slate-600">
              Sign in to sync studio time across devices, or enjoy three complimentary guest nudios on us.
            </p>
            <button
              onClick={() => setStage("signin")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-lg transition"
            >
              Sign in to Nudio
            </button>
            <button
              onClick={handleGuest}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium py-3 rounded-lg transition"
            >
              Be our guest
            </button>
          </>
        )}

        {stage === "resume" && (
          <>
            <h2 className="text-2xl font-semibold text-slate-900">
              Welcome back, {userEmail || "friend"} 💫
            </h2>
            <p className="text-sm text-slate-600">
              You’re already signed in. Pick how you want to keep going.
            </p>
            <button
              onClick={handleContinue}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-lg transition"
            >
              Continue as {userEmail}
            </button>
            <button
              onClick={() => setStage("signin")}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium py-3 rounded-lg transition"
            >
              Use a different account
            </button>
            <button
              onClick={handleGuest}
              className="w-full text-slate-500 text-sm underline underline-offset-4"
            >
              Visit as a guest instead
            </button>
            <button
              onClick={signOut}
              className="w-full text-slate-400 text-xs underline underline-offset-4"
            >
              Sign out
            </button>
          </>
        )}

        {stage === "signin" && (
          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Log in to your studio
              </h2>
              <p className="text-sm text-slate-600">
                Keep your nudios, bundles, and prompts synced everywhere.
              </p>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-slate-600">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => {
                  const value = event.target.checked;
                  setRemember(value);
                  setRememberPreference(value);
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Remember this device
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!canSubmit || busy}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
              >
                {busy ? "Signing you in..." : "Enter the studio"}
              </button>
              <button
                type="button"
                onClick={() => setStage("forgot")}
                className="w-full text-slate-600 text-sm underline underline-offset-4"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setStage("choices")}
                className="w-full text-slate-500 text-sm underline underline-offset-4"
              >
                Back to welcome
              </button>
            </div>
          </form>
        )}

        {stage === "forgot" && (
          <form className="space-y-5" onSubmit={handleForgotPassword}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Reset your password
              </h2>
              <p className="text-sm text-slate-600">
                Enter your email address and we'll send you a password reset link.
              </p>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!email.trim() || busy}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
              >
                {busy ? "Sending reset email..." : "Send reset email"}
              </button>
              <button
                type="button"
                onClick={() => setStage("signin")}
                className="w-full text-slate-500 text-sm underline underline-offset-4"
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
