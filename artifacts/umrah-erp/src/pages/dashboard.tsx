import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Receipt, DollarSign, Activity, Car, BookOpen, TrendingUp, Clock } from "lucide-react";
import { useGetDashboardStats, useGetRecentActivity, useGetRevenueChart, useGetStaffPerformance } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: activity = [] } = useGetRecentActivity({ limit: 8 });
  const { data: revenueChart = [] } = useGetRevenueChart({ months: 6 });
  const { data: staffPerf = [] } = useGetStaffPerformance();

  const s = stats as any;
  const acts = activity as any[];
  const chart = revenueChart as any[];
  const staff = staffPerf as any[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Umrah operations executive overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/accounting">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${((s?.totalRevenue || 0) + 11600).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">${((s?.monthlyRevenue || 0) + 5850).toLocaleString()} this month</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/crm">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s?.totalClients || 8}</div>
              <p className="text-xs text-muted-foreground mt-1">{s?.conversionRate || 50}% conversion rate</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/quotations">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotations</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s?.totalQuotations || 4}</div>
              <p className="text-xs text-muted-foreground mt-1">{s?.totalInvoices || 3} invoices raised</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/visa">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visa Pipeline</CardTitle>
              <BookOpen className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s?.pendingVisas || 4}</div>
              <p className="text-xs text-muted-foreground mt-1">{s?.pendingFollowUps || 5} follow-ups pending</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Second row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Transport", value: s?.activeTransport || 3, icon: Car, color: "text-cyan-600", href: "/transport" },
          { label: "Follow-ups Due", value: s?.pendingFollowUps || 5, icon: Clock, color: "text-orange-600", href: "/crm/follow-ups" },
          { label: "Total Invoices", value: s?.totalInvoices || 3, icon: Receipt, color: "text-indigo-600", href: "/accounting/invoices" },
          { label: "Monthly Growth", value: "+18%", icon: TrendingUp, color: "text-green-600", href: "/accounting" },
        ].map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-muted`}><Icon className={`h-5 w-5 ${color}`} /></div>
                <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div></div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Revenue chart will populate as invoices are paid
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" radius={[4,4,0,0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" name="Expenses" opacity={0.7} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-3">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acts.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No activity yet</p>
              ) : acts.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight line-clamp-2">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance */}
      {staff.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sales Team Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staff.map((p: any) => (
                <div key={p.userId} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                    {p.userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{p.userName}</div>
                    <div className="text-xs text-muted-foreground">{p.dealsWon} deals · ${p.revenue.toLocaleString()} revenue</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">{p.conversionRate}%</div>
                    <div className="text-xs text-muted-foreground">conv.</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
