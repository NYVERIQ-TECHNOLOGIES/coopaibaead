import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string; avatar_url: string | null; cooperativa: string | null } | null;
  role: AppRole | null;
  loading: boolean;
  passwordChangeRequired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const activeUser = useRef<string | null>(null);

  const fetchUserData = async (userId: string) => {
    const { data: required, error: securityError } = await supabase.rpc("needs_password_change");
    if (activeUser.current !== userId) return;
    setPasswordChangeRequired(securityError ? true : required === true);
    if (securityError || required) {
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, cooperativa").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    ]);
    if (activeUser.current !== userId) return;
    if (profileRes.data) setProfile(profileRes.data);
    if (roleRes.data) {
      setRole(roleRes.data.role);
      // Log admin access (server-side function silently no-ops for non-admins)
      if (roleRes.data.role === "admin") {
        supabase.rpc("log_admin_access", { _user_agent: navigator.userAgent }).then(() => {});
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      activeUser.current = session?.user.id ?? null;
      setLoading(Boolean(session?.user));
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setPasswordChangeRequired(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      activeUser.current = session?.user.id ?? null;
      if (session?.user) fetchUserData(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: refetch role/profile when admin changes them
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-role-changes-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => fetchUserData(user.id)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => fetchUserData(user.id)
      )
      .subscribe();

    // Also refetch when the tab regains focus, as a safety net
    const onFocus = () => fetchUserData(user.id);
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, passwordChangeRequired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
