import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createHouseFromFormAction,
  joinHouseFromFormAction,
} from "../../../actions/house-actions";
import {
  buildDashboardPath,
  buildProfilePath,
  getAuthenticatedProfileContext,
} from "../../../../lib/dashboard";

type ProfileDashboardPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function ProfileDashboardPage({
  params,
  searchParams,
}: ProfileDashboardPageProps) {
  const { userId: userCode } = await params;
  const resolvedSearchParams = await searchParams;
  const { supabase, profile } = await getAuthenticatedProfileContext();

  if (profile.public_code !== userCode) {
    redirect(buildProfilePath(profile.public_code));
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("house_members")
    .select("house_id, role")
    .eq("profile_id", profile.id)
    .eq("is_active", true);

  const houseIds = memberships?.map((membership) => membership.house_id) ?? [];

  const { data: houses, error: housesError } = houseIds.length
    ? await supabase
        .from("houses")
        .select("id, name, public_code, created_by")
        .in("id", houseIds)
    : { data: [], error: null };

  const housesById = new Map((houses ?? []).map((house) => [house.id, house]));
  const houseSummaries =
    memberships?.map((membership) => ({
      role: membership.role,
      house: housesById.get(membership.house_id),
    })) ?? [];

  const displayName = profile.full_name?.trim() || profile.email || profile.public_code;
  const profileError = resolvedSearchParams?.error;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0ebe6",
        padding: "2rem",
        color: "#1f1a17",
      }}
    >
      <section
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#fffaf5",
            borderRadius: "18px",
            padding: "1.5rem",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          }}
        >
          <p style={{ margin: 0, color: "#8b1a2f", fontWeight: 600 }}>Tu perfil</p>
          <h1
            style={{
              margin: "0.5rem 0",
              fontFamily: "var(--font-montserrat), sans-serif",
              fontSize: "clamp(2rem, 5vw, 3rem)",
            }}
          >
            Bienvenido, {displayName}
          </h1>
          <p style={{ margin: 0 }}>Usuario: {profile.email ?? "Sin correo disponible"}</p>
          <p style={{ margin: "0.5rem 0 0" }}>Código público: {profile.public_code}</p>
          {profileError ? (
            <p style={{ margin: "0.75rem 0 0", color: "#8b1a2f", fontWeight: 600 }}>
              {profileError}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.06)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Tus pisos</h2>
            {membershipsError || housesError ? (
              <p>No he podido cargar tus pisos todavía.</p>
            ) : !houseSummaries.length ? (
              <p>Todavía no estás en ningún piso.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {houseSummaries.map((summary) => {
                  if (!summary.house) {
                    return null;
                  }

                  return (
                    <article
                      key={summary.house.id}
                      style={{
                        border: "1px solid #e7ddd4",
                        borderRadius: "14px",
                        padding: "1rem",
                        background: "#fdf8f2",
                      }}
                    >
                      <h3 style={{ margin: "0 0 0.4rem" }}>{summary.house.name}</h3>
                      <p style={{ margin: "0 0 0.35rem" }}>
                        Código: {summary.house.public_code}
                      </p>
                      <p style={{ margin: "0 0 0.9rem" }}>Rol: {summary.role}</p>
                      <Link
                        href={buildDashboardPath(
                          profile.public_code,
                          summary.house.public_code
                        )}
                        style={{
                          display: "inline-block",
                          padding: "0.7rem 1rem",
                          borderRadius: "12px",
                          background: "#8b1a2f",
                          color: "#f0ebe6",
                          textDecoration: "none",
                        }}
                      >
                        Ver dashboard completo del piso
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.06)",
              display: "grid",
              gap: "1rem",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0 }}>Volver a los pisos</h2>
              <p style={{ marginBottom: 0 }}>
                Desde aquí puedes crear un piso nuevo o unirte a uno existente.
              </p>
            </div>

            <form
              action={createHouseFromFormAction}
              style={{ display: "grid", gap: "0.6rem" }}
            >
              <strong>Crear piso</strong>
              <input
                name="name"
                type="text"
                placeholder="Nombre del piso"
                required
                style={{
                  borderRadius: "12px",
                  border: "1px solid #d7c8bc",
                  padding: "0.8rem 0.9rem",
                }}
              />
              <input
                name="people"
                type="text"
                inputMode="numeric"
                placeholder="Nº de personas"
                required
                style={{
                  borderRadius: "12px",
                  border: "1px solid #d7c8bc",
                  padding: "0.8rem 0.9rem",
                }}
              />
              <button
                type="submit"
                style={{
                  border: 0,
                  borderRadius: "12px",
                  background: "#8b1a2f",
                  color: "#f0ebe6",
                  padding: "0.8rem 1rem",
                  cursor: "pointer",
                }}
              >
                Crear piso
              </button>
            </form>

            <form
              action={joinHouseFromFormAction}
              style={{ display: "grid", gap: "0.6rem" }}
            >
              <strong>Unirse a un piso</strong>
              <input
                name="code"
                type="text"
                placeholder="Código del piso"
                required
                style={{
                  borderRadius: "12px",
                  border: "1px solid #d7c8bc",
                  padding: "0.8rem 0.9rem",
                }}
              />
              <button
                type="submit"
                style={{
                  border: 0,
                  borderRadius: "12px",
                  background: "#1f1a17",
                  color: "#f0ebe6",
                  padding: "0.8rem 1rem",
                  cursor: "pointer",
                }}
              >
                Unirme
              </button>
            </form>
          </section>
        </div>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "1.25rem",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.06)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Configuración del usuario</h2>
          <p style={{ marginBottom: 0 }}>
            Aquí dejaremos luego la configuración del perfil, preferencias y ajustes de
            la cuenta.
          </p>
        </section>
      </section>
    </main>
  );
}
