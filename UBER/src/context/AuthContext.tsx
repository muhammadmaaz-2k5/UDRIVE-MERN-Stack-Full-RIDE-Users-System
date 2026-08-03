import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { supabase } from "@/lib/supabase";
import type { Profile, Role } from "@/types";

interface AuthState {
  session: { user: { id: string } } | null;
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
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const refreshProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    } else {
      setProfile(null);
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && user) {
        (window as any).Clerk?.session?.getToken({ template: 'supabase' }).then((token: string | null) => {
          if (token) supabase.realtime.setAuth(token);
          refreshProfile();
        });
      } else {
        supabase.realtime.setAuth(null as any);
        setProfile(null);
        setLoadingProfile(false);
      }
    }
  }, [isLoaded, isSignedIn, user]);

  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
  };

  // The app is loading if Clerk is still initializing OR if the user is signed in but we haven't fetched their profile yet.
  const loading = !isLoaded || (isSignedIn && loadingProfile);
  const session = isSignedIn && user ? { user: { id: user.id } } : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        role: profile?.role ?? null,
        refreshProfile,
        signOut,
      }}
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
