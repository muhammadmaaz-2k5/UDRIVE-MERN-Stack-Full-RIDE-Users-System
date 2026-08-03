import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, Role } from "@/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  role: Role | null;
}

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
    role: null,
  });

  async function loadProfile(session: Session | null) {
    if (!session?.user) {
      setState({ session: null, profile: null, loading: false, role: null });
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setState({
        session,
        profile: null,
        loading: false,
        role: null,
      });
      return;
    }
    setState({
      session,
      profile: data as Profile | null,
      loading: false,
      role: (data as Profile | null)?.role ?? null,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        await loadProfile(session);
      })();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (state.session) await loadProfile(state.session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ session: null, profile: null, loading: false, role: null });
  };

  return (
    <AuthContext.Provider
      value={{ ...state, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
