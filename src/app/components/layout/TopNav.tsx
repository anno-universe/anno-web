import { Link } from "react-router";
import { useAuthStore } from "@/stores/authStore";

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
        <button
          onClick={logout}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
