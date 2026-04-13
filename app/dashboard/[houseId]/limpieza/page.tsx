import { redirect } from "next/navigation";

import { LimpiezaScreen } from "../../../../components/limpieza/limpieza-screen";
import { createClient } from "../../../../utils/supabase/server";

type LimpiezaPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function LimpiezaPage({ params }: LimpiezaPageProps) {
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

  return <LimpiezaScreen houseCode={house.public_code} />;
}

