"use server";

import { getAuthenticatedProfileContext } from "../auth/queries";
import type { ActionResult } from "../shared/action-result";
import { toActionError } from "../shared/action-result";
import {
  buildInvoiceDocumentPath,
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENTS_BUCKET,
  validateDocumentUploadPayload,
} from "../shared/document-storage";
import type { DocumentUploadPayload } from "../../../../lib/document-upload-types";
import { revalidatePaths } from "../shared/revalidate";

type CreatePendingInvoiceExpenseInput = {
  houseCode: string;
  dashboardPath: string;
  title: string;
  invoiceDate: string;
  totalAmount: number;
  participantProfileIds: string[];
  invoiceCategoryId: string | null;
  customCategoryName: string | null;
  notes: string | null;
  paidByProfileId: string | null;
  invoiceFilePath: string | null;
  document?: DocumentUploadPayload | null;
};

type AdminMarkInvoicePaidInput = {
  houseCode: string;
  dashboardPath: string;
  expenseId: string;
};

type ViewInvoiceDocumentInput = {
  houseCode: string;
  expenseId: string;
};

function revalidateInvoicePaths(dashboardPath: string) {
  revalidatePaths([
    dashboardPath,
    `${dashboardPath}/facturas`,
    `${dashboardPath}/facturas/anadir-factura`,
    `${dashboardPath}/facturas/alquiler`,
    `${dashboardPath}/facturas/suscripciones`,
    `${dashboardPath}/facturas/wifi`,
    `${dashboardPath}/facturas/agua`,
    `${dashboardPath}/facturas/luz`,
  ]);
}

export async function createPendingInvoiceExpenseAction(
  input: CreatePendingInvoiceExpenseInput
): Promise<ActionResult<{ expenseId: string }>> {
  let uploadedPath: string | null = null;

  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const houseContextResult = await supabase.rpc("get_accessible_house_context", {
      p_user_hash_id: profile.user_hash_id,
      p_house_public_code: input.houseCode,
    });
    const houseId = readHouseId(houseContextResult.data);

    if (houseContextResult.error || !houseId) {
      return {
        success: false,
        error: houseContextResult.error?.message ?? "No se pudo validar el piso.",
      };
    }

    const expenseId = crypto.randomUUID();
    let invoiceFilePath = input.invoiceFilePath;

    if (input.document) {
      const { buffer, extension } = validateDocumentUploadPayload(input.document);
      invoiceFilePath = buildInvoiceDocumentPath({
        houseId,
        expenseId,
        extension,
      });

      const uploadResult = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(invoiceFilePath, buffer, {
          contentType: input.document.mediaType,
          upsert: false,
        });

      if (uploadResult.error) {
        return { success: false, error: uploadResult.error.message };
      }

      uploadedPath = invoiceFilePath;
    }

    const { data, error } = await supabase.rpc("create_pending_invoice_expense", {
      p_house_public_code: input.houseCode,
      p_expense_id: expenseId,
      p_title: input.title.trim(),
      p_invoice_date: input.invoiceDate,
      p_total_amount: input.totalAmount,
      p_participant_profile_ids: input.participantProfileIds,
      p_invoice_category_id: input.invoiceCategoryId,
      p_custom_category_name: input.customCategoryName?.trim()
        ? input.customCategoryName.trim()
        : null,
      p_notes: input.notes?.trim() ? input.notes.trim() : null,
      p_paid_by_profile_id: input.paidByProfileId,
      p_invoice_file_path: invoiceFilePath,
    });

    if (error) {
      if (uploadedPath) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadedPath]);
      }
      return { success: false, error: error.message };
    }

    uploadedPath = null;
    revalidateInvoicePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        expenseId:
          typeof data?.expense_id === "string"
            ? data.expense_id
            : String(data?.expense_id ?? ""),
      },
    };
  } catch (error) {
    if (uploadedPath) {
      try {
        const { supabase } = await getAuthenticatedProfileContext();
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadedPath]);
      } catch {
        // The original error is more useful to the caller.
      }
    }
    return { success: false, error: toActionError(error) };
  }
}

export async function getInvoiceDocumentSignedUrlAction(
  input: ViewInvoiceDocumentInput
): Promise<ActionResult<{ signedUrl: string }>> {
  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const houseContextResult = await supabase.rpc("get_accessible_house_context", {
      p_user_hash_id: profile.user_hash_id,
      p_house_public_code: input.houseCode,
    });
    const houseId = readHouseId(houseContextResult.data);

    if (houseContextResult.error || !houseId) {
      return {
        success: false,
        error: houseContextResult.error?.message ?? "No se pudo validar el piso.",
      };
    }

    const { data, error } = await supabase
      .from("shared_expenses")
      .select("house_id,expense_type,invoice_file_path")
      .eq("id", input.expenseId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    const invoice = data as
      | {
          house_id?: string | null;
          expense_type?: string | null;
          invoice_file_path?: string | null;
        }
      | null;
    if (
      !invoice ||
      invoice.house_id !== houseId ||
      invoice.expense_type !== "invoice" ||
      !invoice.invoice_file_path
    ) {
      return { success: false, error: "Factura no encontrada o sin imagen." };
    }

    const signedResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(invoice.invoice_file_path, DOCUMENT_SIGNED_URL_TTL_SECONDS);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return {
        success: false,
        error: signedResult.error?.message ?? "No se pudo abrir la factura.",
      };
    }

    return { success: true, data: { signedUrl: signedResult.data.signedUrl } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function adminMarkInvoicePaidAction(
  input: AdminMarkInvoicePaidInput
): Promise<ActionResult<{ expenseId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("admin_mark_invoice_paid", {
      p_house_public_code: input.houseCode,
      p_expense_id: input.expenseId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateInvoicePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        expenseId:
          typeof data?.expense_id === "string"
            ? data.expense_id
            : input.expenseId,
        status: typeof data?.status === "string" ? data.status : "paid",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

function readHouseId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const house = (value as { house?: unknown }).house;
  if (!house || typeof house !== "object" || Array.isArray(house)) {
    return null;
  }

  const id = (house as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}
