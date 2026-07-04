import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Download, FileText, Hotel, Plane, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function PortalDownloadsPage() {
  const { token } = usePortalAuth();

  const { data: invoicesData } = useQuery<{ invoices: any[] }>({
    queryKey: ["portal-invoices"],
    queryFn: () => fetch("/api/portal/invoices", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: vouchersData } = useQuery<{ vouchers: any[] }>({
    queryKey: ["portal-hotel-vouchers"],
    queryFn: () => fetch("/api/portal/hotel-vouchers", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: ticketsData } = useQuery<{ tickets: any[] }>({
    queryKey: ["portal-flight-tickets"],
    queryFn: () => fetch("/api/portal/flight-tickets", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: stmtData } = useQuery<{ entries: any[]; closingBalance: string }>({
    queryKey: ["portal-statement"],
    queryFn: () => fetch("/api/portal/statement", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const sections = [
    {
      title: "Invoices",
      icon: FileText,
      href: "/portal/invoices",
      count: invoicesData?.invoices?.length ?? 0,
      color: "bg-blue-50 border-blue-200 text-blue-700",
    },
    {
      title: "Hotel Vouchers",
      icon: Hotel,
      href: "/portal/hotel-vouchers",
      count: vouchersData?.vouchers?.length ?? 0,
      color: "bg-teal-50 border-teal-200 text-teal-700",
    },
    {
      title: "Flight Tickets",
      icon: Plane,
      href: "/portal/flight-tickets",
      count: ticketsData?.tickets?.length ?? 0,
      color: "bg-indigo-50 border-indigo-200 text-indigo-700",
    },
    {
      title: "Account Statement",
      icon: BookOpen,
      href: "/portal/statement",
      count: stmtData?.entries?.length ?? 0,
      color: "bg-violet-50 border-violet-200 text-violet-700",
    },
  ];

  return (
    <PortalLayout>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Download Centre</h1>
          <p className="text-sm text-gray-500">Access and print all your documents in one place</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map(({ title, icon: Icon, href, count, color }) => (
            <Link key={href} href={href}>
              <div className={`rounded-xl border p-5 cursor-pointer hover:shadow-sm transition-shadow ${color}`}>
                <div className="flex items-start justify-between">
                  <Icon className="h-6 w-6" />
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <h3 className="font-bold text-base mt-3">{title}</h3>
                <p className="text-xs mt-0.5 opacity-70">Click to view and print</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">How to Download</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Click on a section above to open the document list</li>
            <li>Click the <span className="font-medium">Print</span> button on any document</li>
            <li>In your browser's print dialog, choose <span className="font-medium">Save as PDF</span> to download</li>
          </ol>
        </div>
      </div>
    </PortalLayout>
  );
}
