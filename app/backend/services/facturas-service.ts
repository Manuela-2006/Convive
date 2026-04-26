import { createClient } from "../endpoints/shared/supabase-server";
import { loadHouseInvoiceHistoryWithClient } from "../endpoints/shared/dashboard-core";

export type FacturaEscenario = {
  tipo: string;
  categoria: string;
  importe_total: number;
  periodo: string | null;
  comercio: string | null;
  created_at: string | null;
};

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveComparadorCategoria(rawCategoria: string | null | undefined) {
  const categoria = normalizeText(rawCategoria);

  if (!categoria) {
    return "otro" as const;
  }

  if (
    categoria === "luz" ||
    categoria === "electricity" ||
    categoria === "electricidad" ||
    categoria === "power" ||
    categoria.includes("luz") ||
    categoria.includes("elect")
  ) {
    return "luz" as const;
  }

  if (
    categoria === "agua" ||
    categoria === "water" ||
    categoria.includes("agua")
  ) {
    return "agua" as const;
  }

  if (
    categoria === "wifi" ||
    categoria === "internet" ||
    categoria.includes("wifi") ||
    categoria.includes("internet")
  ) {
    return "wifi" as const;
  }

  return "otro" as const;
}

export async function getFacturasActivasByPiso(
  houseCode: string
): Promise<FacturaEscenario[]> {
  const supabase = await createClient();
  const invoices = await loadHouseInvoiceHistoryWithClient(supabase, houseCode, 200, 0);

  return invoices.map((invoice) => ({
    tipo: "factura",
    categoria: invoice.category_slug || "otro",
    importe_total: asNumber(invoice.total_amount),
    periodo: invoice.invoice_date ?? null,
    comercio: invoice.title || null,
    created_at: invoice.invoice_date ?? null,
  }));
}

export async function getFacturasByCategoria(
  houseCode: string,
  categoria: "luz" | "agua" | "wifi"
): Promise<FacturaEscenario[]> {
  const facturas = await getFacturasActivasByPiso(houseCode);
  return facturas
    .filter((item) => resolveComparadorCategoria(item.categoria) === categoria)
    .slice(0, 6);
}
