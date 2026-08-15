import type { ReactElement } from "react";
import { Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import Cards from "@/pages/Cards";
import Wallet from "@/pages/Wallet";
import Business from "@/pages/Business";
import ProjectDetail from "@/pages/ProjectDetail";
import Pay from "@/pages/Pay";
import Shop from "@/pages/Shop";
import OrderTracking from "@/pages/OrderTracking";
import BotPanel from "@/pages/BotPanel";
import Accounting from "@/pages/Accounting";
import Contracts from "@/pages/Contracts";
import Marketing from "@/pages/Marketing";
import SmsAdmin from "@/pages/SmsAdmin";
import Transfer from "@/pages/Transfer";
import PaypalWithdraw from "@/pages/PaypalWithdraw";
import Vitrine from "@/pages/Vitrine";
import CheckoutPage from "@/pages/Checkout";
import AdminTransfers from "@/pages/AdminTransfers";
import Download from "@/pages/Download";
import NotFound from "@/pages/NotFound";
import { AuthGate } from "@/components/auth-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnalyticsTracker } from "@/components/analytics-tracker";

const guarded = (el: ReactElement, label: string) => (
  <AuthGate><ErrorBoundary label={label}>{el}</ErrorBoundary></AuthGate>
);

export default function App() {
  return (
    <>
      <AnalyticsTracker />
      <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/download" element={<Download />} />
      <Route path="/telecharger" element={<Download />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={guarded(<Dashboard />, "dashboard")} />
      <Route path="/admin" element={guarded(<Admin />, "admin")} />
      <Route path="/admin/sms" element={guarded(<SmsAdmin />, "admin-sms")} />
      <Route path="/admin/transfers" element={guarded(<AdminTransfers />, "admin-transfers")} />
      <Route path="/transfer" element={guarded(<Transfer />, "transfer")} />
      <Route path="/paypal-withdraw" element={guarded(<PaypalWithdraw />, "paypal-withdraw")} />
      <Route path="/cards" element={guarded(<Cards />, "cards")} />
      <Route path="/wallet" element={guarded(<Wallet />, "wallet")} />
      <Route path="/business" element={guarded(<Business />, "business")} />
      <Route path="/business/:businessId/projects/:projectId" element={guarded(<ProjectDetail />, "project")} />
      <Route path="/business/:businessId/bot" element={guarded(<BotPanel />, "bot")} />
      <Route path="/business/:businessId/accounting" element={guarded(<Accounting />, "accounting")} />
      <Route path="/business/:businessId/contracts" element={guarded(<Contracts />, "contracts")} />
      <Route path="/business/:businessId/marketing" element={guarded(<Marketing />, "marketing")} />
      <Route path="/pay/:slug" element={<Pay />} />
      <Route path="/shop/:slug" element={<Shop />} />
      <Route path="/vitrine/:projectId" element={<Vitrine />} />
      <Route path="/checkout/:reference" element={<CheckoutPage />} />
      <Route path="/order/:token" element={<OrderTracking />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}