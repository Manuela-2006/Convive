import Image from "next/image";
import { Suspense } from "react";

import { UpdatePasswordCard } from "../../components/auth/update-password-card";
import styles from "../login/page.module.css";

export default function UpdatePasswordPage() {
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
        <p className={styles.subtitle}>Actualiza tu contraseña</p>
        <div className={styles.cardWrap}>
          <Suspense fallback={null}>
            <UpdatePasswordCard />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
