import { useState } from "react";
import { Link } from "wouter";
import { useListAllFollowups } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MessageCircle, Calendar } from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Calendar,
};

const TYPE_COLORS: Record<string, string> = {
  call: "bg-blue-100 text-blue-700",
  email: "bg-purple-100 text-purple-700",
  whatsapp: "bg-green-100 text-green-700",
  meeting: "bg-amber-100 text-amber-700",
};

export default function FollowUpsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: followUps = [], isLoading } = useListAllFollowups({});
  const fus = followUps as any[];

  const filtered = statusFilter === "all" ? fus : fus.filter(f => f.status === statusFilter);
  const overdue = fus.filter(f => f.status === "pending" && new Date(f.dueDate) < new Date());
  const today = fus.filter(f => {
    const d = new Date(f.dueDate);
    const now = new Date();
    return d.toDateString() === now.toDateString() && f.status === "pending";
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Follow-ups</h2>
        <p className="text-muted-foreground">All scheduled client follow-ups across the team.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6"><div className="text-xs text-red-600 font-medium">Overdue</div><div className="text-2xl font-bold text-red-600">{overdue.length}</div></CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6"><div className="text-xs text-amber-600 font-medium">Due Today</div><div className="text-2xl font-bold text-amber-600">{today.length}</div></CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6"><div className="text-xs text-muted-foreground font-medium">Total Pending</div><div className="text-2xl font-bold">{fus.filter(f => f.status === "pending").length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Follow-ups</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center h-32 flex items-center justify-center text-muted-foreground">No follow-ups found</div>
              ) : filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((f: any) => {
                const TypeIcon = TYPE_ICONS[f.type] || Calendar;
                const isOverdue = f.status === "pending" && new Date(f.dueDate) < new Date();
                return (
                  <div key={f.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50" : "border-border"}`}>
                    <div className={`p-2 rounded-full ${TYPE_COLORS[f.type] || "bg-gray-100"}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/crm/${f.clientId}`}>
                          <span className="font-medium hover:underline cursor-pointer">{f.clientName}</span>
                        </Link>
                        <Badge variant="outline" className="text-xs">{f.type}</Badge>
                        {isOverdue && <Badge className="text-xs bg-red-100 text-red-700">Overdue</Badge>}
                      </div>
                      {f.notes && <div className="text-xs text-muted-foreground mt-0.5">{f.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{new Date(f.dueDate).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">{new Date(f.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
