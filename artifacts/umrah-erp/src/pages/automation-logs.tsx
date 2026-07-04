import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Filter, FileText } from "lucide-react";

interface AutomationLog {
  id: number;
  automationType: string;
  entityType: string | null;
  entityId: number | null;
  triggeredAt: string;
  recipient: string | null;
  messagePreview: string | null;
  status: string;
  errorMessage: string | null;
  executionTime: number | null;
  createdAt: string;
}

const AUTOMATION_LABELS: Record<string, string> = {
  payment_reminder:      "Payment Reminder",
  hotel_checkin_reminder:"Hotel Check-in",
  hotel_vendor_followup: "Vendor Follow-up",
  flight_reminder:       "Flight Reminder",
  passport_expiry:       "Passport Expiry",
  visa_expiry:           "Visa Expiry",
  management_summary:    "Mgmt Summary",
  pending_approvals:     "Pending Approvals",
};

export default function AutomationLogsPage() {
  const { token } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const headers = { Authorization: `Bearer ${token}` };
  const url = `/api/automation-logs?limit=200${typeFilter ? `&type=${typeFilter}` : ""}`;

  const { data, isLoading } = useQuery<{ logs: AutomationLog[] }>({
    queryKey: ["automation-logs-all", typeFilter],
    queryFn: () => fetch(url, { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const logs = data?.logs ?? [];
  const sentCount   = logs.filter((l) => l.status === "sent").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const skippedCount = logs.filter((l) => l.status === "skipped").length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> Automation Logs</h2>
        <p className="text-sm text-muted-foreground">Full audit trail of all automation executions.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-3 text-center">
          <div className="text-2xl font-bold text-green-700">{sentCount}</div>
          <div className="text-xs text-muted-foreground">Sent</div>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <div className={`text-2xl font-bold ${failedCount > 0 ? "text-red-600" : "text-gray-500"}`}>{failedCount}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{skippedCount}</div>
          <div className="text-xs text-muted-foreground">Skipped</div>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter:</span>
        <button
          onClick={() => setTypeFilter("")}
          className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${!typeFilter ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          All
        </button>
        {Object.entries(AUTOMATION_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(t => t === type ? "" : type)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${typeFilter === type ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Logs table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{logs.length} entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && logs.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No logs found.</div>
          )}
          <div className="divide-y">
            {logs.map((log) => (
              <div
                key={log.id}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {log.status === "sent"    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  : log.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  : <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                  <span className="text-xs font-medium">{AUTOMATION_LABELS[log.automationType] ?? log.automationType}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    log.status === "sent"    ? "bg-green-100 text-green-700"
                  : log.status === "failed" ? "bg-red-100 text-red-600"
                  : "bg-gray-100 text-gray-500"}`}>{log.status}</span>
                  {log.entityType && <span className="text-xs text-muted-foreground">{log.entityType} #{log.entityId}</span>}
                  {log.recipient && (
                    <span className="text-xs text-muted-foreground">{log.recipient.replace("@s.whatsapp.net", "")}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {new Date(log.triggeredAt).toLocaleString()}
                  </span>
                  {log.executionTime && (
                    <span className="text-xs text-muted-foreground shrink-0">{log.executionTime}ms</span>
                  )}
                </div>

                {expandedId === log.id && (
                  <div className="mt-2 pl-5 space-y-1">
                    {log.messagePreview && (
                      <div className="text-xs bg-blue-50 border border-blue-100 rounded p-2 font-mono whitespace-pre-wrap">{log.messagePreview}</div>
                    )}
                    {log.errorMessage && (
                      <div className="text-xs bg-red-50 border border-red-100 rounded p-2 text-red-700">{log.errorMessage}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
