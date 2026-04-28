"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import styles from "./update-password-card.module.css";

export function UpdatePasswordCard() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (data.session) {
        setRecoveryReady(true);
        return;
      }

      setErrorMessage(
        "El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo."
      );
    };

    void checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setRecoveryReady(true);
          setErrorMessage("");
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const onSubmit = () => {
    if (!password.trim()) {
      setErrorMessage("Introduce la nueva contraseña.");
      setSuccessMessage("");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      setSuccessMessage("");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      setSuccessMessage("");
      return;
    }

    if (!recoveryReady) {
      setErrorMessage("El enlace no es válido o ha caducado.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(
          "No se pudo actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez."
        );
        return;
      }

      setSuccessMessage("Contraseña actualizada correctamente.");
      setTimeout(() => {
        router.push("/login");
      }, 800);
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.heading}>Nueva contraseña</h2>
        <p className={styles.copy}>Elige una contraseña nueva para tu cuenta.</p>
      </div>

      <div className={styles.panel}>
        <div className={styles.form}>
          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <Image
                src="/iconos/key-svgrepo-com 1.svg"
                alt="Icono de contraseña"
                width={16}
                height={16}
                className={`${styles.icon} ${styles.keyIcon}`}
              />
              <Input
                type="password"
                className={styles.input}
                placeholder="Contraseña nueva"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <Image
                src="/iconos/key-svgrepo-com 1.svg"
                alt="Icono de verificar contraseña"
                width={16}
                height={16}
                className={`${styles.icon} ${styles.keyIcon}`}
              />
              <Input
                type="password"
                className={styles.input}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <Link href="/login" className={styles.backLink}>
            Volver al login
          </Link>

          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          {successMessage ? <p className={styles.success}>{successMessage}</p> : null}

          <Button
            type="button"
            className={styles.submit}
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "Actualizando..." : "Guardar contraseña"}
          </Button>
        </div>
      </div>
    </div>
  );
}


