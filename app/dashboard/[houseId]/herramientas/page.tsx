import { redirect } from "next/navigation";

import { HerramientasScreen } from "../../../../components/herramientas/herramientas-screen";
import { createClient } from "../../../../utils/supabase/server";

type HerramientasPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function HerramientasPage({ params }: HerramientasPageProps) {
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

  return <HerramientasScreen houseCode={house.public_code} />;
}

