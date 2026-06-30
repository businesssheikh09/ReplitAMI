import { useState } from "react";
import { useListVisaApplications, useCreateVisaApplication, useUpdateVisaApplication, useListClients, VisaApplicationUpdateStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen } from "lucide-react";

const STATUS_FLOW: Record<string, string> = {
  documents_required: "bg-amber-100 text-amber-700",
  documents_received: "bg-blue-100 text-blue-700",
  submitted: "bg-purple-100 text-purple-700",
  approved: "bg-cyan-100 text-cyan-700",
  issued: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_NEXT: Record<string, string | null> = {
  documents_required: "documents_received",
  documents_received: "submitted",
  submitted: "approved",
  approved: "issued",
  issued: null,
  rejected: null,
};

const STATUS_LABELS: Record<string, string> = {
  documents_required: "Docs Required",
  documents_received: "Docs Received",
  submitted: "Submitted",
  approved: "Approved",
  issued: "Issued",
  rejected: "Rejected",
};

export default function VisaPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", passportNumber: "", nationality: "", passportExpiry: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useListVisaApplications({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createVisa = useCreateVisaApplication({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/visa-applications"] }); setOpen(false); toast({ title: "Application created" }); } } });
  const updateVisa = useUpdateVisaApplication({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/visa-applications"] }); toast({ title: "Status updated" }); } } });

  const stats = {
    total: (applications as any[]).length,
    pending: (applications as any[]).filter((a: any) => ["documents_required","documents_received","submitted"].includes(a.status)).length,
    approved: (applications as any[]).filter((a: any) => a.status === "approved" || a.status === "issued").length,
    rejected: (applications as any[]).filter((a: any) => a.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Visa Processing</h2>
          <p className="text-muted-foreground">Track Umrah visa applications through the workflow.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Application</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Visa Application</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {[["passportNumber","Passport Number"],["nationality","Nationality"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Passport Expiry</Label>
                <Input type="date" className="col-span-3" value={form.passportExpiry} onChange={e => setForm(p => ({ ...p, passportExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createVisa.mutate({ data: { ...form, clientId: Number(form.clientId) } })} disabled={!form.clientId || !form.passportNumber || !form.nationality || createVisa.isPending}>Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700" },
          { label: "In Progress", value: stats.pending, color: "text-amber-600" },
          { label: "Approved/Issued", value: stats.approved, color: "text-green-600" },
          { label: "Rejected", value: stats.rejected, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{s.label}</div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Passport</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(applications as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground"><BookOpen className="mx-auto h-8 w-8 mb-2" />No visa applications</TableCell></TableRow>
                ) : (applications as any[]).map((a: any) => {
                  const next = STATUS_NEXT[a.status];
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.clientName}</TableCell>
                      <TableCell className="font-mono text-sm">{a.passportNumber}</TableCell>
                      <TableCell>{a.nationality}</TableCell>
                      <TableCell className="text-sm">{a.passportExpiry ? new Date(a.passportExpiry).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_FLOW[a.status] || "bg-gray-100"}`}>{STATUS_LABELS[a.status]}</span>
                      </TableCell>
                      <TableCell>
                        {next && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateVisa.mutate({ id: a.id, data: { status: next as VisaApplicationUpdateStatus } })}>
                            → {STATUS_LABELS[next]}
                          </Button>
                        )}
                        {a.status !== "rejected" && a.status !== "issued" && (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500 ml-1" onClick={() => updateVisa.mutate({ id: a.id, data: { status: VisaApplicationUpdateStatus.rejected } })}>Reject</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
