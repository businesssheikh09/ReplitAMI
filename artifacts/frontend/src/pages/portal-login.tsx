import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePortalAuth } from "@/lib/portal-auth";

export default function PortalLoginPage() {
  const [, navigate] = useLocation();
  const { login } = usePortalAuth();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Login failed" }));
        throw new Error(err.error ?? "Login failed");
      }
      return res.json() as Promise<{ token: string; user: any }>;
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      navigate("/my-bookings");
    },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">Portal Sign In</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-serif mb-2">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your Al Musafir portal account.</p>
        </div>

        <div className="bg-white rounded-3xl border border-border p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone or Email</label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="+92 300 000 0000"
              className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none focus:border-teal-500 transition"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">Password</label>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !emailOrPhone || !password}
            className="w-full py-4 rounded-2xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}
          </button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button onClick={() => navigate("/portal-register")} className="text-teal-600 hover:underline">
                Register here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
