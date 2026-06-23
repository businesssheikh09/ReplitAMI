import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Bot, Key, Check, Save, Info } from "lucide-react";

export default function AiSettingsPage() {
  const { token } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: status } = useQuery<{ configured: boolean; model: string }>({
    queryKey: ["ai-settings-status", token],
    queryFn: () =>
      fetch("/api/ai-settings/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ openaiApiKey: key }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure the OpenAI API key for passport/document OCR scanning.</p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-5 flex items-start gap-4 ${status?.configured ? "bg-teal-50 border-teal-200" : "bg-amber-50 border-amber-200"}`}>
        <Bot className={`h-6 w-6 shrink-0 mt-0.5 ${status?.configured ? "text-teal-600" : "text-amber-600"}`} />
        <div>
          <p className={`font-semibold text-sm ${status?.configured ? "text-teal-800" : "text-amber-800"}`}>
            {status?.configured ? "OpenAI Connected" : "OpenAI Not Configured"}
          </p>
          <p className={`text-xs mt-1 ${status?.configured ? "text-teal-700" : "text-amber-700"}`}>
            {status?.configured
              ? `Passport OCR is active using model ${status.model}. Documents are auto-scanned on upload.`
              : "Passport OCR is running in stub mode — fields will not be auto-filled from uploaded documents. Enter an API key below to activate."}
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-stone-50 rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-muted-foreground" />
          How to get an OpenAI API Key
        </div>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">platform.openai.com/api-keys</a></li>
          <li>Create a project API key (starts with <code className="bg-white border border-border rounded px-1">sk-proj-</code>)</li>
          <li>Ensure your OpenAI account has credits loaded</li>
          <li>Paste the key below and click Save</li>
        </ol>
        <div className="text-xs text-muted-foreground pt-1 border-t border-border">
          The key is stored as <code className="bg-white border border-border rounded px-1">OPENAI_API_KEY</code> in the server environment.
          To persist across restarts, add <code className="bg-white border border-border rounded px-1">OPENAI_API_KEY</code> as a Replit Secret.
          OCR uses <strong>gpt-4o-mini</strong> with vision — extremely cost-effective (fractions of a cent per scan).
        </div>
      </div>

      {/* Key input */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Key className="h-4 w-4 text-muted-foreground" />
          OpenAI API Key
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {status?.configured ? "Replace existing key (leave blank to keep current)" : "Enter your API key"}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-proj-…"
            className="w-full px-4 py-3 rounded-xl border border-border text-sm font-mono focus:ring-2 focus:ring-teal-500/40 focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Failed to save. Please try again.</p>
        )}

        <button
          onClick={() => apiKey && mutation.mutate(apiKey)}
          disabled={!apiKey || mutation.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {saved ? <><Check className="h-4 w-4" /> Saved!</> : mutation.isPending ? "Saving…" : <><Save className="h-4 w-4" /> Save API Key</>}
        </button>
      </div>
    </div>
  );
}
