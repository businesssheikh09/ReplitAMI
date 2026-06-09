import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, ShieldCheck, UserCheck, UserX } from "lucide-react";

const ROLES = ["admin","sales","visa","accounts","support"];
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  sales: "bg-blue-100 text-blue-700",
  visa: "bg-cyan-100 text-cyan-700",
  accounts: "bg-green-100 text-green-700",
  support: "bg-amber-100 text-amber-700",
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "admin123", role: "sales", phone: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useListUsers({ role: roleFilter !== "all" ? roleFilter : undefined, search: search || undefined });
  const createUser = useCreateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); setOpen(false); toast({ title: "User created" }); } } });
  const updateUser = useUpdateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated" }); } } });
  const deleteUser = useDeleteUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User deleted" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage staff accounts and roles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {[["name","Full Name"],["email","Email"],["phone","Phone"],["password","Password"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" type={k === "password" ? "password" : "text"} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Role</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createUser.mutate({ data: form })} disabled={!form.name || !form.email || createUser.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
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
                {ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground"><ShieldCheck className="mx-auto h-8 w-8 mb-2" />No users found</TableCell></TableRow>
                ) : (users as any[]).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>{u.role}</span>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm"><UserCheck className="h-3 w-3" />Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm"><UserX className="h-3 w-3" />Inactive</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
    </div>
  );
}
