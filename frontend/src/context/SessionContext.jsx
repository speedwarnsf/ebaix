import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";

const SessionContext = createContext(null);

const REMEMBER_KEY = "nudio:remember";
const LAST_MODE_KEY = "nudio:lastMode";

const readFlag = (key) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
};

const readValue = (key) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

const writeFlag = (key, value) => {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, "true");
  else window.localStorage.removeItem(key);
};

const writeValue = (key, value) => {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
};

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [guestActive, setGuestActive] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(() => readFlag(REMEMBER_KEY));

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const activeSession = data.session ?? null;
      setSession(activeSession);

      const lastMode = readValue(LAST_MODE_KEY);

      if (activeSession) {
        setGuestActive(false);
        if (rememberMe || lastMode === "member") setOverlayOpen(false);
      } else if (lastMode === "guest") {
        setGuestActive(true);
        setOverlayOpen(false);
      }

      setLoading(false);
    };

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      if (nextSession) {
        setGuestActive(false);
        writeValue(LAST_MODE_KEY, "member");
        setOverlayOpen(false);
      } else {
        setOverlayOpen(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [rememberMe]);

  const dismissOverlay = () => setOverlayOpen(false);

  const startGuest = () => {
    setGuestActive(true);
    writeValue(LAST_MODE_KEY, "guest");
    dismissOverlay();
  };

  const setRememberPreference = (value) => {
    writeFlag(REMEMBER_KEY, value);
    setRememberMe(value);
  };

  const completeMember = (newSession, remember) => {
    setSession(newSession);
    setGuestActive(false);
    writeValue(LAST_MODE_KEY, "member");
    setRememberPreference(remember);
    dismissOverlay();
  };

  const signInWithPassword = async ({ email, password, remember }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    completeMember(data.session, remember);
    return data.session;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setGuestActive(false);
    setOverlayOpen(true);
    writeValue(LAST_MODE_KEY, null);
    writeFlag(REMEMBER_KEY, false);
  };

  const value = useMemo(() => {
    const sessionRole = session ? "member" : guestActive ? "guest" : "unknown";

    return {
      session,
      sessionRole,
      accessToken: session?.access_token ?? null,
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? "",
      rememberMe,
      setRememberPreference,
      signInWithPassword,
      resetPassword,
      signOut,
      startGuest,
      completeMember,
      dismissOverlay,
      showOverlay: overlayOpen && !loading,
      openOverlay: () => setOverlayOpen(true),
      isLoading: loading,
      hasSession: Boolean(session),
    };
  }, [guestActive, loading, overlayOpen, rememberMe, session]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
};