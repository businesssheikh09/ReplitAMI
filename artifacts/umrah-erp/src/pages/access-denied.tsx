import { useLocation } from "wouter";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";

export default function AccessDenied() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "your role";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4 px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">
          This section is not available for the <span className="font-medium">{roleLabel}</span> department. Contact your administrator if you believe this is a mistake.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
        <Button onClick={() => setLocation("/")}>
          Home
        </Button>
      </div>
    </div>
  );
}
