"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import styles from "./reset-password-card.module.css";

export function ResetPasswordCard() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const onSubmit = () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Introduce tu correo.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Te hemos enviado un email con el enlace para recuperar tu contraseña."
      );
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.heading}>Recuperar contraseña</h2>
        <p className={styles.copy}>
          Escribe tu correo y te enviaremos un enlace para cambiarla.
        </p>
      </div>

      <div className={styles.panel}>
        <div className={styles.form}>
          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <Image
                src="/iconos/SVGRepo_iconCarrier.svg"
                alt="Icono de correo"
                width={16}
                height={16}
                className={styles.icon}
              />
              <Input
                type="email"
                className={styles.input}
                placeholder="Correo"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <Link href="/login" className={styles.backLink}>
            Volver al login
          </Link>

          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          {successMessage ? <p className={styles.success}>{successMessage}</p> : null}

          <Button type="button" className={styles.submit} onClick={onSubmit} disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar enlace"}
          </Button>
        </div>
      </div>
    </div>
  );
}

