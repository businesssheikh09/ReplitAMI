import { useParams, Link } from "wouter";
import { useGetClient, useUpdateClient, useCreateClientNote, useCreateFollowUp } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-cyan-100 text-cyan-700",
  proposal: "bg-purple-100 text-purple-700",
  negotiation: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [followUpForm, setFollowUpForm] = useState({ dueDate: "", type: "call", notes: "" });

  const { data: client, isLoading } = useGetClient(Number(id));
  const updateClient = useUpdateClient({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients", Number(id)] }); toast({ title: "Status updated" }); } } });
  const createNote = useCreateClientNote({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients", Number(id)] }); setNewNote(""); toast({ title: "Note added" }); } } });
  const createFollowUp = useCreateFollowUp({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients", Number(id)] }); setFollowUpForm({ dueDate: "", type: "call", notes: "" }); toast({ title: "Follow-up scheduled" }); } } });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!client) return <div className="p-6 text-muted-foreground">Client not found.</div>;

  const c = client as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/crm"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{c.name}</h2>
          <p className="text-muted-foreground">{c.country} {c.city ? `· ${c.city}` : ""}</p>
        </div>
        <Select value={c.leadStatus} onValueChange={v => updateClient.mutate({ id: Number(id), data: { leadStatus: v } })}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["new","contacted","qualified","proposal","negotiation","won","lost"].map(s => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{c.email}</div>
            <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{c.phone}</div>
            {c.whatsapp && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-green-500" />WhatsApp: {c.whatsapp}</div>}
            <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{c.country}{c.city ? `, ${c.city}` : ""}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 gap-4 text-center">
            <div><div className="text-2xl font-bold text-blue-600">{c.totalBookings || 0}</div><div className="text-xs text-muted-foreground">Quotations</div></div>
            <div><div className="text-2xl font-bold text-green-600">${(c.totalRevenue || 0).toLocaleString()}</div><div className="text-xs text-muted-foreground">Total Revenue</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium mb-1">Lead Status</div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[c.leadStatus] || "bg-gray-100"}`}>
              {c.leadStatus}
            </span>
            {c.assignedToName && <div className="mt-3 text-sm text-muted-foreground">Assigned to: {c.assignedToName}</div>}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes ({c.notes?.length || 0})</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups ({c.followUps?.length || 0})</TabsTrigger>
          <TabsTrigger value="quotations">Quotations ({c.quotations?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Textarea placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} />
              <Button onClick={() => createNote.mutate({ id: Number(id), data: { content: newNote, createdBy: 1 } })} disabled={!newNote || createNote.isPending}>Add Note</Button>
            </CardContent>
          </Card>
          {(c.notes || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No notes yet.</p>
          ) : (c.notes || []).map((n: any) => (
            <Card key={n.id}>
              <CardContent className="pt-4">
                <p className="text-sm">{n.content}</p>
                <p className="text-xs text-muted-foreground mt-1">By {n.createdByName} · {new Date(n.createdAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="followups" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Schedule Follow-up</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="datetime-local" value={followUpForm.dueDate} onChange={e => setFollowUpForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={followUpForm.type} onValueChange={v => setFollowUpForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["call","email","whatsapp","meeting"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={followUpForm.notes} onChange={e => setFollowUpForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
              <Button className="col-span-3" onClick={() => createFollowUp.mutate({ id: Number(id), data: { ...followUpForm, assignedTo: 1 } })} disabled={!followUpForm.dueDate || createFollowUp.isPending}>Schedule</Button>
            </CardContent>
          </Card>
          {(c.followUps || []).map((f: any) => (
            <Card key={f.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{f.type.charAt(0).toUpperCase()+f.type.slice(1)} follow-up</div>
                  {f.notes && <div className="text-xs text-muted-foreground">{f.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{new Date(f.dueDate).toLocaleDateString()}</div>
                  <Badge variant="outline" className="text-xs">{f.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="quotations" className="space-y-3 mt-4">
          {(c.quotations || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No quotations yet.</p>
          ) : (c.quotations || []).map((q: any) => (
            <Link key={q.id} href={`/quotations/${q.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{q.referenceNo}</div>
                    <div className="text-sm text-muted-foreground">{q.title || "Untitled"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{q.currency} {q.totalAmount?.toLocaleString()}</div>
                    <Badge variant="outline" className="text-xs">{q.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
