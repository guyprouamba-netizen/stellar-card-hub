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
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/sms" element={<SmsAdmin />} />
      <Route path="/transfer" element={<Transfer />} />
      <Route path="/cards" element={<Cards />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/business" element={<Business />} />
      <Route path="/business/:businessId/projects/:projectId" element={<ProjectDetail />} />
      <Route path="/business/:businessId/bot" element={<BotPanel />} />
      <Route path="/business/:businessId/accounting" element={<Accounting />} />
      <Route path="/business/:businessId/contracts" element={<Contracts />} />
      <Route path="/business/:businessId/marketing" element={<Marketing />} />
      <Route path="/pay/:slug" element={<Pay />} />
      <Route path="/shop/:slug" element={<Shop />} />
      <Route path="/order/:token" element={<OrderTracking />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}