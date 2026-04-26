"use client";

import { useCallback, useState } from "react";

type CategoriaComparador = "luz" | "agua" | "wifi";

type ComparadorData = {
  categoria: string;
  proveedor_actual: {
    nombre: string;
    importe_mensual: number;
    valoracion: string;
  };
  alternativas: {
    nombre: string;
    importe_estimado: number;
    ahorro_mensual: number;
    ahorro_anual: number;
    ventajas: string;
    url_referencia: string;
  }[];
  recomendacion: string;
  nota_legal: string;
};

export function useComparador(pisoId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparadorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comparar = useCallback(
    async (categoria: CategoriaComparador) => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch("/api/comparar-gastos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pisoId, categoria }),
        });

        const payload = (await res.json()) as {
          success: boolean;
          data?: ComparadorData;
          error?: string;
        };

        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "No se pudo generar la comparativa");
        }

        setData(payload.data ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [pisoId]
  );

  return { loading, data, error, comparar };
}
