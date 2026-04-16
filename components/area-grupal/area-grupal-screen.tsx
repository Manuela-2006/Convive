"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import styles from "./area-grupal-screen.module.css";

type AreaGrupalScreenProps = {
  houseCode: string;
  dashboardPath: string;
  inviteCode: string | null;
  canManageInvites: boolean;
};

const barData = [
  { month: "Ene", value: 900 },
  { month: "Feb", value: 1200 },
  { month: "Mar", value: 1000 },
  { month: "Abr", value: 1250 },
];

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

const pieData = [
  { name: "Alquiler", value: 35, color: "#78A978" },
  { name: "Agua", value: 12, color: "#8FB7D8" },
  { name: "Luz", value: 14, color: "#E9B553" },
  { name: "Wifi", value: 11, color: "#CE9A6C" },
  { name: "Compras", value: 18, color: "#BE6F8B" },
  { name: "Suscripciones", value: 10, color: "#8B1A2F" },
];

const compareItems = [
  { name: "Luz", currentAmount: 50, previousAmount: 43, text: "15% mas que el mes pasado" },
  { name: "Agua", currentAmount: 50, previousAmount: 43, text: "15% mas que el mes pasado" },
  { name: "Alquiler", currentAmount: 50, previousAmount: 43, text: "15% mas que el mes pasado" },
  { name: "Wifi", currentAmount: 50, previousAmount: 50, text: "Igual que el ano pasado" },
];

function getTrend(currentAmount: number, previousAmount: number) {
  if (currentAmount > previousAmount) return "up";
  if (currentAmount < previousAmount) return "down";
  return "equal";
}

export function AreaGrupalScreen({
  houseCode,
  dashboardPath,
  inviteCode,
  canManageInvites,
}: AreaGrupalScreenProps) {
  const budgetAmount = 50;
  const spentAmount = 30;
  const isOverBudget = spentAmount > budgetAmount;
  const [currentMonthLabel, setCurrentMonthLabel] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMonthLabel(MONTH_LABELS[new Date().getMonth()]);
  }, []);

  const basePath = dashboardPath ?? `/dashboard/${houseCode}`;
  const inviteHref = inviteCode
    ? `/login?flow=join&code=${encodeURIComponent(inviteCode)}`
    : null;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Area grupal</h1>
            <p className={styles.subtitle}>Organizacion y vida en el piso</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.membersCard}>
            <div>
              <h2 className={styles.sectionTitle}>Miembros del piso</h2>
              <div className={styles.membersRow}>
                {["Laura", "Samanta", "Julia", "Estela"].map((name) => (
                  <div key={name} className={styles.memberItem}>
                    <Image src="/images/IconoperfilM.webp" alt={name} width={28} height={28} />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.inviteBox}>
              {canManageInvites && inviteCode ? (
                <>
                  <p className={styles.code}>CODIGO DE INVITACION: {inviteCode}</p>
                  <Link href={inviteHref ?? "#"} className={styles.inviteLink}>
                    Invitar al piso
                  </Link>
                </>
              ) : (
                <p className={styles.code}>CODIGO PUBLICO DEL PISO: {houseCode}</p>
              )}
            </div>
          </Card>

          <div className={styles.gridTwo}>
            <Card className={styles.whiteCard}>
              <h3 className={styles.whiteTitle}>Lista de la compra</h3>
              <div className={styles.checkList}>
                <label><Checkbox className={styles.checkbox} /> Leche</label>
                <label><Checkbox className={styles.checkbox} /> Huevos</label>
                <label><Checkbox className={styles.checkbox} /> Agua</label>
              </div>
              <div className={styles.addRow}>
                <Input placeholder="Escribe el nuevo articulo" className={styles.newInput} />
                <Plus size={16} className={styles.plusSmall} />
              </div>
            </Card>

            <Card className={styles.whiteCard}>
              <h3 className={styles.whiteTitle}>Fondos compartidos</h3>
              <div className={styles.moneyRows}>
                <p>
                  <span>Presupuesto</span>
                  <strong className={styles.budgetAmount}>{`${budgetAmount}\u20AC`}</strong>
                </p>
                <p>
                  <span>Gastado</span>
                  <strong className={isOverBudget ? styles.spentAmountOver : styles.spentAmount}>
                    {`${spentAmount}\u20AC`}
                  </strong>
                </p>
              </div>
              <Progress value={60} className={styles.progressRoot} />
            </Card>
          </div>

          <Card className={styles.maroonCard}>
            <h3 className={styles.maroonTitle}>Gastos del mes</h3>
            <p className={styles.monthValue}>1500€</p>
            <p className={styles.monthMeta}>15% mas que el mes pasado</p>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 10, right: 18, left: 10, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: "#F0EAE4", fontSize: 12 }} axisLine={{ stroke: "#F0EAE4" }} />
                  <YAxis hide />
                  <Tooltip
                    cursor={false}
                    formatter={(value) => [value, "valor"]}
                    contentStyle={{ color: "#111111" }}
                    labelStyle={{ color: "#111111" }}
                    itemStyle={{ color: "#111111" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    {barData.map((entry) => (
                      <Cell
                        key={entry.month}
                        fill={entry.month === currentMonthLabel ? "#BE6F8B" : "#F0EAE4"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className={styles.gridTwo}>
            <Card className={styles.whiteCard}>
              <h3 className={styles.whiteTitle}>Distribucion de gastos</h3>
              <div className={styles.pieRow}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={58} innerRadius={34}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      contentStyle={{ color: "#111111" }}
                      labelStyle={{ color: "#111111" }}
                      itemStyle={{ color: "#111111" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className={styles.legend}>
                  {pieData.map((entry) => (
                    <li key={entry.name}>
                      <span style={{ background: entry.color }} />
                      {entry.name}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card className={styles.whiteCard}>
              <h3 className={styles.whiteTitle}>Comparativas de meses</h3>
              <ul className={styles.compareList}>
                {compareItems.map((item) => (
                  <li key={item.name}>
                    <div className={styles.compareLeft}>
                      <Image src="/images/IconoperfilH.webp" alt="" width={20} height={20} />
                      <div>
                        <p>{item.name}</p>
                        <small>{item.text}</small>
                      </div>
                    </div>
                    <div className={styles.compareRight}>
                      <strong>{`${item.currentAmount}\u20AC`}</strong>
                      <span className={styles.arrowSlot} aria-hidden="true">
                        {getTrend(item.currentAmount, item.previousAmount) === "up" ? (
                          <ArrowUp size={14} />
                        ) : null}
                        {getTrend(item.currentAmount, item.previousAmount) === "down" ? (
                          <ArrowDown size={14} />
                        ) : null}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

