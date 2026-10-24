import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
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
  /** true quando a busca de perfil/papel terminou (com sucesso ou erro) */
  dataReady: boolean;
  /** mensagem amigável quando o carregamento dos dados falhou */
  loadError: string | null;
  retry: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tempo máximo de espera antes de desistir e mostrar erro recuperável
const LOAD_TIMEOUT_MS = 12000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const fetchUserData = useCallback(async (userId: string) => {
    setDataReady(false);
    setLoadError(null);
    clearWatchdog();
    // Watchdog: nunca deixar a tela presa em carregamento infinito
    timeoutRef.current = setTimeout(() => {
      setDataReady(true);
      setLoadError("A conexão demorou demais para responder. Verifique sua internet e tente novamente.");
    }, LOAD_TIMEOUT_MS);

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, cooperativa").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);
      clearWatchdog();

      if (profileRes.error || roleRes.error) {
        console.error("Falha ao carregar dados do usuário:", profileRes.error?.message, roleRes.error?.message);
        setDataReady(true);
        setLoadError("Não foi possível carregar seus dados. Tente novamente.");
        return;
      }

      if (profileRes.data) setProfile(profileRes.data);
      if (roleRes.data) {
        setRole(roleRes.data.role);
        // Log admin access (server-side function silently no-ops for non-admins)
        if (roleRes.data.role === "admin") {
          supabase.rpc("log_admin_access", { _user_agent: navigator.userAgent }).then(() => {});
        }
      } else {
        // Conta autenticada sem papel cadastrado: não conceder acesso, mas sair do carregamento
        setRole(null);
      }
      setDataReady(true);
    } catch (e) {
      clearWatchdog();
      console.error("Erro inesperado ao carregar dados do usuário:", e);
      setDataReady(true);
      setLoadError("Ocorreu uma falha ao carregar seus dados. Tente novamente.");
    }
  }, []);

  const retry = useCallback(() => {
    if (user?.id) {
      fetchUserData(user.id);
    } else {
      // Sem sessão carregada: tentar recuperar a sessão novamente
      setLoading(true);
      setLoadError(null);
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchUserData(session.user.id);
        setLoading(false);
      });
    }
  }, [user?.id, fetchUserData]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setDataReady(false);
        setLoadError(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchUserData(session.user.id);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Falha ao recuperar a sessão:", e);
        setLoading(false);
        setLoadError("Não foi possível verificar sua sessão. Tente novamente.");
      });

    return () => {
      subscription.unsubscribe();
      clearWatchdog();
    };
  }, [fetchUserData]);

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
  }, [user?.id, fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setDataReady(false);
    setLoadError(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, dataReady, loadError, retry, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
