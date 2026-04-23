"use client";

import { useState } from "react";
import Link from "next/link";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { signOutAction } from "../../app/actions/auth-actions";
import styles from "./electrical-menu.module.css";

type ElectricalMenuProps = {
  houseCode: string;
  dashboardPath: string;
};

type MenuItem = {
  code: string;
  label: string;
  href: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

type MenuSwitchItemProps = {
  item: MenuItem;
  isActive: boolean;
  onPress: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

function MenuSwitchItem({ item, isActive, onPress }: MenuSwitchItemProps) {
  return (
    <Link href={item.href} className={styles.switchItem} onClick={(event) => onPress(event, item.href)}>
      <div className={styles.switchBox}>
        <div className={`${styles.switchTrack} ${isActive ? styles.switchTrackActive : ""}`}>
          <span className={`${styles.switchHandle} ${isActive ? styles.switchHandleActive : ""}`} />
        </div>
        <span className={styles.switchCode}>{item.code}</span>
      </div>
      <p className={styles.switchLabel}>{item.label}</p>
    </Link>
  );
}

export function ElectricalMenu({
  houseCode,
  dashboardPath,
}: ElectricalMenuProps) {
  const pathname = usePathname();
  const basePath = dashboardPath;
  const router = useRouter();
  const [isDoorOpen, setIsDoorOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSwitchPress = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (pendingHref || pathname === href) {
      return;
    }

    event.preventDefault();
    setPendingHref(href);

    window.setTimeout(() => {
      router.push(href);
    }, 220);
  };

  const groups: MenuGroup[] = [
    {
      title: "Principal",
      items: [
        { code: "01", label: "Inicio", href: basePath },
        { code: "02", label: "Área personal", href: `${basePath}/area-personal` },
        { code: "03", label: "Gastos", href: `${basePath}/gastos` },
        { code: "04", label: "Facturas", href: `${basePath}/facturas` },
      ],
    },
    {
      title: "Gestión",
      items: [
        { code: "05", label: "Área grupal", href: `${basePath}/area-grupal` },
        { code: "06", label: "Calendario", href: `${basePath}/calendario` },
        { code: "07", label: "Limpieza", href: `${basePath}/limpieza` },
        { code: "08", label: "Herramientas", href: `${basePath}/herramientas` },
      ],
    },
    {
      title: "Configuración",
      items: [
        { code: "09", label: "Ajustes", href: `${basePath}/ajustes` },
        { code: "10", label: "Notificaciones", href: `${basePath}/notificaciones` },
      ],
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.cabinetScene}>
        <section className={styles.panelWrap}>
          {groups.map((group) => (
            <article key={group.title} className={styles.group}>
              <h2 className={styles.groupTitle}>{group.title}</h2>
              <hr className={styles.groupDivider} />
              <div className={styles.switchGrid}>
                {group.items.map((item) => (
                  <MenuSwitchItem
                    key={item.href}
                    item={item}
                    isActive={pathname === item.href || pendingHref === item.href}
                    onPress={handleSwitchPress}
                  />
                ))}

                {group.title === "Configuración" ? (
                  <form action={signOutAction} className={styles.logoutItem} onSubmit={() => setIsLoggingOut(true)}>
                    <button type="submit" className={styles.logoutButton} disabled={isLoggingOut}>
                      <div className={styles.logoutSwitchShell}>
                        <div className={styles.logoutSwitchBar}>
                          <span
                            className={`${styles.logoutSwitchMark} ${isLoggingOut ? styles.logoutSwitchMarkPressed : ""}`}
                          />
                        </div>
                      </div>
                      <p className={styles.switchLabel}>Cerrar sesión</p>
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <div className={`${styles.cabinetDoor} ${isDoorOpen ? styles.cabinetDoorOpen : ""}`} aria-hidden={isDoorOpen}>
          <div className={styles.cabinetDoorFrame}>
            <p className={styles.cabinetDoorTitle}>CUADRO ELÉCTRICO</p>
            <p className={styles.cabinetDoorSub}>CONVIVE</p>
            <button type="button" className={styles.cabinetDoorButton} onClick={() => setIsDoorOpen(true)}>
              ABRIR PUERTA
            </button>
            <span className={styles.cabinetDoorHandle} aria-hidden="true" />
          </div>
        </div>

      </div>
    </main>
  );
}

