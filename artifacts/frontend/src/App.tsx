import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/landing";
import AdminRedirect from "@/pages/admin";
import NotFound from "@/pages/not-found";
import BookFlightPage from "@/pages/book-flight";
import BookGdsPage from "@/pages/book-gds";
import PackageDetailPage from "@/pages/package-detail";
import PortalLoginPage from "@/pages/portal-login";
import PortalRegisterPage from "@/pages/portal-register";
import MyBookingsPage from "@/pages/my-bookings";
import FlightsPage from "@/pages/flights";
import PortalDashboardPage from "@/pages/portal/dashboard";
import PortalBookingsPage from "@/pages/portal/bookings";
import PortalInvoicesPage from "@/pages/portal/invoices";
import PortalStatementPage from "@/pages/portal/statement";
import PortalHotelVouchersPage from "@/pages/portal/hotel-vouchers";
import PortalFlightTicketsPage from "@/pages/portal/flight-tickets";
import PortalVisaPage from "@/pages/portal/visa";
import PortalTransportPage from "@/pages/portal/transport";
import PortalPaymentsPage from "@/pages/portal/payments";
import PortalProfilePage from "@/pages/portal/profile";
import PortalDownloadsPage from "@/pages/portal/downloads";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/admin" component={AdminRedirect} />
      <Route path="/book-flight/:id" component={BookFlightPage} />
      <Route path="/book-gds" component={BookGdsPage} />
      <Route path="/packages/:id" component={PackageDetailPage} />
      <Route path="/portal-login" component={PortalLoginPage} />
      <Route path="/portal-register" component={PortalRegisterPage} />
      <Route path="/my-bookings" component={MyBookingsPage} />
      <Route path="/flights" component={FlightsPage} />
      <Route path="/portal" component={PortalDashboardPage} />
      <Route path="/portal/bookings" component={PortalBookingsPage} />
      <Route path="/portal/invoices" component={PortalInvoicesPage} />
      <Route path="/portal/statement" component={PortalStatementPage} />
      <Route path="/portal/hotel-vouchers" component={PortalHotelVouchersPage} />
      <Route path="/portal/flight-tickets" component={PortalFlightTicketsPage} />
      <Route path="/portal/visa" component={PortalVisaPage} />
      <Route path="/portal/transport" component={PortalTransportPage} />
      <Route path="/portal/payments" component={PortalPaymentsPage} />
      <Route path="/portal/profile" component={PortalProfilePage} />
      <Route path="/portal/downloads" component={PortalDownloadsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
