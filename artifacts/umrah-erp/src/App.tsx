import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AccessDenied from "@/pages/access-denied";
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
import HotelInvoiceFormPage from "@/pages/hotel-invoice-form";
import HotelInvoicesListPage from "@/pages/hotel-invoices-list";
import UsersPage from "@/pages/users";
import DocumentsPage from "@/pages/documents";
import GdsSettingsPage from "@/pages/gds-settings";
import WhatsAppInboxPage from "@/pages/whatsapp-inbox";
import BotCampaignPage from "@/pages/bot-campaign";
import CurrencySettingsPage from "@/pages/currency-settings";
import WebsiteSettingsPage from "@/pages/website-settings";
import BookingInquiriesPage from "@/pages/booking-inquiries";
import PortalUsersPage from "@/pages/portal-users";
import PendingQuotationsPage from "@/pages/pending-quotations";
import AiSettingsPage from "@/pages/ai-settings";
import GeneralJournalPage from "@/pages/general-journal";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { canAccess } from "@/lib/permissions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({
  component: Component,
  path,
}: {
  component: React.ComponentType<any>;
  path: string;
}) {
  const { isAuthenticated, user } = useAuth();
  return (
    <Route path={path}>
      {(params) => {
        if (!isAuthenticated) return <Redirect to="/login" />;
        if (!user) return <Redirect to="/access-denied" />;
        if (!canAccess(user.role, path)) return <Redirect to="/access-denied" />;
        return <Component {...params} />;
      }}
    </Route>
  );
}

function RoleHome() {
  const { user } = useAuth();
  const role = user?.role;
  if (role === "accounts") return <Redirect to="/accounting/invoices" />;
  if (role === "sales") return <Redirect to="/quotations" />;
  if (role === "operations") return <Redirect to="/quotations" />;
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          <RoleHome />
        </Route>
        <Route path="/login" component={Login} />
        <Route path="/access-denied" component={AccessDenied} />

        <ProtectedRoute path="/dashboard" component={Dashboard} />

        {/* CRM */}
        <ProtectedRoute path="/crm" component={ClientsPage} />
        <ProtectedRoute path="/crm/follow-ups" component={FollowUpsPage} />
        <ProtectedRoute path="/crm/:id" component={ClientDetailPage} />

        {/* Sales */}
        <ProtectedRoute path="/quotations" component={QuotationsPage} />
        <ProtectedRoute path="/quotations/pending" component={PendingQuotationsPage} />
        <ProtectedRoute path="/quotations/:id" component={QuotationDetailPage} />
        <ProtectedRoute path="/hotel-requests" component={HotelRequestsPage} />

        {/* Direct Bookings */}
        <ProtectedRoute path="/booking-inquiries" component={BookingInquiriesPage} />
        <ProtectedRoute path="/portal-users" component={PortalUsersPage} />

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
        <ProtectedRoute path="/accounting/hotel-invoice/new" component={HotelInvoiceFormPage} />
        <ProtectedRoute path="/accounting/hotel-invoice/:id" component={HotelInvoiceFormPage} />
        <ProtectedRoute path="/hotel-invoices" component={HotelInvoicesListPage} />
        <ProtectedRoute path="/general-journal" component={GeneralJournalPage} />

        {/* Messaging */}
        <ProtectedRoute path="/whatsapp-inbox" component={WhatsAppInboxPage} />
        <ProtectedRoute path="/bot-campaign" component={BotCampaignPage} />

        {/* Admin */}
        <ProtectedRoute path="/users" component={UsersPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/gds-settings" component={GdsSettingsPage} />
        <ProtectedRoute path="/currency-settings" component={CurrencySettingsPage} />
        <ProtectedRoute path="/website-settings" component={WebsiteSettingsPage} />
        <ProtectedRoute path="/ai-settings" component={AiSettingsPage} />

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
