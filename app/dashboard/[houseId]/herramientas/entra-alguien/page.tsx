import { redirect } from "next/navigation";

import { HerramientasEntraScreen } from "../../../../../components/herramientas/herramientas-entra-screen";
import { createClient } from "../../../../../utils/supabase/server";

type HerramientasEntraPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function HerramientasEntraPage({ params }: HerramientasEntraPageProps) {
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

  return <HerramientasEntraScreen houseCode={house.public_code} />;
}

