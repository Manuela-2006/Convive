"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  signInAndJoinHouseWithEmail,
  signInWithEmail,
  signUpWithEmail,
} from "../../app/backend/endpoints/auth/actions";
import {
  createHouseAction,
  joinHouseAction,
} from "../../app/backend/endpoints/auth/actions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import styles from "./login-card.module.css";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo es obligatorio")
    .email("Introduce un correo válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "El nombre es obligatorio"),
    lastName: z.string().trim().min(1, "Los apellidos son obligatorios"),
    email: z
      .string()
      .min(1, "El correo es obligatorio")
      .email("Introduce un correo válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z
      .string()
      .min(8, "La verificación debe tener al menos 8 caracteres"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

const createHomeSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  people: z
    .string()
    .min(1, "El número de personas es obligatorio")
    .regex(/^\d+$/, "Introduce solo números"),
});

const joinHomeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código de invitación es obligatorio")
    .regex(/^[a-zA-Z0-9]+$/, "Introduce un código de invitación válido"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type CreateHomeFormValues = z.infer<typeof createHomeSchema>;
type JoinHomeFormValues = z.infer<typeof joinHomeSchema>;

type LoginCardProps = {
  initialFlow?: "login" | "create" | "join";
  initialJoinCode?: string;
};

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la autenticación. Revisa la conexión e inténtalo de nuevo.";
}

export function LoginCard({
  initialFlow = "login",
  initialJoinCode = "",
}: LoginCardProps) {
  const router = useRouter();
  const preferredHomeAction = initialFlow === "join" ? "join" : "create";
  const [showSetupStep, setShowSetupStep] = useState(false);
  const [homeAction, setHomeAction] = useState<"create" | "join">(
    preferredHomeAction
  );
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const createHomeForm = useForm<CreateHomeFormValues>({
    resolver: zodResolver(createHomeSchema),
    defaultValues: {
      name: "",
      people: "",
    },
  });

  const joinHomeForm = useForm<JoinHomeFormValues>({
    resolver: zodResolver(joinHomeSchema),
    defaultValues: {
      code: initialJoinCode,
    },
  });

  const continueWithHouseStep = () => {
    setGlobalSuccess("Sesión iniciada. Ahora ya puedes crear o unirte a un piso.");
    setShowSetupStep(true);
    setHomeAction(preferredHomeAction);
  };

  const onLoginSubmit = (values: LoginFormValues) => {
    setGlobalError("");
    setGlobalSuccess("");

    startTransition(async () => {
      try {
        const inviteCode = joinHomeForm.getValues("code").trim();
        const result =
          initialFlow === "join" && inviteCode
            ? await signInAndJoinHouseWithEmail({
                ...values,
                code: inviteCode,
              })
            : await signInWithEmail({
                ...values,
                redirectTo: initialFlow === "login" ? undefined : null,
              });

        if (result?.error) {
          setGlobalError(result.error);
          return;
        }

        const dashboardPath =
          result && "dashboardPath" in result ? result.dashboardPath : undefined;

        if (dashboardPath) {
          router.push(dashboardPath);
          router.refresh();
          return;
        }

        const nextPath =
          result && "redirectTo" in result ? result.redirectTo : undefined;

        if (nextPath) {
          router.push(nextPath);
          router.refresh();
          return;
        }

        if (initialFlow !== "login") {
          continueWithHouseStep();
        }
      } catch (error) {
        setGlobalError(getAuthErrorMessage(error));
      }
    });
  };

  const onRegisterSubmit = (values: RegisterFormValues) => {
    setGlobalError("");
    setGlobalSuccess("");

    startTransition(async () => {
      try {
        const result = await signUpWithEmail({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        });

        if (result?.error) {
          setGlobalError(result.error);
          return;
        }

        if (initialFlow === "join") {
          setGlobalSuccess(
            "Cuenta creada correctamente. Inicia sesión y usa tu código de invitación para entrar al piso."
          );
          return;
        }

        setGlobalSuccess("Cuenta creada correctamente. Ahora crea o únete a un piso.");
        setShowSetupStep(true);
        setHomeAction(preferredHomeAction);
      } catch (error) {
        setGlobalError(getAuthErrorMessage(error));
      }
    });
  };

  const onCreateHomeSubmit = (values: CreateHomeFormValues) => {
    setGlobalError("");
    setGlobalSuccess("");

    startTransition(async () => {
      const result = await createHouseAction(values);

      if (result?.error) {
        setGlobalError(result.error);
      }
    });
  };

  const onJoinHomeSubmit = (values: JoinHomeFormValues) => {
    setGlobalError("");
    setGlobalSuccess("");

    startTransition(async () => {
      const result = await joinHouseAction({
        code: values.code.trim(),
      });

      if (result?.error) {
        setGlobalError(result.error);
      }
    });
  };

  if (showSetupStep) {
    return (
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={`${styles.tabsShell} ${styles.setupTabsShell}`}>
            <div className={styles.modeTabs}>
              <button
                type="button"
                onClick={() => setHomeAction("create")}
                className={`${styles.modeTab} ${
                  homeAction === "create" ? styles.modeTabActive : ""
                }`.trim()}
                disabled={isPending}
              >
                Crear piso
              </button>

              <button
                type="button"
                onClick={() => setHomeAction("join")}
                className={`${styles.modeTab} ${
                  homeAction === "join" ? styles.modeTabActive : ""
                }`.trim()}
                disabled={isPending}
              >
                Unirse a un piso
              </button>
            </div>
          </div>
          <div className={styles.slot} />
        </div>

        <div className={styles.panel}>
          {homeAction === "create" ? (
            <form
              className={styles.form}
              onSubmit={createHomeForm.handleSubmit(onCreateHomeSubmit)}
              noValidate
            >
              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/building-svgrepo-com 1.svg"
                    alt="Icono de edificio"
                    width={16}
                    height={16}
                    className={`${styles.icon} ${styles.setupIcon}`}
                  />
                  <Input
                    type="text"
                    className={styles.input}
                    placeholder="Nombre"
                    disabled={isPending}
                    {...createHomeForm.register("name")}
                  />
                </div>
                {createHomeForm.formState.errors.name ? (
                  <p className={styles.error}>
                    {createHomeForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/persons-svgrepo-com 1.svg"
                    alt="Icono de personas"
                    width={16}
                    height={16}
                    className={`${styles.icon} ${styles.setupIcon}`}
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    placeholder="N de personas en el piso"
                    disabled={isPending}
                    {...createHomeForm.register("people")}
                  />
                </div>
                {createHomeForm.formState.errors.people ? (
                  <p className={styles.error}>
                    {createHomeForm.formState.errors.people.message}
                  </p>
                ) : null}
              </div>

              {globalError ? <p className={styles.error}>{globalError}</p> : null}
              {globalSuccess ? <p className={styles.success}>{globalSuccess}</p> : null}

              <Button type="submit" className={styles.submit} disabled={isPending}>
                {isPending ? "Creando..." : "Entrar"}
              </Button>
            </form>
          ) : (
            <form
              className={styles.form}
              onSubmit={joinHomeForm.handleSubmit(onJoinHomeSubmit)}
              noValidate
            >
              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/building-svgrepo-com 1.svg"
                    alt="Icono de código"
                    width={16}
                    height={16}
                    className={`${styles.icon} ${styles.setupIcon}`}
                  />
                  <Input
                    type="text"
                    className={styles.input}
                    placeholder="Código de invitación"
                    disabled={isPending}
                    {...joinHomeForm.register("code")}
                  />
                </div>
                {joinHomeForm.formState.errors.code ? (
                  <p className={styles.error}>
                    {joinHomeForm.formState.errors.code.message}
                  </p>
                ) : null}
              </div>

              {globalError ? <p className={styles.error}>{globalError}</p> : null}
              {globalSuccess ? <p className={styles.success}>{globalSuccess}</p> : null}

              <Button type="submit" className={styles.submit} disabled={isPending}>
                {isPending ? "Uniéndome..." : "Unirme"}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <Tabs defaultValue={initialFlow === "login" ? "login" : "register"}>
        <div className={styles.top}>
          <div className={styles.tabsShell}>
            <TabsList className={styles.tabs}>
              <TabsTrigger value="login" className={styles.tab}>
                Iniciar sesión
              </TabsTrigger>
              <TabsTrigger value="register" className={styles.tab}>
                Registrarse
              </TabsTrigger>
            </TabsList>
          </div>
          <div className={styles.slot} />
        </div>

        <div className={styles.panel}>
          <TabsContent value="login">
            <form
              className={styles.form}
              onSubmit={loginForm.handleSubmit(onLoginSubmit)}
              noValidate
            >
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
                    disabled={isPending}
                    {...loginForm.register("email")}
                  />
                </div>
                {loginForm.formState.errors.email ? (
                  <p className={styles.error}>
                    {loginForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

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
                    placeholder="Contraseña"
                    autoComplete="current-password"
                    disabled={isPending}
                    {...loginForm.register("password")}
                  />
                </div>
                {loginForm.formState.errors.password ? (
                  <p className={styles.error}>
                    {loginForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              {globalError ? <p className={styles.error}>{globalError}</p> : null}
              {globalSuccess ? <p className={styles.success}>{globalSuccess}</p> : null}

              <Link href="/reset-password" className={styles.forgot}>
                ¿Olvidaste tu contraseña?
              </Link>

              <Button type="submit" className={styles.submit} disabled={isPending}>
                {isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              className={`${styles.form} ${styles.registerForm}`}
              onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
              noValidate
            >
              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/persons-svgrepo-com 1.svg"
                    alt="Icono de nombre"
                    width={16}
                    height={16}
                    className={styles.icon}
                  />
                  <Input
                    type="text"
                    className={styles.input}
                    placeholder="Nombre"
                    autoComplete="given-name"
                    disabled={isPending}
                    {...registerForm.register("firstName")}
                  />
                </div>
                {registerForm.formState.errors.firstName ? (
                  <p className={styles.error}>
                    {registerForm.formState.errors.firstName.message}
                  </p>
                ) : null}
              </div>

              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/persons-svgrepo-com 1.svg"
                    alt="Icono de apellidos"
                    width={16}
                    height={16}
                    className={styles.icon}
                  />
                  <Input
                    type="text"
                    className={styles.input}
                    placeholder="Apellidos"
                    autoComplete="family-name"
                    disabled={isPending}
                    {...registerForm.register("lastName")}
                  />
                </div>
                {registerForm.formState.errors.lastName ? (
                  <p className={styles.error}>
                    {registerForm.formState.errors.lastName.message}
                  </p>
                ) : null}
              </div>

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
                    disabled={isPending}
                    {...registerForm.register("email")}
                  />
                </div>
                {registerForm.formState.errors.email ? (
                  <p className={styles.error}>
                    {registerForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

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
                    placeholder="Contraseña"
                    autoComplete="new-password"
                    disabled={isPending}
                    {...registerForm.register("password")}
                  />
                </div>
                {registerForm.formState.errors.password ? (
                  <p className={styles.error}>
                    {registerForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <div className={`${styles.field} ${styles.registerFieldFull}`}>
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
                    placeholder="Verificar contraseña"
                    autoComplete="new-password"
                    disabled={isPending}
                    {...registerForm.register("confirmPassword")}
                  />
                </div>
                {registerForm.formState.errors.confirmPassword ? (
                  <p className={styles.error}>
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>

              {globalError ? <p className={styles.error}>{globalError}</p> : null}
              {globalSuccess ? <p className={styles.success}>{globalSuccess}</p> : null}

              <Button
                type="submit"
                className={`${styles.submit} ${styles.registerSubmit}`}
                disabled={isPending}
              >
                {isPending ? "Creando cuenta..." : "Siguiente"}
              </Button>
            </form>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

