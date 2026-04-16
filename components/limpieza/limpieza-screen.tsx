"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./limpieza-screen.module.css";

type LimpiezaScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

const taskGroups = [
  {
    room: "COCINA",
    tasks: ["Barrer la cocina", "Tirar la basura", "Limpiar la vitro"],
  },
  {
    room: "SALÓN",
    tasks: ["Barrer la cocina", "Tirar la basura", "Limpiar la vitro"],
  },
  {
    room: "BAÑO",
    tasks: ["Barrer la cocina"],
  },
];

const overlayTasks = [
  { top: "8%", left: "6%" },
  { top: "18%", left: "27%" },
  { top: "30%", left: "8%" },
  { top: "38%", left: "74%" },
  { top: "50%", left: "66%" },
  { top: "64%", left: "69%" },
];

export function LimpiezaScreen({
  houseCode,
  dashboardPath,
}: LimpiezaScreenProps) {
  const basePath = dashboardPath;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Limpieza</h1>
            <p className={styles.subtitle}>Organización de eventos y pagos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <div className={styles.leftCol}>
            <div className={styles.topActions}>
              <Button className={styles.topButton}>+ Añadir tarea</Button>
              <Button className={styles.topButton}>↻ Rotar</Button>
            </div>

            {taskGroups.map((group) => (
              <Card key={group.room} className={styles.groupCard}>
                <h2 className={styles.groupTitle}>{group.room}</h2>
                <div className={styles.groupRows}>
                  {group.tasks.map((task) => (
                    <div key={`${group.room}-${task}`} className={styles.taskRow}>
                      <div className={styles.taskLeft}>
                        <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                        <div>
                          <p>{task}</p>
                          <small>Martes 13/05/2026</small>
                        </div>
                      </div>
                      <span className={styles.taskOwner}>Marc</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className={styles.floorWrap}>
            <div className={styles.floorImageWrap}>
              <Image src="/images/limpieza/piso.webp" alt="Plano del piso" fill className={styles.floorImage} />
              {overlayTasks.map((task, idx) => (
                <div key={idx} className={styles.overlayTask} style={{ top: task.top, left: task.left }}>
                  <Image src="/images/IconoperfilM.webp" alt="" width={18} height={18} />
                  <div>
                    <p>Barrer la cocina</p>
                    <small>Martes 13/05/2026</small>
                  </div>
                  <span>Marc</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


