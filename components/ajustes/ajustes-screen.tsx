"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  removeHouseMemberAction,
  updateHouseMemberSettingsAction,
  updateProfileSettingsAction,
} from "../../app/backend/endpoints/auth/actions";
import type { ProfileSettingsData } from "../../lib/dashboard-types";
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
  settings: ProfileSettingsData;
};

function splitFullName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function formatStay(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return "";
  }

  return `${startDate || "Sin inicio"} - ${endDate || "Indefinida"}`;
}

export function AjustesScreen({
  houseCode,
  dashboardPath,
  isAdmin,
  settings,
}: AjustesScreenProps) {
  const router = useRouter();
  const basePath = dashboardPath;
  const avatars = ["/images/IconoperfilM.webp", "/images/IconoperfilH.webp"];
  const initialName = useMemo(
    () => splitFullName(settings.profile.full_name),
    [settings.profile.full_name]
  );
  const initialAvatarIndex = Math.max(
    0,
    avatars.findIndex((avatar) => avatar === settings.profile.avatar_url)
  );
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [email, setEmail] = useState(settings.profile.email ?? "");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarIndex);
  const [roomLabel, setRoomLabel] = useState(
    settings.house_member.room_label ?? ""
  );
  const [roomSize, setRoomSize] = useState(settings.house_member.room_size ?? "");
  const [stayStartDate, setStayStartDate] = useState(
    settings.house_member.stay_start_date ?? ""
  );
  const [stayEndDate, setStayEndDate] = useState(
    settings.house_member.stay_end_date ?? ""
  );
  const [removeProfileId, setRemoveProfileId] = useState(
    settings.removable_members[0]?.profile_id ?? settings.profile.id
  );
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const visibleCount = 3;
  const selectedAvatarUrl = avatars[selectedAvatar] ?? avatars[0];
  const profileDisplayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Perfil";

  const goPrevAvatar = () =>
    setSelectedAvatar((prev) => (prev - 1 + avatars.length) % avatars.length);
  const goNextAvatar = () =>
    setSelectedAvatar((prev) => (prev + 1) % avatars.length);

  const handleProfileSave = () => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const result = await updateProfileSettingsAction({
        houseCode,
        dashboardPath: basePath,
        firstName,
        lastName,
        email,
        password,
        avatarUrl: selectedAvatarUrl,
      });

      if (result.success) {
        setPassword("");
        setEmail(result.data.email ?? email);
        setFeedbackMessage("Perfil guardado correctamente.");
        router.refresh();
      } else if ("error" in result) {
        setFeedbackMessage(result.error);
      }
    });
  };

  const handleHouseSettingsSave = () => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const result = await updateHouseMemberSettingsAction({
        houseCode,
        dashboardPath: basePath,
        roomLabel,
        roomSize,
        stayStartDate,
        stayEndDate,
      });

      if (result.success) {
        setFeedbackMessage("Configuración del piso guardada.");
        router.refresh();
      } else if ("error" in result) {
        setFeedbackMessage(result.error);
      }
    });
  };

  const handleRemoveParticipant = () => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const result = await removeHouseMemberAction({
        houseCode,
        dashboardPath: basePath,
        profileId: removeProfileId,
      });

      if (result.success) {
        setFeedbackMessage("Participante eliminado del piso.");
        router.refresh();
      } else if ("error" in result) {
        setFeedbackMessage(result.error);
      }
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image
              src="/iconos/flechaatras.svg"
              alt="Volver"
              width={20}
              height={20}
              className={styles.backIcon}
            />
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
                  <input
                    className={styles.inlineInput}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    aria-label="Nombre"
                  />
                  <span className={styles.fieldLabel}>Nombre</span>
                </div>
                <div className={styles.inputLike}>
                  <input
                    className={styles.inlineInput}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    aria-label="Apellidos"
                  />
                  <span className={styles.fieldLabel}>Apellidos</span>
                </div>
                <div className={styles.inputLike}>
                  <input
                    className={styles.inlineInput}
                    value={email}
                    type="email"
                    onChange={(event) => setEmail(event.target.value)}
                    aria-label="Email"
                  />
                  <span className={styles.fieldLabel}>Email</span>
                </div>
                <div className={styles.inputLike}>
                  <input
                    className={styles.inlineInput}
                    value={password}
                    type="password"
                    onChange={(event) => setPassword(event.target.value)}
                    aria-label="Nueva contraseña"
                  />
                  <span className={styles.fieldLabel}>Contraseña</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleProfileSave}
                disabled={isPending}
              >
                Guardar
              </button>
            </Card>

            <Card className={`${styles.block} ${styles.profileBlock}`}>
              <div className={styles.avatarBadge}>
                <Image
                  src={selectedAvatarUrl}
                  alt="Avatar principal"
                  width={44}
                  height={44}
                />
              </div>
              <h2 className={styles.profileName}>{profileDisplayName.toUpperCase()}</h2>
              <div className={styles.avatarRow}>
                <button
                  type="button"
                  className={styles.navArrow}
                  onClick={goPrevAvatar}
                  aria-label="Avatar anterior"
                >
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
                          key={`avatar-${offset}-${index}`}
                          type="button"
                          className={`${styles.avatarDotButton} ${
                            offset === 0 ? styles.avatarDotButtonActive : ""
                          }`}
                          onClick={() => setSelectedAvatar(index)}
                          aria-label={`Seleccionar avatar ${index + 1}`}
                        >
                          <Image src={avatar} alt="" width={34} height={34} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.navArrow}
                  onClick={goNextAvatar}
                  aria-label="Siguiente avatar"
                >
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
              <span className={styles.settingLabel}>HABITACION</span>
              <input
                className={styles.settingInput}
                value={roomLabel}
                onChange={(event) => setRoomLabel(event.target.value)}
                aria-label="Habitación"
              />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>TAMANO</span>
              <input
                className={styles.settingInput}
                value={roomSize}
                onChange={(event) => setRoomSize(event.target.value)}
                aria-label="Tamaño"
              />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>ESTANCIA</span>
              <div className={styles.stayInputs}>
                <input
                  className={styles.settingInput}
                  value={stayStartDate}
                  type="date"
                  onChange={(event) => setStayStartDate(event.target.value)}
                  aria-label="Inicio de estancia"
                />
                <input
                  className={styles.settingInput}
                  value={stayEndDate}
                  type="date"
                  onChange={(event) => setStayEndDate(event.target.value)}
                  aria-label="Fin de estancia"
                />
              </div>
            </div>
            <p className={styles.settingHint}>
              {formatStay(stayStartDate, stayEndDate)}
            </p>
            <button
              type="button"
              className={styles.houseSaveButton}
              onClick={handleHouseSettingsSave}
              disabled={isPending}
            >
              Guardar configuración
            </button>
            {isAdmin && settings.can_remove_members ? (
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
                      Esta acción sacará al participante del piso sin borrar su
                      historial. ¿Quieres continuar?
                    </AlertDialogDescription>
                    <select
                      className={styles.memberSelect}
                      value={removeProfileId}
                      onChange={(event) => setRemoveProfileId(event.target.value)}
                    >
                      {settings.removable_members.map((member) => (
                        <option key={member.profile_id} value={member.profile_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveParticipant}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            {feedbackMessage ? (
              <p className={styles.feedbackMessage}>{feedbackMessage}</p>
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
