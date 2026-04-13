"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "../../app/actions/auth-actions";
import styles from "./electrical-menu.module.css";

type ElectricalMenuProps = {
  houseCode: string;
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

function MenuSwitchItem({ item, isActive }: { item: MenuItem; isActive: boolean }) {
  return (
    <Link href={item.href} className={styles.switchItem}>
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

export function ElectricalMenu({ houseCode }: ElectricalMenuProps) {
  const pathname = usePathname();

  const groups: MenuGroup[] = [
    {
      title: "Principal",
      items: [
        { code: "01", label: "Inicio", href: `/dashboard/${houseCode}` },
        { code: "02", label: "Área personal", href: `/dashboard/${houseCode}/area-grupal` },
        { code: "03", label: "Gastos", href: `/dashboard/${houseCode}/gastos` },
        { code: "04", label: "Facturas", href: `/dashboard/${houseCode}/facturas` },
      ],
    },
    {
      title: "Gestión",
      items: [
        { code: "05", label: "Área grupal", href: `/dashboard/${houseCode}/area-grupal` },
        { code: "06", label: "Calendario", href: `/dashboard/${houseCode}/calendario` },
        { code: "07", label: "Limpieza", href: `/dashboard/${houseCode}/limpieza` },
        { code: "08", label: "Herramientas", href: `/dashboard/${houseCode}/herramientas` },
      ],
    },
    {
      title: "Configuración",
      items: [
        { code: "09", label: "Ajustes", href: `/dashboard/${houseCode}/ajustes` },
        { code: "10", label: "Notificaciones", href: `/dashboard/${houseCode}/notificaciones` },
      ],
    },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.panelWrap}>
        <header>
          <h1 className={styles.title}>Cuadro Eléctrico</h1>
          <div className={styles.brand} aria-hidden="true">
            <span className={styles.brandLine} />
            <span className={styles.brandName}>CONVIVE</span>
            <span className={styles.brandLine} />
          </div>
        </header>

        {groups.map((group) => (
          <article key={group.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.title}</h2>
            <hr className={styles.groupDivider} />
            <div className={styles.switchGrid}>
              {group.items.map((item) => (
                <MenuSwitchItem key={item.href} item={item} isActive={pathname === item.href} />
              ))}

              {group.title === "Configuración" ? (
                <form action={signOutAction} className={styles.logoutItem}>
                  <button type="submit" className={styles.logoutButton}>
                    <div className={styles.logoutSwitchShell}>
                      <div className={styles.logoutSwitchBar}>
                        <span className={styles.logoutSwitchMark} />
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
    </main>
  );
}
