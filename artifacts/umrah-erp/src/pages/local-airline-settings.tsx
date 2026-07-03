import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plane, CheckCircle2, XCircle, Settings2, FlaskConical, Power } from "lucide-react";

interface AirlineSetting {
  id: number;
  code: string;
  name: string;
  status: string;
  environment: string;
  credentials?: string | null;
  notes: string | null;
  isEnabled: boolean;
  testedAt: string | null;
  testResult: string | null;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  coming_soon: "bg-gray-100 text-gray-600",
  testing: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  disabled: "bg-red-100 text-red-700",
};

export default function LocalAirlineSettingsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [editDialog, setEditDialog] = useState<AirlineSetting | null>(null);
  const [form, setForm] = useState({ status: "", environment: "", notes: "", credentials: "" });

  const { data: airlines = [], isLoading } = useQuery<AirlineSetting[]>({
    queryKey: ["local-airline-settings"],
    queryFn: () => fetch("/api/local-airline-settings", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const patchMut = useMutation({
    mutationFn: ({ code, body }: { code: string; body: object }) =>
      fetch(`/api/local-airline-settings/${code}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-airline-settings"] });
      toast({ title: "Settings saved" });
      setEditDialog(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: (code: string) =>
      fetch(`/api/local-airline-settings/${code}/test`, { method: "POST", headers })
        .then(async (r) => { const j = await r.json(); return j; }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["local-airline-settings"] });
      toast({ title: data.ok ? "Connection OK" : "Test complete", description: data.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      fetch(`/api/local-airline-settings/${code}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: enabled }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["local-airline-settings"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(a: AirlineSetting) {
    setEditDialog(a);
    setForm({
      status: a.status,
      environment: a.environment,
      notes: a.notes ?? "",
      credentials: "",
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Local Airline Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure direct airline connections. Completely isolated from GDS. API integration is coming soon — infrastructure only.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Infrastructure Only:</strong> Direct airline API connections are not yet implemented. You can configure credentials and settings in preparation — test connection will return a stub response.
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading airlines…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {airlines.map((a) => (
            <Card key={a.code} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <span className="text-xs text-muted-foreground font-mono">{a.code}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.environment}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.notes && (
                  <p className="text-xs text-muted-foreground italic">{a.notes}</p>
                )}
                {a.testResult && (
                  <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                    Last test: {a.testResult}
                    {a.testedAt && <span className="ml-1 opacity-60">({new Date(a.testedAt).toLocaleDateString()})</span>}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Settings2 className="h-3 w-3 mr-1" /> Configure
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => testMut.mutate(a.code)}
                    disabled={testMut.isPending}>
                    <FlaskConical className="h-3 w-3 mr-1" /> Test
                  </Button>
                  <Button size="sm" variant="outline"
                    className={a.isEnabled ? "text-rose-600" : "text-green-700"}
                    onClick={() => toggleMut.mutate({ code: a.code, enabled: !a.isEnabled })}
                    disabled={toggleMut.isPending}>
                    <Power className="h-3 w-3 mr-1" />
                    {a.isEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure — {editDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="coming_soon">Coming Soon</option>
                <option value="testing">Testing</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <Label>Environment</Label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.environment}
                onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
              >
                <option value="test">Test</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <Label>API Credentials (JSON)</Label>
              <Textarea
                value={form.credentials}
                onChange={(e) => setForm((f) => ({ ...f, credentials: e.target.value }))}
                placeholder={'{\n  "username": "",\n  "password": "",\n  "agencyCode": ""\n}'}
                className="mt-1 font-mono text-xs"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">Stored securely. Leave blank to keep existing credentials.</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Waiting for API approval, contact details…"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                const body: Record<string, unknown> = { status: form.status, environment: form.environment, notes: form.notes };
                if (form.credentials.trim()) body.credentials = form.credentials.trim();
                patchMut.mutate({ code: editDialog!.code, body });
              }}
              disabled={patchMut.isPending}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
