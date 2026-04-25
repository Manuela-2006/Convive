"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  addShoppingListItemAction,
  clearShoppingListAction,
  deleteShoppingListItemAction,
  toggleShoppingListItemAction,
  updateMonthlyBudgetAction,
} from "../../app/backend/endpoints/area-grupal/actions";
import { removeHouseMemberAction } from "../../app/backend/endpoints/auth/actions";
import { formatCurrency } from "../../lib/dashboard-presenters";
import type { AreaGrupalDashboardData } from "../../lib/dashboard-types";
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
import { Button } from "../ui/button";
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
  data: AreaGrupalDashboardData;
};

const PIE_COLORS = ["#78A978", "#8FB7D8", "#E9B553", "#CE9A6C", "#BE6F8B", "#8B1A2F", "#A59A90"];

function toNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number(String(value ?? 0));

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatPercentChange(percentChange: number | null) {
  if (percentChange === null) {
    return "Sin datos comparables del mes anterior";
  }

  if (percentChange === 0) {
    return "Igual que el mes pasado";
  }

  return `${Math.abs(percentChange)}% ${
    percentChange > 0 ? "más" : "menos"
  } que el mes pasado`;
}

function formatComparisonMeta(percentChange: number | null) {
  return formatPercentChange(percentChange).replace(
    " del mes anterior",
    " del\nmes anterior"
  );
}

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
  data,
}: AreaGrupalScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newItemText, setNewItemText] = useState("");
  const [budgetInput, setBudgetInput] = useState(
    String(toNumber(data.shared_funds.budget_amount))
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const basePath = dashboardPath ?? `/dashboard/${houseCode}`;
  const inviteHref = inviteCode
    ? `/login?flow=join&code=${encodeURIComponent(inviteCode)}`
    : null;
  const budgetAmount = toNumber(data.shared_funds.budget_amount);
  const spentAmount = toNumber(data.shared_funds.spent_amount);
  const progressBase = budgetAmount + spentAmount;
  const progressValue =
    progressBase > 0 ? Math.min((spentAmount / progressBase) * 100, 100) : 0;
  const isOverBudget = spentAmount > budgetAmount && budgetAmount > 0;
  const distributionData = data.distribution.map((item, index) => ({
    ...item,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const runAction = (action: () => Promise<void>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      await action();
    });
  };

  const handleAddItem = () => {
    const normalizedText = newItemText.trim();
    if (!normalizedText) {
      setErrorMessage("Escribe un artículo para añadirlo a la lista.");
      return;
    }

    runAction(async () => {
      const result = await addShoppingListItemAction({
        houseCode,
        dashboardPath: basePath,
        text: normalizedText,
      });

      if (result.success) {
        setNewItemText("");
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleToggleItem = (itemId: string) => {
    runAction(async () => {
      const result = await toggleShoppingListItemAction({
        houseCode,
        dashboardPath: basePath,
        itemId,
      });

      if (result.success) {
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleDeleteItem = (itemId: string) => {
    runAction(async () => {
      const result = await deleteShoppingListItemAction({
        houseCode,
        dashboardPath: basePath,
        itemId,
      });

      if (result.success) {
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleClearShoppingList = () => {
    runAction(async () => {
      const result = await clearShoppingListAction({
        houseCode,
        dashboardPath: basePath,
      });

      if (result.success) {
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleSaveBudget = () => {
    const parsedAmount = Number(budgetInput.replace(",", "."));

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setErrorMessage("Introduce un presupuesto mensual válido.");
      return;
    }

    runAction(async () => {
      const result = await updateMonthlyBudgetAction({
        houseCode,
        dashboardPath: basePath,
        amount: parsedAmount,
      });

      if (result.success) {
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleRemoveParticipant = (profileId: string, displayName: string) => {
    runAction(async () => {
      const result = await removeHouseMemberAction({
        houseCode,
        dashboardPath: basePath,
        profileId,
      });

      if (result.success) {
        setSuccessMessage(`${displayName} eliminado del piso.`);
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
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
                {data.members.length ? (
                  data.members.map((member) => (
                    <div key={member.profile_id} className={styles.memberItem}>
                      <Image
                        src={member.avatar_url || "/images/IconoperfilM.webp"}
                        alt={member.display_name}
                        width={28}
                        height={28}
                      />
                      <span>{member.display_name}</span>
                      {canManageInvites ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className={styles.memberDeleteButton}
                              disabled={isPending}
                            >
                              Eliminar
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar participante</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción sacará a {member.display_name} del piso sin borrar
                                su historial. ¿Quieres continuar?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemoveParticipant(member.profile_id, member.display_name)
                                }
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyInline}>No hay miembros activos.</p>
                )}
              </div>
            </div>
            <div className={styles.inviteBox}>
              {canManageInvites && inviteCode ? (
                <>
                  <p className={styles.code}>
                    <span className={styles.codeLabel}>CODIGO DE INVITACION</span>
                    <span className={styles.codeValue}>{inviteCode}</span>
                  </p>
                  <Link href={inviteHref ?? "#"} className={styles.inviteLink}>
                    Invitar al piso
                  </Link>
                </>
              ) : (
                <p className={styles.code}>
                  <span className={styles.codeLabel}>CODIGO PUBLICO DEL PISO</span>
                  <span className={styles.codeValue}>{houseCode}</span>
                </p>
              )}
            </div>
          </Card>

          {errorMessage ? <p className={styles.feedbackMessage}>{errorMessage}</p> : null}
          {successMessage ? <p className={styles.successMessage}>{successMessage}</p> : null}

          <div className={styles.gridTwo}>
            <Card className={`${styles.whiteCard} ${styles.shoppingCard}`}>
              <div className={styles.listHeader}>
                <h3 className={styles.whiteTitle}>Lista de la compra</h3>
                <button
                  type="button"
                  className={styles.clearListButton}
                  onClick={handleClearShoppingList}
                  disabled={isPending || data.shopping_list.length === 0}
                >
                  Borrar todo
                </button>
              </div>
              <div className={styles.shoppingList}>
                {data.shopping_list.length ? (
                  data.shopping_list.map((item) => (
                    <div key={item.item_id} className={styles.shoppingItem}>
                      <label className={styles.shoppingLabel}>
                        <Checkbox
                          className={styles.checkbox}
                          checked={item.is_checked}
                          onCheckedChange={() => handleToggleItem(item.item_id)}
                          disabled={isPending}
                        />
                        <span
                          className={item.is_checked ? styles.shoppingTextChecked : ""}
                        >
                          {item.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        className={styles.deleteItemButton}
                        onClick={() => handleDeleteItem(item.item_id)}
                        disabled={isPending}
                        aria-label="Borrar artículo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>La lista está vacía.</p>
                )}
              </div>
              <div className={styles.addRow}>
                <Input
                  placeholder="Escribe el nuevo articulo"
                  className={styles.newInput}
                  value={newItemText}
                  onChange={(event) => setNewItemText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddItem();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.addItemButton}
                  onClick={handleAddItem}
                  disabled={isPending}
                  aria-label="Añadir artículo"
                >
                  <Plus size={16} className={styles.plusSmall} />
                </button>
              </div>
            </Card>

            <Card className={`${styles.whiteCard} ${styles.fundsCard}`}>
              <h3 className={styles.whiteTitle}>Fondos compartidos</h3>
              <div className={styles.moneyRows}>
                <p>
                  <span>Presupuesto</span>
                  <strong className={styles.budgetAmount}>
                    {formatCurrency(data.shared_funds.budget_amount)}
                  </strong>
                </p>
                <p>
                  <span>Gastado</span>
                  <strong className={isOverBudget ? styles.spentAmountOver : styles.spentAmount}>
                    {formatCurrency(data.shared_funds.spent_amount)}
                  </strong>
                </p>
              </div>
              <Progress value={progressValue} className={styles.progressRoot} />
              {canManageInvites && data.shared_funds.can_edit_budget ? (
                <div className={styles.budgetEditor}>
                  <Input
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    className={styles.budgetInput}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <Button
                    className={styles.budgetSaveButton}
                    onClick={handleSaveBudget}
                    disabled={isPending}
                  >
                    Guardar
                  </Button>
                </div>
              ) : null}
            </Card>
          </div>

          <Card className={styles.maroonCard}>
            <h3 className={styles.maroonTitle}>Gastos del mes</h3>
            <p className={styles.monthValue}>
              {formatCurrency(data.monthly_expenses.current_total)}
            </p>
            <p className={styles.monthMeta}>
              {formatPercentChange(data.monthly_expenses.percent_change)}
            </p>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data.monthly_expenses.series}
                  margin={{ top: 10, right: 18, left: 10, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month_label"
                    tick={{ fill: "#F0EAE4", fontSize: 12 }}
                    axisLine={{ stroke: "#F0EAE4" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={false}
                    formatter={(value) => [formatCurrency(value as number), "Total"]}
                    contentStyle={{ color: "#111111" }}
                    labelStyle={{ color: "#111111" }}
                    itemStyle={{ color: "#111111" }}
                  />
                  <Bar dataKey="total_amount" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    {data.monthly_expenses.series.map((entry) => (
                      <Cell
                        key={entry.month_key}
                        fill={entry.is_current_month ? "#BE6F8B" : "#F0EAE4"}
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
                    <Pie
                      data={distributionData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={58}
                      innerRadius={34}
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(value as number),
                        name,
                      ]}
                      contentStyle={{ color: "#111111" }}
                      labelStyle={{ color: "#111111" }}
                      itemStyle={{ color: "#111111" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className={styles.legend}>
                  {distributionData.length ? (
                    distributionData.map((entry) => (
                      <li key={entry.name}>
                        <span style={{ background: entry.color }} />
                        {entry.name}
                      </li>
                    ))
                  ) : (
                    <li>Sin gastos este mes</li>
                  )}
                </ul>
              </div>
            </Card>

            <Card className={styles.whiteCard}>
              <h3 className={styles.whiteTitle}>Comparativas de meses</h3>
              <ul className={styles.compareList}>
                {data.comparisons.length ? (
                  data.comparisons.map((item) => {
                    const trend = getTrend(
                      toNumber(item.current_amount),
                      toNumber(item.previous_amount)
                    );

                    return (
                      <li key={item.name}>
                        <div className={styles.compareLeft}>
                          <Image
                            src="/images/IconoperfilH.webp"
                            alt=""
                            width={20}
                            height={20}
                          />
                          <div>
                        <p>{item.name}</p>
                            <small>{formatComparisonMeta(item.percent_change)}</small>
                          </div>
                        </div>
                        <div className={styles.compareRight}>
                          <strong>{formatCurrency(item.current_amount)}</strong>
                          <span className={styles.arrowSlot} aria-hidden="true">
                            {trend === "up" ? <ArrowUp size={14} /> : null}
                            {trend === "down" ? <ArrowDown size={14} /> : null}
                          </span>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className={styles.compareEmpty}>Sin comparativas todavía.</li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
