"use client";

import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "./mini-door-link.module.css";

export type MenuKey =
  | "inicio"
  | "area-personal"
  | "gastos"
  | "facturas"
  | "area-grupal"
  | "calendario"
  | "limpieza"
  | "herramientas"
  | "ajustes"
  | "cerrar-sesion";

type MiniDoorLinkProps = {
  menuHref: string;
  dashboardPath: string;
  currentScreen?: MenuKey;
};

const MENU_ITEMS: Array<{
  key: MenuKey;
  label: string;
  index: string;
  href?: string;
}> = [
  { key: "inicio", label: "Inicio", index: "01", href: "" },
  { key: "area-personal", label: "Área personal", index: "02", href: "area-personal" },
  { key: "gastos", label: "Gastos", index: "03", href: "gastos" },
  { key: "facturas", label: "Facturas", index: "04", href: "facturas" },
  { key: "area-grupal", label: "Área grupal", index: "05", href: "area-grupal" },
  { key: "calendario", label: "Calendario", index: "06", href: "calendario" },
  { key: "limpieza", label: "Limpieza", index: "07", href: "limpieza" },
  { key: "herramientas", label: "Herramientas", index: "08", href: "herramientas" },
  { key: "ajustes", label: "Ajustes", index: "09", href: "ajustes" },
  { key: "cerrar-sesion", label: "Cerrar sesión", index: "10", href: "menu" },
];

export function MiniDoorLink({
  menuHref,
  dashboardPath,
  currentScreen,
}: MiniDoorLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const visibleItems = MENU_ITEMS.filter((item) => item.key !== currentScreen);

  const handleDoorClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches;

    if (!isMobile) {
      return;
    }

    event.preventDefault();
    setIsOpen((current) => !current);
  };

  const handleMiniPress = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (pendingHref || pathname === href) {
      return;
    }

    event.preventDefault();
    setIsOpen(false);
    setPendingHref(href);

    window.setTimeout(() => {
      router.push(href);
    }, 220);
  };

  return (
    <aside
      className={`${styles.miniPanel} ${isOpen ? styles.miniPanelOpen : ""}`}
      aria-label="Accesos rápidos"
    >
      <Link
        href={menuHref}
        className={styles.miniDoorLink}
        aria-label="Abrir menú"
        aria-expanded={isOpen}
        onClick={handleDoorClick}
      >
        <span className={styles.doorCard}>
          <Image
            src="/iconos/Iconopuerta.svg"
            alt="Puerta"
            width={30}
            height={30}
            className={styles.doorHandle}
            priority
          />
          <span className={styles.menuText}>Men{"\u00FA"}</span>
        </span>
      </Link>

      <div className={styles.switchesWrap}>
        {visibleItems.map((item) => (
          <Link
            key={item.key}
            href={`${dashboardPath}${item.href ? `/${item.href}` : ""}`}
            className={styles.miniItem}
            onClick={(event) =>
              handleMiniPress(
                event,
                `${dashboardPath}${item.href ? `/${item.href}` : ""}`
              )
            }
          >
            <span className={styles.miniSwitch}>
              <span
                className={`${styles.miniLever} ${
                  pendingHref === `${dashboardPath}${item.href ? `/${item.href}` : ""}`
                    ? styles.miniLeverActive
                    : ""
                }`}
              />
              <span
                className={`${styles.miniPiece} ${
                  pendingHref === `${dashboardPath}${item.href ? `/${item.href}` : ""}`
                    ? styles.miniPieceActive
                    : ""
                }`}
              />
            </span>
            <span className={styles.miniLabel}>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

