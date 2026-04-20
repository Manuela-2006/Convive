export type TicketScannerType = "ticket" | "factura" | "desconocido";

export type TicketScannerCategory =
  | "luz"
  | "agua"
  | "wifi"
  | "gas"
  | "alquiler"
  | "otro";

export type TicketScannerItem = {
  nombre: string;
  precio: number;
};

export type TicketScannerData = {
  tipo: TicketScannerType;
  comercio?: string | null;
  fecha?: string | null;
  importe_total?: number | null;
  articulos?: TicketScannerItem[];
  categoria?: TicketScannerCategory | null;
  periodo?: string | null;
  imagen_url?: string | null;
};

export const SCANNER_ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
