"use server";

import { redirect } from "next/navigation";

import {
  buildDashboardPath,
  buildProfilePath,
  getAuthenticatedProfileContext,
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

  redirect(buildDashboardPath(profile.public_code, String(data)));
}

export async function joinHouseAction(formData: { code: string }) {
  const { supabase, profile } = await getAuthenticatedProfileContext();

  const { data, error } = await supabase.rpc("join_house_by_code", {
    p_code: formData.code,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(buildDashboardPath(profile.public_code, String(data)));
}

export async function createHouseFromFormAction(formData: FormData) {
  const { profile } = await getAuthenticatedProfileContext();
  const result = await createHouseAction({
    name: String(formData.get("name") ?? "").trim(),
    people: String(formData.get("people") ?? "").trim(),
  });

  if (result?.error) {
    redirect(
      `${buildProfilePath(profile.public_code)}?error=${encodeURIComponent(result.error)}`
    );
  }
}

export async function joinHouseFromFormAction(formData: FormData) {
  const { profile } = await getAuthenticatedProfileContext();
  const result = await joinHouseAction({
    code: String(formData.get("code") ?? "").trim(),
  });

  if (result?.error) {
    redirect(
      `${buildProfilePath(profile.public_code)}?error=${encodeURIComponent(result.error)}`
    );
  }
}
