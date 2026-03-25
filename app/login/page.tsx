import Image from "next/image";
import { LoginCard } from "../../components/auth/login-card";
import styles from "./page.module.css";

type LoginPageProps = {
  searchParams?:
    | {
        flow?: string;
      }
    | Promise<{
        flow?: string;
      }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const flowParam = resolvedSearchParams?.flow;
  const initialFlow =
    flowParam === "create" || flowParam === "join" ? flowParam : "login";

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-label="Pantalla de acceso de Convive">
        <h1 className={styles.title}>Bienvenido</h1>
        <Image
          src="/Logonegro.webp"
          alt="Logo Convive"
          width={300}
          height={83}
          className={styles.logo}
          priority
        />
        <p className={styles.subtitle}>Pon en orden tu piso compartido</p>
        <div className={styles.cardWrap}>
          <LoginCard initialFlow={initialFlow} />
        </div>
      </section>
    </main>
  );
}
