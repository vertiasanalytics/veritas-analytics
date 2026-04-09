import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import { UserDashboard } from "@/pages/dashboard";

export default function ConvenioPainel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && user.role !== "convenio") navigate("/");
    if (!user) navigate("/login");
    if (user?.primeiroAcessoPendente || user?.redefinirSenhaObrigatoria) {
      navigate("/convenio/primeiro-acesso");
    }
  }, [user, navigate]);

  if (!user || user.role !== "convenio") return null;

  return <UserDashboard />;
}
