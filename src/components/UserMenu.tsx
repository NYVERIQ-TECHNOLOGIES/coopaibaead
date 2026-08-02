import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

export default function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = profile?.full_name || user.email || "Usuário";
  const email = user.email || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-border bg-card hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menu do usuário"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-none max-w-[140px]">
            <span className="text-xs font-medium text-foreground truncate w-full text-left">
              {displayName}
            </span>
            {email && (
              <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                {email}
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/perfil")} className="cursor-pointer gap-2">
          <User className="h-4 w-4" /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="cursor-pointer gap-2">
          <Settings className="h-4 w-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
