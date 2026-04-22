"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createClient as createSupabaseClient } from "../../utils/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import styles from "./update-password-card.module.css";

export function UpdatePasswordCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const supabase = createSupabaseClient();

  useEffect(() => {
    let isMounted = true;
    const initRecovery = async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && isMounted) {
          setErrorMessage(error.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (isMounted && data.session) {
        setRecoveryReady(true);
      }
    };

    void initRecovery();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || !!session) {
          setRecoveryReady(true);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [searchParams, supabase.auth]);

  const onSubmit = () => {
    if (!password.trim()) {
      setErrorMessage("Introduce la nueva contrasena.");
      setSuccessMessage("");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La contrasena debe tener al menos 8 caracteres.");
      setSuccessMessage("");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contrasenas no coinciden.");
      setSuccessMessage("");
      return;
    }

    if (!recoveryReady) {
      setErrorMessage("El enlace no es valido o ha caducado.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Contrasena actualizada correctamente.");
      setTimeout(() => {
        router.push("/login");
      }, 800);
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.heading}>Nueva contrasena</h2>
        <p className={styles.copy}>
          Elige una contrasena nueva para tu cuenta.
        </p>
      </div>

      <div className={styles.panel}>
        <div className={styles.form}>
          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <Image
                src="/iconos/key-svgrepo-com 1.svg"
                alt="Icono de contrasena"
                width={16}
                height={16}
                className={`${styles.icon} ${styles.keyIcon}`}
              />
              <Input
                type="password"
                className={styles.input}
                placeholder="Contrasena nueva"
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
                alt="Icono de verificar contrasena"
                width={16}
                height={16}
                className={`${styles.icon} ${styles.keyIcon}`}
              />
              <Input
                type="password"
                className={styles.input}
                placeholder="Confirmar contrasena"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          {successMessage ? <p className={styles.success}>{successMessage}</p> : null}

          <Button type="button" className={styles.submit} onClick={onSubmit} disabled={isPending}>
            {isPending ? "Actualizando..." : "Guardar contrasena"}
          </Button>

          <Link href="/login" className={styles.backLink}>
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}

