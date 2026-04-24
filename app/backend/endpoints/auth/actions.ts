"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildDashboardPath,
  getDefaultDashboardPath,
  getAuthenticatedProfileContext,
  getJoinHouseErrorMessage,
  readHousePublicCode,
  readPublicCode,
} from "../shared/dashboard-core";
import { createClient } from "../shared/supabase-server";

type AuthPayload = {
  email: string;
  password: string;
};

type UpdateProfileSettingsInput = {
  houseCode: string;
  dashboardPath: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  avatarUrl?: string | null;
};

type UpdateHouseMemberSettingsInput = {
  houseCode: string;
  dashboardPath: string;
  roomLabel: string;
  roomSize: string;
  stayStartDate: string;
  stayEndDate?: string | null;
};

type RemoveHouseMemberInput = {
  houseCode: string;
  dashboardPath: string;
  profileId: string;
};

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function revalidateProfilePaths(dashboardPath: string) {
  revalidatePath(dashboardPath);
  revalidatePath(`${dashboardPath}/ajustes`);
  revalidatePath(`${dashboardPath}/area-grupal`);
}

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

  const { error } = await supabase.auth.signInWithPassword({
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

export async function updateProfileSettingsAction(
  input: UpdateProfileSettingsInput
): Promise<ActionResult<{ email: string | null; fullName: string; avatarUrl: string | null }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "No autenticado." };
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password?.trim() ?? "";
    const avatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;

    if (!firstName || !lastName) {
      return { success: false, error: "Nombre y apellidos son obligatorios." };
    }

    if (!email) {
      return { success: false, error: "El email es obligatorio." };
    }

    if (password && password.length < 6) {
      return {
        success: false,
        error: "La contraseña debe tener al menos 6 caracteres.",
      };
    }

    const authAttributes: {
      email?: string;
      password?: string;
      data: { full_name: string; avatar_url: string | null };
    } = {
      data: {
        full_name: fullName,
        avatar_url: avatarUrl,
      },
    };

    if (email !== user.email) {
      authAttributes.email = email;
    }

    if (password) {
      authAttributes.password = password;
    }

    const { data: authData, error: authError } =
      await supabase.auth.updateUser(authAttributes);

    if (authError) {
      return { success: false, error: authError.message };
    }

    const effectiveEmail = authData.user?.email ?? user.email ?? email;
    const { error: rpcError } = await supabase.rpc("update_own_profile_settings", {
      p_full_name: fullName,
      p_email: effectiveEmail,
      p_avatar_url: avatarUrl,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    revalidateProfilePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        email: effectiveEmail,
        fullName,
        avatarUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el perfil.",
    };
  }
}

export async function updateHouseMemberSettingsAction(
  input: UpdateHouseMemberSettingsInput
): Promise<ActionResult<{ saved: true }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { error } = await supabase.rpc("update_own_house_member_settings", {
      p_house_public_code: input.houseCode,
      p_room_label: input.roomLabel.trim() || null,
      p_room_size: input.roomSize.trim() || null,
      p_stay_start_date: input.stayStartDate || null,
      p_stay_end_date: input.stayEndDate || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateProfilePaths(input.dashboardPath);

    return { success: true, data: { saved: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración del piso.",
    };
  }
}

export async function removeHouseMemberAction(
  input: RemoveHouseMemberInput
): Promise<ActionResult<{ removed: true }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { error } = await supabase.rpc("remove_house_member", {
      p_house_public_code: input.houseCode,
      p_profile_id: input.profileId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateProfilePaths(input.dashboardPath);

    return { success: true, data: { removed: true } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el participante.",
    };
  }
}
