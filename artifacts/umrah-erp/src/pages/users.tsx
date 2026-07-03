import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, ShieldCheck, UserCheck, UserX, TicketCheck, KeyRound, Eye, EyeOff } from "lucide-react";

const ROLES = ["management", "sales", "accounts", "operations"];
const ROLE_COLORS: Record<string, string> = {
  management: "bg-purple-100 text-purple-700",
  admin: "bg-purple-100 text-purple-700",
  sales: "bg-blue-100 text-blue-700",
  accounts: "bg-green-100 text-green-700",
  operations: "bg-emerald-100 text-emerald-700",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isManagement = currentUser?.role === "management" || currentUser?.role === "admin";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinUser, setPinUser] = useState<any>(null);
  const [newPin, setNewPin] = useState("");
  const [canIssue, setCanIssue] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set());
  const togglePassword = (id: number) => setRevealedPasswords(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales", phone: "", canIssueTickets: false, ticketingPin: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useListUsers({ role: roleFilter !== "all" ? roleFilter : undefined, search: search || undefined });
  const createUser = useCreateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); setOpen(false); toast({ title: "User created" }); } } });
  const updateUser = useUpdateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated" }); } } });
  const deleteUser = useDeleteUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User deleted" }); } } });

  const openPinDialog = (u: any) => {
    setPinUser(u);
    setNewPin("");
    setCanIssue(u.canIssueTickets || false);
    setPinOpen(true);
  };

  const savePinSettings = () => {
    if (!pinUser) return;
    const updates: any = { canIssueTickets: canIssue };
    if (newPin) updates.ticketingPin = newPin;
    else if (!canIssue) updates.ticketingPin = "";
    updateUser.mutate({ id: pinUser.id, data: updates }, {
      onSuccess: () => { setPinOpen(false); toast({ title: `Ticketing settings updated for ${pinUser.name}` }); },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage staff accounts, roles, and ticketing permissions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {[["name", "Full Name"], ["email", "Email"], ["phone", "Phone"], ["password", "Password"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" type={k === "password" ? "password" : "text"} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Role</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Can Issue Tickets</Label>
                <div className="col-span-3 flex items-center gap-3">
                  <Switch checked={form.canIssueTickets} onCheckedChange={v => setForm(p => ({ ...p, canIssueTickets: v }))} />
                  <span className="text-sm text-muted-foreground">{form.canIssueTickets ? "Authorised to issue tickets" : "Cannot issue tickets"}</span>
                </div>
              </div>
              {form.canIssueTickets && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Ticketing PIN</Label>
                  <Input className="col-span-3" type="password" value={form.ticketingPin} onChange={e => setForm(p => ({ ...p, ticketingPin: e.target.value }))} placeholder="Set a PIN for ticket issuance" maxLength={10} />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createUser.mutate({ data: form as any })} disabled={!form.name || !form.email || createUser.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* PIN Management Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <TicketCheck className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <strong>Ticket Issuance Control</strong> — Only users with a <em>Ticketing PIN</em> and "Can Issue Tickets" enabled can authorise ticket issuance in the Flights module.
          Click <KeyRound className="inline h-3.5 w-3.5" /> on any user to configure their PIN and permission.
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Ticket Issuance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                      <ShieldCheck className="mx-auto h-8 w-8 mb-2" />No users found
                    </TableCell>
                  </TableRow>
                ) : (users as any[]).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>{u.role}</span>
                    </TableCell>
                    <TableCell>
                      {u.isActive
                        ? <span className="flex items-center gap-1 text-green-600 text-sm"><UserCheck className="h-3 w-3" />Active</span>
                        : <span className="flex items-center gap-1 text-red-600 text-sm"><UserX className="h-3 w-3" />Inactive</span>}
                    </TableCell>
                    <TableCell>
                      {isManagement ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">{revealedPasswords.has(u.id) ? (u.password || "—") : "••••••"}</span>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => togglePassword(u.id)}>
                            {revealedPasswords.has(u.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">••••••</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.canIssueTickets ? (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            <TicketCheck className="h-3 w-3 mr-1" />Authorised
                          </Badge>
                          {u.hasTicketingPin && <Badge variant="outline" className="text-xs border-green-400 text-green-700"><KeyRound className="h-2.5 w-2.5 mr-1" />PIN set</Badge>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not authorised</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-7" title="Ticketing PIN & permissions" onClick={() => openPinDialog(u)}>
                          <KeyRound className="h-3 w-3 mr-1" />PIN
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateUser.mutate({ id: u.id, data: { isActive: !u.isActive } })}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteUser.mutate({ id: u.id })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PIN Management Dialog */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Ticketing Permissions — {pinUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <div className="font-medium text-sm">Can Issue Tickets</div>
                <div className="text-xs text-muted-foreground">Allows this user to authorise ticket issuance in Flights</div>
              </div>
              <Switch checked={canIssue} onCheckedChange={setCanIssue} />
            </div>

            {canIssue && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />New Ticketing PIN
                  {pinUser?.hasTicketingPin && <Badge variant="outline" className="text-xs text-green-700 border-green-400">PIN already set</Badge>}
                </Label>
                <Input
                  type="password"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder={pinUser?.hasTicketingPin ? "Leave blank to keep existing PIN" : "Enter a PIN (numbers or letters)"}
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">The PIN will be required every time a ticket is issued. Keep it confidential.</p>
              </div>
            )}

            {!canIssue && pinUser?.canIssueTickets && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                Disabling this will remove the user's ability to issue tickets and clear their PIN.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPinOpen(false)}>Cancel</Button>
            <Button onClick={savePinSettings} disabled={updateUser.isPending}>Save Settings</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
