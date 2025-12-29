import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabaseClient";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Handle the auth callback from email link
    const handleAuthCallback = async () => {
      try {
        // Get the current URL to check for auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log("URL params:", { accessToken: !!accessToken, refreshToken: !!refreshToken });

        if (accessToken && refreshToken) {
          // Set the session from the URL tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error("Session setup error:", error);
            setError("Invalid reset link. Please request a new password reset.");
            setSessionChecked(true);
            return;
          }

          console.log("Session established:", data);
        }

        // Check if we now have a valid session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Final session check:", sessionData);

        setSessionChecked(true);

        if (!sessionData.session) {
          setError("This reset link is invalid or expired. Please request a new password reset.");
          setTimeout(() => {
            window.location.href = "/";
          }, 5000);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("Something went wrong. Please try again.");
        setSessionChecked(true);
      }
    };

    handleAuthCallback();
  }, []);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success("Password updated successfully! You can now sign in.");

      // Redirect to home page after successful reset
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl px-8 py-10 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">
            Reset Your Password
          </h2>
          <p className="text-slate-600">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="space-y-1 block">
            <span className="text-sm font-medium text-slate-600">New Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
              minLength={6}
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-slate-600">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
              minLength={6}
            />
          </label>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}