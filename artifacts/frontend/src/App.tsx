import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/landing";
import AdminRedirect from "@/pages/admin";
import NotFound from "@/pages/not-found";
import BookFlightPage from "@/pages/book-flight";
import PackageDetailPage from "@/pages/package-detail";
import PortalLoginPage from "@/pages/portal-login";
import PortalRegisterPage from "@/pages/portal-register";
import MyBookingsPage from "@/pages/my-bookings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/admin" component={AdminRedirect} />
      <Route path="/book-flight/:id" component={BookFlightPage} />
      <Route path="/packages/:id" component={PackageDetailPage} />
      <Route path="/portal-login" component={PortalLoginPage} />
      <Route path="/portal-register" component={PortalRegisterPage} />
      <Route path="/my-bookings" component={MyBookingsPage} />
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
