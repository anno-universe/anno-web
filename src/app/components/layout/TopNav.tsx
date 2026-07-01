import { Link } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

export function TopNav() {
  const { user, logout } = useAuthStore();

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-4">
        <Link
          to="/projects"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Anno
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs text-muted-foreground">
            {user.username}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
