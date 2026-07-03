import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Bot, Key, Check, Save, Info, ScanLine, Sliders } from "lucide-react";

interface OcrSettings {
  defaultProvider: string;
  ocrEnabled: boolean;
  minConfidence: number;
  autoReviewThreshold: number;
}

export default function AiSettingsPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [ocrSaved, setOcrSaved] = useState(false);
  const [ocrForm, setOcrForm] = useState<OcrSettings | null>(null);
  const headers = { Authorization: `Bearer ${token}` };

  const { data: status } = useQuery<{ configured: boolean; model: string }>({
    queryKey: ["ai-settings-status", token],
    queryFn: () => fetch("/api/ai-settings/status", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: ocrSettings } = useQuery<OcrSettings>({
    queryKey: ["ocr-settings", token],
    queryFn: () => fetch("/api/ocr-settings", { headers }).then((r) => r.json()),
    enabled: !!token,
    select: (data) => {
      if (!ocrForm) setOcrForm(data);
      return data;
    },
  });

  const keyMut = useMutation({
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
      setKeySaved(true);
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["ai-settings-status"] });
      setTimeout(() => setKeySaved(false), 3000);
    },
  });

  const ocrMut = useMutation({
    mutationFn: async (settings: OcrSettings) => {
      const res = await fetch("/api/ocr-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      setOcrSaved(true);
      qc.invalidateQueries({ queryKey: ["ocr-settings"] });
      setTimeout(() => setOcrSaved(false), 3000);
    },
  });

  const currentOcr = ocrForm ?? ocrSettings;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure AI integration and document OCR scanning preferences.</p>
      </div>

      {/* AI Status card */}
      <div className={`rounded-2xl border p-5 flex items-start gap-4 ${status?.configured ? "bg-teal-50 border-teal-200" : "bg-amber-50 border-amber-200"}`}>
        <Bot className={`h-6 w-6 shrink-0 mt-0.5 ${status?.configured ? "text-teal-600" : "text-amber-600"}`} />
        <div>
          <p className={`font-semibold text-sm ${status?.configured ? "text-teal-800" : "text-amber-800"}`}>
            {status?.configured ? "OpenAI Connected" : "OpenAI Not Configured"}
          </p>
          <p className={`text-xs mt-1 ${status?.configured ? "text-teal-700" : "text-amber-700"}`}>
            {status?.configured
              ? `AI OCR is active using model ${status.model}. Documents can be auto-scanned on upload.`
              : "AI OCR is unavailable. Enter an API key below, or use Local (Tesseract) OCR instead."}
          </p>
        </div>
      </div>

      {/* How to get API key */}
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
          To persist across restarts, add it as a Replit Secret.
          AI OCR uses <strong>gpt-4o-mini</strong> with vision.
        </div>
      </div>

      {/* API Key Input */}
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
        {keyMut.isError && <p className="text-sm text-destructive">Failed to save. Please try again.</p>}
        <button
          onClick={() => apiKey && keyMut.mutate(apiKey)}
          disabled={!apiKey || keyMut.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {keySaved ? <><Check className="h-4 w-4" /> Saved!</> : keyMut.isPending ? "Saving…" : <><Save className="h-4 w-4" /> Save API Key</>}
        </button>
      </div>

      {/* OCR Settings */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <ScanLine className="h-4 w-4 text-muted-foreground" />
          OCR Settings
        </div>
        <p className="text-xs text-muted-foreground -mt-3">Control how document scanning works across the ERP.</p>

        {currentOcr && (
          <div className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable OCR</p>
                <p className="text-xs text-muted-foreground">When disabled, all uploads use manual entry mode</p>
              </div>
              <button
                onClick={() => setOcrForm((f) => f ? { ...f, ocrEnabled: !f.ocrEnabled } : null)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${currentOcr.ocrEnabled ? "bg-teal-600" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${currentOcr.ocrEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Default Provider */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Default OCR Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "ai", label: "AI (GPT-4o)", desc: "Best accuracy, requires API key" },
                  { value: "local", label: "Local (Tesseract)", desc: "Free, works offline" },
                  { value: "manual", label: "Manual Only", desc: "No auto-scan, staff enters data" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOcrForm((f) => f ? { ...f, defaultProvider: opt.value } : null)}
                    className={`rounded-xl border p-3 text-left transition ${currentOcr.defaultProvider === opt.value ? "border-teal-500 bg-teal-50" : "border-border hover:border-teal-300"}`}
                  >
                    <p className={`text-xs font-semibold ${currentOcr.defaultProvider === opt.value ? "text-teal-800" : "text-foreground"}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Confidence */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Minimum Confidence Threshold</label>
                <span className="text-sm font-mono font-semibold text-teal-700">{currentOcr.minConfidence}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={currentOcr.minConfidence}
                onChange={(e) => setOcrForm((f) => f ? { ...f, minConfidence: parseInt(e.target.value) } : null)}
                className="w-full accent-teal-600"
              />
              <p className="text-xs text-muted-foreground mt-1">Results below this threshold are flagged for manual review.</p>
            </div>

            {/* Auto-review Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Auto-apply Threshold</label>
                <span className="text-sm font-mono font-semibold text-teal-700">{currentOcr.autoReviewThreshold}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={currentOcr.autoReviewThreshold}
                onChange={(e) => setOcrForm((f) => f ? { ...f, autoReviewThreshold: parseInt(e.target.value) } : null)}
                className="w-full accent-teal-600"
              />
              <p className="text-xs text-muted-foreground mt-1">Results above this threshold are automatically applied without review prompts.</p>
            </div>

            {ocrMut.isError && <p className="text-sm text-destructive">Failed to save OCR settings.</p>}
            <button
              onClick={() => currentOcr && ocrMut.mutate(currentOcr)}
              disabled={ocrMut.isPending}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 transition"
            >
              {ocrSaved ? <><Check className="h-4 w-4" /> Saved!</> : ocrMut.isPending ? "Saving…" : <><Save className="h-4 w-4" /> Save OCR Settings</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
