"use server";

import { redirect } from "next/navigation";
import {
  buildDashboardPath,
  getDefaultDashboardPath,
  getJoinHouseErrorMessage,
  readHousePublicCode,
  readPublicCode,
} from "../../lib/dashboard";
import { createClient } from "../../utils/supabase/server";

type AuthPayload = {
  email: string;
  password: string;
};

export async function signUpWithEmail({ email, password }: AuthPayload) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      error: "Debes confirmar tu correo antes de crear o unirte a un piso.",
    };
  }

  return { success: true };
}

export async function signInWithEmail({
  email,
  password,
  redirectTo,
}: AuthPayload & { redirectTo?: string | null }) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (redirectTo === null) {
    return { success: true };
  }

  return {
    success: true,
    redirectTo: redirectTo ?? (await getDefaultDashboardPath()),
  };
}

export async function signInAndJoinHouseWithEmail({
  email,
  password,
  code,
}: AuthPayload & { code: string }) {
  const supabase = await createClient();
  const inviteCode = code.trim();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: signInError.message };
  }

  const { data: profile, error: profileError } = await supabase.rpc(
    "get_authenticated_profile_context"
  );

  const profilePublicCode =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? readPublicCode((profile as { public_code?: unknown }).public_code)
      : null;

  if (profileError || !profilePublicCode) {
    return { error: "No he podido cargar tu perfil." };
  }

  const { data: housePublicCodeResult, error: joinError } = await supabase.rpc(
    "join_house_by_code",
    {
      p_code: inviteCode,
    }
  );

  if (joinError) {
    return { error: getJoinHouseErrorMessage(joinError.message) };
  }

  const housePublicCode = readHousePublicCode(housePublicCodeResult);

  if (!housePublicCode) {
    return { error: "No he podido obtener el codigo publico del piso." };
  }

  return {
    success: true,
    dashboardPath: buildDashboardPath(profilePublicCode, housePublicCode),
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
