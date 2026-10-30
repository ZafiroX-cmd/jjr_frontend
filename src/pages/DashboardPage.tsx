import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout, { type DashboardData } from '../components/DashboardLayout';

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardResumen();
  }, []);

  const fetchDashboardResumen = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get('http://localhost:5000/api/dashboard/resumen', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const res = response.data;

      // Adaptación de los datos recibidos del backend
      const mappedData: DashboardData = {
        counts: res.counts || {
          viajes: res.proximosViajes?.length || 0,
          pasajes: res.pasajesVendidosHoy || 0,
          encomiendas: res.encomiendasHoy || 0,
          flota: 8,
        },
        fleet: res.fleet || {
          onRoute: 4,
          inWorkshop: 2,
          outOfService: 1,
        },
        activities: (res.ultimosMovimientos || []).map((m: any) => ({
          id: m.movimientoId,
          type: "pasaje",
          title: m.descripcion,
          description: `Categoría: ${m.categoria} · Usuario: ${m.usuario}`,
          occurredAt: m.fecha,
          status: `S/ ${m.monto.toFixed(2)}`,
        })),
        updatedAt: new Date().toISOString(),
      };

      setDashboardData(mappedData);
    } catch (error) {
      console.error('Error al cargar datos reales del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      data={dashboardData}
      activeModule="inicio"
      onLogout={() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }}
    />
  );
}