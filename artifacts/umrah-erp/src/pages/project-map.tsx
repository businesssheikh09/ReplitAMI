import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Map, RefreshCw, Download, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface MapStatus {
  exists: boolean;
  generatedAt: string | null;
  sizeBytes: number;
}

interface RegenResult {
  ok: boolean;
  downloadPath: string;
  generatedAt: string;
  sizeBytes: number;
  pages: number;
  totalMinutes: number;
  totalHours: number;
  costUSD: number;
}

function fmtSize(bytes: number) {
  if (bytes === 0) return "—";
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never generated";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ProjectMapPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };
  const [regenResult, setRegenResult] = useState<RegenResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch("/api/project-map/download", { headers });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "al-musafir-project-map.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed — try regenerating first.");
    } finally {
      setDownloading(false);
    }
  }

  const { data: status, isLoading: statusLoading } = useQuery<MapStatus>({
    queryKey: ["project-map-status", token],
    queryFn: () => fetch("/api/project-map/status", { headers }).then(r => r.json()),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const regenMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/project-map/regenerate", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Regeneration failed");
      }
      return res.json() as Promise<RegenResult>;
    },
    onSuccess: (data) => {
      setRegenResult(data);
      qc.invalidateQueries({ queryKey: ["project-map-status"] });
    },
  });

  const hasFile = status?.exists ?? false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Project Map</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate and download the 10-page PDF project map for Al Musafir International ERP.
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-5 flex items-start gap-4 ${hasFile ? "bg-teal-50 border-teal-200" : "bg-amber-50 border-amber-200"}`}>
        {hasFile
          ? <CheckCircle2 className="h-6 w-6 text-teal-600 shrink-0 mt-0.5" />
          : <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
        }
        <div>
          <p className={`font-semibold text-sm ${hasFile ? "text-teal-800" : "text-amber-800"}`}>
            {hasFile ? "PDF ready" : "PDF not generated yet"}
          </p>
          <p className={`text-xs mt-1 ${hasFile ? "text-teal-700" : "text-amber-700"}`}>
            {statusLoading
              ? "Checking…"
              : hasFile
                ? `Last generated: ${fmtDate(status?.generatedAt ?? null)}  •  ${fmtSize(status?.sizeBytes ?? 0)}`
                : "Click Regenerate to build the PDF for the first time."
            }
          </p>
        </div>
      </div>

      {/* Regeneration in-progress feedback */}
      {regenMut.isPending && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
          <p className="text-sm text-blue-800 font-medium">
            Generating PDF — this takes about 10–20 seconds…
          </p>
        </div>
      )}

      {/* Success result */}
      {regenResult && !regenMut.isPending && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 space-y-2">
          <p className="text-sm font-semibold text-teal-800">PDF regenerated successfully</p>
          <div className="grid grid-cols-3 gap-3 text-xs text-teal-700">
            <div><span className="font-medium">Pages:</span> {regenResult.pages}</div>
            <div><span className="font-medium">Agent time:</span> {regenResult.totalMinutes}m ({regenResult.totalHours}h) · ${regenResult.costUSD?.toFixed(2)}</div>
            <div><span className="font-medium">Size:</span> {fmtSize(regenResult.sizeBytes)}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {regenMut.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800 font-medium">Regeneration failed</p>
          <p className="text-xs text-red-700 mt-1">{(regenMut.error as Error).message}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Map className="h-4 w-4 text-muted-foreground" />
          Actions
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => regenMut.mutate()}
            disabled={regenMut.isPending}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy-600 bg-[#1e3a5f] text-white font-semibold text-sm hover:bg-[#162d4d] disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            <RefreshCw className={`h-4 w-4 ${regenMut.isPending ? "animate-spin" : ""}`} />
            {regenMut.isPending ? "Generating…" : "Regenerate PDF"}
          </button>

          {hasFile && (
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-teal-500 text-teal-700 font-semibold text-sm hover:bg-teal-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <Download className={`h-4 w-4 ${downloading ? "animate-bounce" : ""}`} />
              {downloading ? "Downloading…" : "Download PDF"}
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Regenerating rebuilds all 10 pages from the current codebase description.
          The existing file is overwritten. Generation takes about 10–20 seconds.
        </p>
      </div>

      {/* What's in the PDF */}
      <div className="bg-stone-50 rounded-2xl border border-border p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">What the PDF contains</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>System Architecture Overview</li>
          <li>User Roles &amp; Permissions</li>
          <li>ERP Module Directory (all screens)</li>
          <li>Customer Journey Map</li>
          <li>API Reference Map</li>
          <li>Database Table Directory</li>
          <li>Key Operational Workflows</li>
          <li>Developer Quick-Reference</li>
          <li>Actual Agent Working Time — live from git history, $5/hr rate</li>
        </ol>
      </div>
    </div>
  );
}
