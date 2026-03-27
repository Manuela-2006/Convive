"use server";

import { redirect } from "next/navigation";
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
    return { success: true, userId: data.user.id };
  }

  redirect(redirectTo ?? "/dashboard");
}
