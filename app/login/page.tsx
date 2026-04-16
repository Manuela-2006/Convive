import Image from "next/image";
import { LoginCard } from "../../components/auth/login-card";
import styles from "./page.module.css";

type LoginPageProps = {
  searchParams?: Promise<{
    flow?: "login" | "create" | "join";
    code?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const flow =
    params?.flow === "create" || params?.flow === "join"
      ? params.flow
      : "login";
  const joinCode = params?.code?.trim() ?? "";

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <h1 className={styles.title}>Bienvenido</h1>
        <Image
          src="/Logonegro.webp"
          alt="Logo Convive"
          width={290}
          height={95}
          className={styles.logo}
          priority
        />
        <p className={styles.subtitle}>Pon en orden tu piso compartido</p>
        <div className={styles.cardWrap}>
          <LoginCard initialFlow={flow} initialJoinCode={joinCode} />
        </div>
      </section>
    </main>
  );
}
