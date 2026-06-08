import { Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import Cards from "@/pages/Cards";
import Wallet from "@/pages/Wallet";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/cards" element={<Cards />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}