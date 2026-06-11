import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import FollowUpsPage from "@/pages/follow-ups";
import QuotationsPage from "@/pages/quotations";
import QuotationDetailPage from "@/pages/quotation-detail";
import HotelRequestsPage from "@/pages/hotel-requests";
import HotelsPage from "@/pages/hotels";
import VendorsPage from "@/pages/vendors";
import TransportPage from "@/pages/transport";
import FlightsPage from "@/pages/flights";
import VisaPage from "@/pages/visa";
import AccountingPage from "@/pages/accounting";
import UsersPage from "@/pages/users";
import DocumentsPage from "@/pages/documents";
import GdsSettingsPage from "@/pages/gds-settings";
import CurrencySettingsPage from "@/pages/currency-settings";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import { WhatsAppButton } from "@/components/whatsapp-button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>; path: string }) {
  const { isAuthenticated } = useAuth();
  return (
    <Route path={path}>
      {(params) => isAuthenticated ? <Component {...params} /> : <Redirect to="/login" />}
    </Route>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/login" component={Login} />

        <ProtectedRoute path="/dashboard" component={Dashboard} />

        {/* CRM */}
        <ProtectedRoute path="/crm" component={ClientsPage} />
        <ProtectedRoute path="/crm/follow-ups" component={FollowUpsPage} />
        <ProtectedRoute path="/crm/:id" component={ClientDetailPage} />

        {/* Sales */}
        <ProtectedRoute path="/quotations" component={QuotationsPage} />
        <ProtectedRoute path="/quotations/:id" component={QuotationDetailPage} />
        <ProtectedRoute path="/hotel-requests" component={HotelRequestsPage} />

        {/* Operations */}
        <ProtectedRoute path="/hotels" component={HotelsPage} />
        <ProtectedRoute path="/vendors" component={VendorsPage} />
        <ProtectedRoute path="/transport" component={TransportPage} />
        <ProtectedRoute path="/flights" component={FlightsPage} />
        <ProtectedRoute path="/visa" component={VisaPage} />

        {/* Finance */}
        <ProtectedRoute path="/accounting" component={AccountingPage} />
        <ProtectedRoute path="/accounting/invoices" component={AccountingPage} />
        <ProtectedRoute path="/accounting/expenses" component={AccountingPage} />

        {/* Admin */}
        <ProtectedRoute path="/users" component={UsersPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/gds-settings" component={GdsSettingsPage} />
        <ProtectedRoute path="/currency-settings" component={CurrencySettingsPage} />

        <Route component={NotFound} />
      </Switch>
      <WhatsAppButton />
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
