"use server";

import { redirect } from "next/navigation";

import {
  buildDashboardPath,
  getAuthenticatedProfileContext,
  getJoinHouseErrorMessage,
  readHousePublicCode,
} from "../../lib/dashboard";

export async function createHouseAction(formData: {
  name: string;
  people: string;
}) {
  const { supabase, profile } = await getAuthenticatedProfileContext();

  const { data, error } = await supabase.rpc("create_house", {
    p_name: formData.name,
    p_max_members: Number(formData.people),
  });

  if (error) {
    return { error: error.message };
  }

  const housePublicCode = readHousePublicCode(data);

  if (!housePublicCode) {
    return { error: "No he podido obtener el codigo publico del piso." };
  }

  redirect(buildDashboardPath(profile.public_code, housePublicCode));
}

export async function joinHouseAction(formData: { code: string }) {
  const { supabase, profile } = await getAuthenticatedProfileContext();
  const inviteCode = formData.code.trim();

  const { data, error } = await supabase.rpc("join_house_by_code", {
    p_code: inviteCode,
  });

  if (error) {
    return { error: getJoinHouseErrorMessage(error.message) };
  }

  const housePublicCode = readHousePublicCode(data);

  if (!housePublicCode) {
    return { error: "No he podido obtener el codigo publico del piso." };
  }

  redirect(buildDashboardPath(profile.public_code, housePublicCode));
}

export async function joinHouseAndReturnDashboardPathAction(formData: {
  code: string;
}) {
  const { supabase, profile } = await getAuthenticatedProfileContext();
  const inviteCode = formData.code.trim();

  const { data, error } = await supabase.rpc("join_house_by_code", {
    p_code: inviteCode,
  });

  if (error) {
    return { error: getJoinHouseErrorMessage(error.message) };
  }

  const housePublicCode = readHousePublicCode(data);

  if (!housePublicCode) {
    return { error: "No he podido obtener el codigo publico del piso." };
  }

  return {
    dashboardPath: buildDashboardPath(profile.public_code, housePublicCode),
  };
}
