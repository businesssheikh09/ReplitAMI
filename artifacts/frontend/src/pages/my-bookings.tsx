import { useEffect } from "react";
import { useLocation } from "wouter";

export default function MyBookingsPage() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/portal/bookings", { replace: true }); }, []);
  return null;
}
