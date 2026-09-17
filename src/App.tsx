import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import type { LoginResponse } from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import type { ModuleId } from "./components/DashboardLayout";
import ConductoresPage from "./pages/ConductoresPage";
import FlotaPage from "./pages/FlotaPage";
import SociosPage from "./pages/SociosPage";
import NominaPage from "./pages/NominaPage";
import ClientesPage from "./pages/ClientesPage";
import ViajesPage from "./pages/ViajesPage";
import PasajesPage from "./pages/PasajesPage"; // <--- 1. IMPORTAR PASAJESPAGE
import axiosClient from "./api/axiosClient";

export default function App() {
  const [session, setSession] = useState<{
    nombreCompleto: string;
    rol: string;
  } | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleId>("inicio");

  useEffect(() => {
    // Verificar si existe una sesión previa guardada
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.nombreCompleto && parsedUser?.rol) {
          setSession({
            nombreCompleto: parsedUser.nombreCompleto,
            rol: parsedUser.rol,
          });
        }
      }
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoadingCheck(false);
    }
  }, []);

  const handleLoginSuccess = (userSession: LoginResponse) => {
    setSession({
      nombreCompleto: userSession.nombreCompleto,
      rol: userSession.rol,
    });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      /* Opcional */
    }
    setSession(null);
  };

  // Enrutamiento interno para cambiar de módulo según el Sidebar
  const handleNavigate = (href: string) => {
    const routeToModule: Record<string, ModuleId> = {
      "/dashboard": "inicio",
      "/viajes": "viajes",
      "/pasajes": "pasajes",
      "/encomiendas": "encomiendas",
      "/flota": "flota",
      "/conductores": "conductores",
      "/socios": "socios",
      "/clientes": "clientes",
      "/comprobantes": "comprobantes",
      "/nomina": "nomina",
      "/tesoreria": "tesoreria",
      "/liquidaciones": "liquidaciones",
      "/egresos": "egresos",
      "/reportes": "reportes",
      "/predicciones": "predicciones",
      "/configuracion": "configuracion",
    };

    const targetModule = routeToModule[href] || "inicio";
    setActiveModule(targetModule);
  };

  if (loadingCheck) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#062443] text-white">
        <div className="size-8 animate-spin rounded-full border-4 border-[#00A3E0] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  // Renderizado dinámico del contenido según la ruta seleccionada
  const renderModuleContent = () => {
    switch (activeModule) {
      case "flota":
        return (
          <FlotaPage
            onUpdate={async (id, payload, signal) => {
              await axiosClient.put(
                `/Flota/vehiculos/${encodeURIComponent(id)}`,
                payload,
                { signal }
              );
            }}
            onChangeEstado={async (vehicle, estado, signal) => {
              await axiosClient.patch(
                `/Flota/vehiculos/${encodeURIComponent(vehicle.vehiculoId)}/estado`,
                { estado },
                { signal }
              );
            }}
          />
        );

      case "conductores":
        return (
          <ConductoresPage
            onUpdate={async (id, data, signal) => {
              await axiosClient.put(`/Flota/conductores/${id}`, data, { signal });
            }}
            onChangeEstado={async (conductor, estado, signal) => {
              await axiosClient.patch(
                `/Flota/conductores/${conductor.conductorId}/estado`,
                { estado },
                { signal }
              );
            }}
          />
        );

      case "socios":
        return (
          <SociosPage
            onUpdate={async (id, payload, signal) => {
              await axiosClient.put(
                `/Flota/socios/${encodeURIComponent(id)}`,
                payload,
                { signal }
              );
            }}
            onChangeEstado={async (socio, estado, signal) => {
              await axiosClient.patch(
                `/Flota/socios/${encodeURIComponent(socio.socioId)}/estado`,
                { estado },
                { signal }
              );
            }}
          />
        );

      case "nomina":
        return <NominaPage />;

      case "clientes":
        return <ClientesPage />;

      case "viajes":
        return <ViajesPage />;

      case "pasajes": // <--- 2. AGREGAR LA RUTA PARA PASAJES
        return <PasajesPage />;

      case "inicio":
      default:
        // Carga la vista principal del Dashboard (Hero Banner + Cards + Gráfico)
        return null;
    }
  };

  return (
    <DashboardLayout
      activeModule={activeModule}
      user={{
        nombreCompleto: session.nombreCompleto,
        rol: session.rol,
      }}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {renderModuleContent()}
    </DashboardLayout>
  );
}