import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif_${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unread = notifications.filter((n: any) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      const q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
      const { error } = id ? await q.eq("id", id) : await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-10 h-10 rounded-full bg-card border border-border shadow-card flex items-center justify-center hover:bg-muted transition-colors" aria-label="Notificações">
          <Bell className="w-5 h-5 text-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markRead.mutate(undefined)}>
              <CheckCheck className="w-3 h-3" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">Você não tem notificações</p>
          ) : notifications.map((n: any) => (
            <button
              key={n.id}
              onClick={() => {
                markRead.mutate(n.id);
                setOpen(false);
                if (n.link) navigate(n.link);
              }}
              className={`w-full text-left p-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
