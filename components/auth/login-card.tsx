"use client";

import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
    .min(1, "El código es obligatorio")
    .regex(/^\d+$/, "Introduce solo números"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type CreateHomeFormValues = z.infer<typeof createHomeSchema>;
type JoinHomeFormValues = z.infer<typeof joinHomeSchema>;

type LoginCardProps = {
  initialFlow?: "login" | "create" | "join";
};

export function LoginCard({ initialFlow = "login" }: LoginCardProps) {
  const [showSetupStep, setShowSetupStep] = useState(initialFlow !== "login");
  const [homeAction, setHomeAction] = useState<"create" | "join">(
    initialFlow === "join" ? "join" : "create"
  );

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
      code: "",
    },
  });

  const onLoginSubmit = (values: LoginFormValues) => {
    console.log("Login submit", values);
  };

  const onRegisterSubmit = (_values: RegisterFormValues) => {
    setShowSetupStep(true);
  };

  const onCreateHomeSubmit = (values: CreateHomeFormValues) => {
    console.log("Create home submit", values);
  };

  const onJoinHomeSubmit = (values: JoinHomeFormValues) => {
    console.log("Join home submit", values);
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
              >
                Crear piso
              </button>
              <button
                type="button"
                onClick={() => setHomeAction("join")}
                className={`${styles.modeTab} ${
                  homeAction === "join" ? styles.modeTabActive : ""
                }`.trim()}
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
                    {...createHomeForm.register("name")}
                  />
                </div>
                {createHomeForm.formState.errors.name && (
                  <p className={styles.error}>{createHomeForm.formState.errors.name.message}</p>
                )}
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
                    placeholder="Nº de personas en el piso"
                    {...createHomeForm.register("people")}
                  />
                </div>
                {createHomeForm.formState.errors.people && (
                  <p className={styles.error}>{createHomeForm.formState.errors.people.message}</p>
                )}
              </div>

              <Button type="submit" className={styles.submit}>
                Entrar
              </Button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={joinHomeForm.handleSubmit(onJoinHomeSubmit)} noValidate>
              <div className={styles.field}>
                <div className={styles.inputWrap}>
                  <Image
                    src="/iconos/building-svgrepo-com 1.svg"
                    alt="Icono de codigo"
                    width={16}
                    height={16}
                    className={`${styles.icon} ${styles.setupIcon}`}
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    placeholder="Código"
                    {...joinHomeForm.register("code")}
                  />
                </div>
                {joinHomeForm.formState.errors.code && (
                  <p className={styles.error}>{joinHomeForm.formState.errors.code.message}</p>
                )}
              </div>

              <Button type="submit" className={styles.submit}>
                Unirme
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <Tabs defaultValue="login">
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
                    {...loginForm.register("email")}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className={styles.error}>{loginForm.formState.errors.email.message}</p>
                )}
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
                    {...loginForm.register("password")}
                  />
                </div>
                {loginForm.formState.errors.password && (
                  <p className={styles.error}>{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="button" className={styles.forgot}>
                ¿Olvidaste tu contraseña?
              </button>

              <Button type="submit" className={styles.submit}>
                Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              className={styles.form}
              onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
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
                    {...registerForm.register("email")}
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className={styles.error}>{registerForm.formState.errors.email.message}</p>
                )}
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
                    {...registerForm.register("password")}
                  />
                </div>
                {registerForm.formState.errors.password && (
                  <p className={styles.error}>{registerForm.formState.errors.password.message}</p>
                )}
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
                    placeholder="Verificar contraseña"
                    autoComplete="new-password"
                    {...registerForm.register("confirmPassword")}
                  />
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className={styles.error}>
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className={styles.submit}>
                Siguiente
              </Button>
            </form>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
