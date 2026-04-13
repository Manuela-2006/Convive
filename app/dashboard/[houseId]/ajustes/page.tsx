import { redirect } from "next/navigation";

import { AjustesScreen } from "../../../../components/ajustes/ajustes-screen";
import { createClient } from "../../../../utils/supabase/server";

type AjustesPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function AjustesPage({ params }: AjustesPageProps) {
  const { houseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: house } = await supabase
    .from("houses")
    .select("public_code")
    .eq("public_code", houseId)
    .single();

  if (!house) {
    redirect("/dashboard");
  }

  return <AjustesScreen houseCode={house.public_code} />;
}
