import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CalendarRange, Plus, Lock, BookOpen } from "lucide-react";
import { Link } from "wouter";

interface FinancialYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
  createdAt: string;
}

export default function FinancialYearsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  const headers = { Authorization: `Bearer ${token}` };

  const { data: years = [], isLoading } = useQuery<FinancialYear[]>({
    queryKey: ["financial-years"],
    queryFn: () => fetch("/api/accounting/financial-years", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/accounting/financial-years", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-years"] });
      toast({ title: "Financial year created" });
      setOpen(false);
      setForm({ name: "", startDate: "", endDate: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/accounting/financial-years/${id}/close`, {
        method: "POST",
        headers,
      }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["financial-years"] });
      const s = data.summary;
      toast({
        title: "Financial year closed",
        description: `Revenue: ${s.totalRevenue.toFixed(2)} | Expenses: ${s.totalExpenses?.toFixed(2) ?? "0.00"} | Net: ${s.netProfit.toFixed(2)}`,
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suggestName = () => {
    if (form.startDate && form.endDate) {
      const sy = form.startDate.slice(0, 4);
      const ey = form.endDate.slice(0, 4);
      return sy === ey ? `FY ${sy}` : `FY ${sy}-${ey.slice(2)}`;
    }
    return "";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6" /> Financial Years
          </h1>
          <p className="text-sm text-muted-foreground">Manage accounting periods and year-end closing</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Year</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Year</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => {
                  const sd = e.target.value;
                  setForm((f) => ({ ...f, startDate: sd, name: f.name || "" }));
                }} className="mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => {
                  const ed = e.target.value;
                  setForm((f) => ({ ...f, endDate: ed, name: f.name || "" }));
                }} className="mt-1" />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={suggestName() || "e.g. FY 2024-25"}
                  className="mt-1"
                />
                {suggestName() && !form.name && (
                  <button
                    type="button"
                    className="text-xs text-blue-500 mt-1 underline"
                    onClick={() => setForm((f) => ({ ...f, name: suggestName() }))}
                  >
                    Use "{suggestName()}"
                  </button>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!form.name || !form.startDate || !form.endDate || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? "Creating…" : "Create Financial Year"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closed At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : years.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No financial years yet — create one to start</TableCell></TableRow>
              ) : (
                years.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-semibold">{y.name}</TableCell>
                    <TableCell>{y.startDate}</TableCell>
                    <TableCell>{y.endDate}</TableCell>
                    <TableCell>
                      <Badge className={y.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {y.status === "open" ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {y.closedAt ? new Date(y.closedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/accounting/financial-years/${y.id}/opening-balances`}>
                          <Button variant="outline" size="sm">
                            <BookOpen className="h-3.5 w-3.5 mr-1" /> Opening Balances
                          </Button>
                        </Link>
                        {y.status === "open" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Lock className="h-3.5 w-3.5 mr-1" /> Close Year
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Close Financial Year?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will post the year-end closing entry and lock <strong>{y.name}</strong>. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => closeMutation.mutate(y.id)}
                                >
                                  {closeMutation.isPending ? "Closing…" : "Close Year"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
