import { redirect } from "next/navigation";

import { createClient } from "../../utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("house_members")
    .select("house_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const firstHouseId = memberships?.[0]?.house_id;

  if (!firstHouseId) {
    redirect(`/dashboard/profile/${user.id}`);
  }

  const { data: house } = await supabase
    .from("houses")
    .select("public_code")
    .eq("id", firstHouseId)
    .single();

  if (!house?.public_code) {
    redirect(`/dashboard/profile/${user.id}`);
  }

  redirect(`/dashboard/${house.public_code}`);
}
