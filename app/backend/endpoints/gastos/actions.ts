"use server";

import { getAuthenticatedProfileContext } from "../auth/queries";
import type { ActionResult } from "../shared/action-result";
import { toActionError } from "../shared/action-result";
import {
  buildTicketDocumentPath,
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENTS_BUCKET,
  validateDocumentUploadPayload,
} from "../shared/document-storage";
import type { DocumentUploadPayload } from "../../../../lib/document-upload-types";
import { revalidatePaths } from "../shared/revalidate";

type CreatePendingTicketExpenseInput = {
  houseCode: string;
  dashboardPath: string;
  ticketKind: "purchase" | "unexpected";
  title: string;
  merchant: string;
  purchaseDate: string;
  totalAmount: number;
  itemNames: string[];
  participantProfileIds: string[];
  notes?: string;
  paidByProfileId?: string | null;
  document?: DocumentUploadPayload | null;
};

type ViewTicketDocumentInput = {
  houseCode: string;
  ticketId: string;
};

type RequestExpensePaymentConfirmationInput = {
  houseCode: string;
  dashboardPath: string;
  expenseId: string;
  note?: string;
  amount?: number | null;
};

type AdminReviewPaymentInput = {
  houseCode: string;
  dashboardPath: string;
  paymentId: string;
};

type AdminRejectPaymentInput = AdminReviewPaymentInput & {
  reason?: string;
};

function revalidateExpensePaths(dashboardPath: string) {
  revalidatePaths([
    dashboardPath,
    `${dashboardPath}/gastos`,
    `${dashboardPath}/gastos/anadir-ticket`,
    `${dashboardPath}/gastos/tickets`,
    `${dashboardPath}/gastos/division`,
    `${dashboardPath}/gastos/validaciones`,
    `${dashboardPath}/gastos/simplificar`,
    `${dashboardPath}/gastos/simplificar/pago-simplificado`,
    `${dashboardPath}/area-personal`,
    `${dashboardPath}/area-personal/historial`,
  ]);
}

export async function createPendingTicketExpenseAction(
  input: CreatePendingTicketExpenseInput
): Promise<ActionResult<{ expenseId: string; ticketId: string }>> {
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

    const ticketId = crypto.randomUUID();
    const expenseId = crypto.randomUUID();
    let ticketFilePath: string | null = null;

    if (input.document) {
      const { buffer, extension } = validateDocumentUploadPayload(input.document);
      ticketFilePath = buildTicketDocumentPath({
        houseId,
        expenseId,
        extension,
      });

      const uploadResult = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(ticketFilePath, buffer, {
          contentType: input.document.mediaType,
          upsert: false,
        });

      if (uploadResult.error) {
        return { success: false, error: uploadResult.error.message };
      }

      uploadedPath = ticketFilePath;
    }

    const { data, error } = await supabase.rpc("create_pending_ticket_expense", {
      p_house_public_code: input.houseCode,
      p_ticket_id: ticketId,
      p_expense_id: expenseId,
      p_ticket_kind: input.ticketKind,
      p_title: input.title.trim(),
      p_merchant: input.merchant.trim(),
      p_purchase_date: input.purchaseDate,
      p_total_amount: input.totalAmount,
      p_item_names: input.itemNames,
      p_participant_profile_ids: input.participantProfileIds,
      p_notes: input.notes?.trim() ? input.notes.trim() : null,
      p_paid_by_profile_id: input.paidByProfileId ?? null,
      p_ticket_file_path: ticketFilePath,
    });

    if (error) {
      if (uploadedPath) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadedPath]);
      }
      return { success: false, error: error.message };
    }

    uploadedPath = null;
    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        expenseId:
          typeof data?.expense_id === "string"
            ? data.expense_id
            : String(data?.expense_id ?? ""),
        ticketId:
          typeof data?.ticket_id === "string"
            ? data.ticket_id
            : String(data?.ticket_id ?? ""),
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

export async function getTicketDocumentSignedUrlAction(
  input: ViewTicketDocumentInput
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
      .from("purchase_tickets")
      .select("house_id,ticket_file_path")
      .eq("id", input.ticketId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    const ticket = data as { house_id?: string | null; ticket_file_path?: string | null } | null;
    if (!ticket || ticket.house_id !== houseId || !ticket.ticket_file_path) {
      return { success: false, error: "Ticket no encontrado o sin imagen." };
    }

    const signedResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(ticket.ticket_file_path, DOCUMENT_SIGNED_URL_TTL_SECONDS);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return {
        success: false,
        error: signedResult.error?.message ?? "No se pudo abrir el ticket.",
      };
    }

    return { success: true, data: { signedUrl: signedResult.data.signedUrl } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function requestExpensePaymentConfirmationAction(
  input: RequestExpensePaymentConfirmationInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc(
      "request_expense_payment_confirmation",
      {
        p_house_public_code: input.houseCode,
        p_expense_id: input.expenseId,
        p_note: input.note?.trim() ? input.note.trim() : null,
        p_amount:
          typeof input.amount === "number" && Number.isFinite(input.amount)
            ? input.amount
            : null,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "pending",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function adminConfirmPaymentAction(
  input: AdminReviewPaymentInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("admin_confirm_payment", {
      p_house_public_code: input.houseCode,
      p_payment_id: input.paymentId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "completed",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function adminRejectPaymentAction(
  input: AdminRejectPaymentInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("admin_reject_payment", {
      p_house_public_code: input.houseCode,
      p_payment_id: input.paymentId,
      p_reason: input.reason?.trim() ? input.reason.trim() : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "rejected",
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
