import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Power, PowerOff, Clock, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, Settings, Zap,
} from "lucide-react";

interface Automation {
  type: string;
  name: string;
  description: string;
  defaultCron: string;
  enabled: boolean;
  cronExpression: string;
  lastRunAt: string | null;
  successCount: number;
  failureCount: number;
  lastStatus: "idle" | "running" | "success" | "partial" | "failure";
  templateOverride: string | null;
}

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
}

const STATUS_COLORS: Record<string, string> = {
  idle:    "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  failure: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  idle:    Clock,
  running: RefreshCw,
  success: CheckCircle2,
  partial: AlertCircle,
  failure: XCircle,
};

function AutomationCard({ automation, token }: { automation: Automation; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [editCron, setEditCron] = useState(automation.cronExpression);
  const [editTemplate, setEditTemplate] = useState(automation.templateOverride ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const toggle = useMutation({
    mutationFn: () =>
      fetch(`/api/automations/${automation.type}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: !automation.enabled }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: automation.enabled ? "Automation disabled" : "Automation enabled" });
    },
  });

  const save = useMutation({
    mutationFn: () =>
      fetch(`/api/automations/${automation.type}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ cronExpression: editCron, templateOverride: editTemplate || null }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Settings saved" });
    },
  });

  const runNow = useMutation({
    mutationFn: () =>
      fetch(`/api/automations/${automation.type}/run`, { method: "POST", headers }).then((r) => r.json()),
    onSuccess: () => toast({ title: `${automation.name} started` }),
  });

  const { data: logsData } = useQuery<{ logs: AutomationLog[] }>({
    queryKey: ["automation-logs", automation.type],
    queryFn: () =>
      fetch(`/api/automations/${automation.type}/logs?limit=10`, { headers }).then((r) => r.json()),
    enabled: expanded,
  });

  const StatusIcon = STATUS_ICONS[automation.lastStatus] ?? Clock;

  return (
    <Card className={`transition-all ${automation.enabled ? "" : "opacity-60"}`}>
      <CardContent className="pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{automation.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[automation.lastStatus] ?? "bg-gray-100 text-gray-600"}`}>
                <StatusIcon className="h-3 w-3 inline mr-1" />
                {automation.lastStatus}
              </span>
              {automation.enabled ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">Active</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border font-medium">Disabled</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{automation.description}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>⏱ {automation.cronExpression}</span>
              <span className="text-green-600">✓ {automation.successCount}</span>
              <span className="text-red-500">✗ {automation.failureCount}</span>
              {automation.lastRunAt && (
                <span>Last: {new Date(automation.lastRunAt).toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
            >
              <Play className="h-3 w-3 mr-1" /> Run
            </Button>
            <Button
              size="sm"
              variant={automation.enabled ? "outline" : "default"}
              className={`h-7 px-2 text-xs ${automation.enabled ? "border-red-200 text-red-600 hover:bg-red-50" : "bg-green-600 hover:bg-green-700 text-white"}`}
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {automation.enabled ? <><PowerOff className="h-3 w-3 mr-1" />Disable</> : <><Power className="h-3 w-3 mr-1" />Enable</>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 px-0"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded config */}
        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Cron Schedule</label>
                <div className="flex gap-2">
                  <input
                    className="border rounded px-2 py-1 text-xs font-mono flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={editCron}
                    onChange={(e) => setEditCron(e.target.value)}
                    placeholder="0 8 * * *"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Default: {automation.defaultCron}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Message Template Override (leave blank for default)</label>
              <textarea
                className="border rounded px-2 py-1 text-xs font-mono w-full focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                rows={6}
                value={editTemplate}
                onChange={(e) => setEditTemplate(e.target.value)}
                placeholder="Leave blank to use the default template..."
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="text-xs h-7">
                <Settings className="h-3 w-3 mr-1" /> Save Settings
              </Button>
            </div>

            {/* Recent logs */}
            {logsData?.logs && logsData.logs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Recent Executions</p>
                <div className="space-y-1">
                  {logsData.logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1 bg-gray-50">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.status === "sent" ? "bg-green-500" : log.status === "failed" ? "bg-red-500" : "bg-gray-400"}`} />
                      <span className="text-muted-foreground">{new Date(log.triggeredAt).toLocaleString()}</span>
                      <span className={`font-medium ${log.status === "sent" ? "text-green-700" : log.status === "failed" ? "text-red-600" : "text-gray-500"}`}>{log.status}</span>
                      {log.recipient && <span className="text-muted-foreground truncate">{log.recipient.replace("@s.whatsapp.net", "")}</span>}
                      {log.executionTime && <span className="ml-auto text-muted-foreground shrink-0">{log.executionTime}ms</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutomationSettingsPage() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery<{ automations: Automation[] }>({
    queryKey: ["automations"],
    queryFn: () => fetch("/api/automations", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: summary } = useQuery<{ running: number; failed: number; enabled: number; todaySent: number; total: number }>({
    queryKey: ["automations-summary"],
    queryFn: () => fetch("/api/automations-summary", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Automation Engine</h2>
          <p className="text-sm text-muted-foreground">Configure and monitor automated WhatsApp alerts and reminders.</p>
        </div>
      </div>

      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-green-700">{summary.enabled}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{summary.running}</div>
            <div className="text-xs text-muted-foreground">Running Now</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3 text-center">
            <div className={`text-2xl font-bold ${summary.failed > 0 ? "text-red-600" : "text-gray-500"}`}>{summary.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{summary.todaySent}</div>
            <div className="text-xs text-muted-foreground">Sent Today</div>
          </CardContent></Card>
        </div>
      )}

      {isLoading && (
        <div className="text-center text-muted-foreground py-10 text-sm">Loading automations…</div>
      )}

      <div className="space-y-3">
        {data?.automations.map((a) => (
          <AutomationCard key={a.type} automation={a} token={token ?? ""} />
        ))}
      </div>
    </div>
  );
}
