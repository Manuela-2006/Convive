import { redirect } from "next/navigation";

import { CalendarioScreen } from "../../../../components/calendario/calendario-screen";
import { createClient } from "../../../../utils/supabase/server";

type CalendarioPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function CalendarioPage({ params }: CalendarioPageProps) {
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

  return <CalendarioScreen houseCode={house.public_code} />;
}

