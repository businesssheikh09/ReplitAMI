import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  if (location === "/login") return null;

  const departments = [
    { name: "Sales", phone: "1234567890", message: "Hi, I need help with sales." },
    { name: "Support", phone: "1234567891", message: "Hi, I need technical support." },
    { name: "Visa", phone: "1234567892", message: "Hi, I need help with my visa application." },
    { name: "Accounts", phone: "1234567893", message: "Hi, I have a billing question." },
    { name: "Emergency", phone: "1234567894", message: "URGENT: I need immediate assistance." },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <Card className="mb-4 w-72 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Support</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {departments.map((dept) => (
              <a
                key={dept.name}
                href={`https://wa.me/${dept.phone}?text=${encodeURIComponent(dept.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors text-sm"
              >
                <MessageCircle className="h-4 w-4 text-green-500" />
                {dept.name}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
