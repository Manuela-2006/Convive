import { redirect } from "next/navigation";

import { createClient } from "../../../utils/supabase/server";
import { HomeBoard } from "../../../components/home/home-board";

type HouseDashboardPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function HouseDashboardPage({
  params,
}: HouseDashboardPageProps) {
  const { houseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, name, public_code, created_by")
    .eq("public_code", houseId)
    .single();

  if (houseError || !house) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Piso no encontrado</h1>
        <pre>{JSON.stringify(houseError, null, 2)}</pre>
      </main>
    );
  }

  const { data: members, error: membersError } = await supabase
    .from("house_members")
    .select(`
      id,
      role,
      profile_id,
      profiles (
        id,
        email,
        full_name
      )
    `)
    .eq("house_id", house.id)
    .eq("is_active", true);

  if (membersError) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>No he podido cargar la home del piso</h1>
        <pre>{JSON.stringify(membersError, null, 2)}</pre>
      </main>
    );
  }

  return <HomeBoard houseName={house.name} memberCount={members?.length ?? 0} />;
}
