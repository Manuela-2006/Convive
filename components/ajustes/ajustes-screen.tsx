"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "../ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import styles from "./ajustes-screen.module.css";

type AjustesScreenProps = {
  houseCode: string;
  dashboardPath: string;
  isAdmin: boolean;
};

export function AjustesScreen({ houseCode, dashboardPath, isAdmin }: AjustesScreenProps) {
  const basePath = dashboardPath;
  const avatars = [
    "/images/IconoperfilM.webp",
    "/images/IconoperfilH.webp",
    "/images/IconoperfilM.webp",
    "/images/IconoperfilH.webp",
    "/images/IconoperfilM.webp",
    "/images/IconoperfilH.webp",
    "/images/IconoperfilM.webp",
    "/images/IconoperfilH.webp",
  ];
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const visibleCount = 3;

  const goPrevAvatar = () =>
    setSelectedAvatar((prev) => (prev - 1 + avatars.length) % avatars.length);
  const goNextAvatar = () =>
    setSelectedAvatar((prev) => (prev + 1) % avatars.length);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Perfil</h1>
            <p className={styles.subtitle}>Gestiona tu información personal</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <div className={styles.topGrid}>
            <Card className={`${styles.block} ${styles.personalBlock}`}>
              <h2 className={styles.blockTitle}>Información personal</h2>
              <div className={styles.personalFields}>
                <div className={styles.inputLike}>
                  <span>Lucía</span>
                  <button type="button" className={styles.editButton}>
                    Editar
                  </button>
                </div>
                <div className={styles.inputLike}>
                  <span>Fernandez Vera</span>
                  <button type="button" className={styles.editButton}>
                    Editar
                  </button>
                </div>
                <div className={styles.inputLike}>
                  <span>Luciafernandez@gmail.com</span>
                  <button type="button" className={styles.editButton}>
                    Editar
                  </button>
                </div>
                <div className={styles.inputLike}>
                  <span>***************</span>
                  <button type="button" className={styles.editButton}>
                    Editar
                  </button>
                </div>
              </div>
            </Card>

            <Card className={`${styles.block} ${styles.profileBlock}`}>
              <div className={styles.avatarBadge}>
                <Image src="/images/IconoperfilM.webp" alt="Avatar principal" width={44} height={44} />
              </div>
              <h2 className={styles.profileName}>
                LUCÍA FERNANDEZ
                <br />
                VERA
              </h2>
              <div className={styles.avatarRow}>
                <button type="button" className={styles.navArrow} onClick={goPrevAvatar} aria-label="Avatar anterior">
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt="Anterior"
                    width={24}
                    height={24}
                    className={styles.navArrowIcon}
                  />
                </button>
                <div className={styles.avatarSliderBox}>
                  <div className={styles.avatarList}>
                    {Array.from({ length: visibleCount }).map((_, offset) => {
                      const index = (selectedAvatar + offset) % avatars.length;
                      const avatar = avatars[index];
                      return (
                      <button
                        key={`avatar-${index}`}
                        type="button"
                        className={`${styles.avatarDotButton} ${offset === 0 ? styles.avatarDotButtonActive : ""}`}
                        onClick={() => setSelectedAvatar(index)}
                        aria-label={`Seleccionar avatar ${index + 1}`}
                      >
                        <Image src={avatar} alt="" width={34} height={34} />
                      </button>
                    )})}
                  </div>
                </div>
                <button type="button" className={styles.navArrow} onClick={goNextAvatar} aria-label="Siguiente avatar">
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt="Siguiente"
                    width={24}
                    height={24}
                    className={`${styles.navArrowIcon} ${styles.navArrowIconRight}`}
                  />
                </button>
              </div>
            </Card>
          </div>

          <Card className={`${styles.block} ${styles.houseBlock}`}>
            <h2 className={styles.sectionTitle}>Configuración del piso</h2>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>HABITACIÓN</span>
              <span className={styles.settingValue}>2</span>
              <button type="button" className={styles.editButton}>
                Editar
              </button>
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>TAMAÑO</span>
              <span className={styles.settingValue}>Pequeña</span>
              <button type="button" className={styles.editButton}>
                Editar
              </button>
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>ESTANCIA</span>
              <span className={styles.settingValue}>8/10/2025 - Indefinida</span>
              <button type="button" className={styles.editButton}>
                Editar
              </button>
            </div>
            {isAdmin ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" className={styles.deleteParticipantButton}>
                    Eliminar participante
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar participante</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará al participante del piso. ¿Quieres continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </Card>

          <Card className={`${styles.block} ${styles.appBlock}`}>
            <h2 className={styles.sectionTitle}>Configuración de la app</h2>
            <div className={styles.appSettings}>
              <div className={styles.notifications}>
                <span>NOTIFICACIONES</span>
                <button type="button" className={styles.toggle} aria-label="Activar notificaciones">
                  <span />
                </button>
              </div>
              <button type="button" className={styles.appButton}>
                Liquidación cierre de sesión
              </button>
              <button type="button" className={styles.appButton}>
                Contrato
              </button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

