import Image from "next/image";

import { ResetPasswordCard } from "../../components/auth/reset-password-card";
import styles from "../login/page.module.css";

export default function ResetPasswordPage() {
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
        <p className={styles.subtitle}>Recupera el acceso a tu cuenta</p>
        <div className={styles.cardWrap}>
          <ResetPasswordCard />
        </div>
      </section>
    </main>
  );
}

