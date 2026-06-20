import { useEffect, useState } from "react";
import { Loader2, Globe, ArrowRight } from "lucide-react";

export default function AdminRedirect() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4">
        <Globe className="h-12 w-12 text-primary opacity-80" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-medium">Admin Access Required</h1>
          <p className="text-muted-foreground max-w-sm">
            You need to be logged in as an administrator to access the website configuration panel.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In to Admin Panel
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4">
      <Globe className="h-12 w-12 text-primary opacity-80" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-serif font-medium">Website Administration</h1>
        <p className="text-muted-foreground max-w-sm">
          You are logged in. Manage your website content from the ERP admin panel.
        </p>
      </div>
      <a
        href="/website-settings"
        className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Open Website Settings
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}
