"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  completeCleaningTaskAction,
  createCleaningTaskAction,
  loadCleaningTaskHistoryAction,
  rotateCleaningTasksAction,
} from "../../app/backend/endpoints/limpieza/actions";
import type {
  AddCleaningTaskFormOptions,
  CleaningTask,
  CleaningZoneSection,
} from "../../lib/dashboard-types";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ProfileAvatar } from "../ui/profile-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import styles from "./limpieza-screen.module.css";

type LimpiezaScreenProps = {
  houseCode: string;
  dashboardPath: string;
  zones: CleaningZoneSection[];
  formOptions: AddCleaningTaskFormOptions;
};

type ZoneBounds = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

function formatDate(date?: Date) {
  if (!date) return "Selecciona una fecha";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTaskDate(dateValue: string) {
  if (!dateValue) {
    return "Sin fecha";
  }

  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function formatCompletedAt(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const formattedDate = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
  const formattedTime = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);

  return `Hecha el ${formattedDate} a las ${formattedTime}`;
}

function formatStatus(status: string) {
  if (status === "done") {
    return "Hecha";
  }

  if (status === "archived") {
    return "Archivada";
  }

  return "Pendiente";
}

function normalizeManualZone(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toIsoDate(date?: Date) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeZoneKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^zona-/, "")
    .replace(/^zone-/, "")
    .replace(/ã±|Ã±|ñ/g, "n")
    .replace(/ã¡|Ã¡|á/g, "a")
    .replace(/ã©|Ã©|é/g, "e")
    .replace(/ã­|Ã­|í/g, "i")
    .replace(/ã³|Ã³|ó/g, "o")
    .replace(/ãº|Ãº|ú/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSvgZoneKey(
  zoneName: string,
  availableZoneKeys: Set<string>
) {
  const normalized = normalizeZoneKey(zoneName);
  const compact = normalized.replace(/-/g, "");

  const candidates = [
    normalized,
    compact,
    normalized.replace(/^zona-/, ""),
    compact.replace(/^zona/, ""),
  ];

  if (compact.includes("cocina")) candidates.push("cocina");
  if (compact.includes("salon")) candidates.push("salon");
  if (compact.includes("recibidor")) candidates.push("recibidor");
  if (compact.includes("comedor")) candidates.push("comedor");
  if (compact.includes("bano")) candidates.push("bano");

  for (const candidate of candidates) {
    if (availableZoneKeys.has(candidate)) {
      return candidate;
    }
  }

  for (const key of availableZoneKeys) {
    if (compact.includes(key) || key.includes(compact)) {
      return key;
    }
  }

  return null;
}

export function LimpiezaScreen({
  houseCode,
  dashboardPath,
  zones,
  formOptions,
}: LimpiezaScreenProps) {
  const router = useRouter();
  const basePath = dashboardPath;
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRotateOpen, setIsRotateOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState<string | null>(null);
  const [historyTasks, setHistoryTasks] = useState<CleaningTask[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const [title, setTitle] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState(
    formOptions.zones[0]?.zone_id ?? ""
  );
  const [manualZoneName, setManualZoneName] = useState("");
  const [assignedProfileId, setAssignedProfileId] = useState(
    formOptions.members[0]?.profile_id ?? ""
  );
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [rotateNote, setRotateNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoneBounds, setZoneBounds] = useState<Record<string, ZoneBounds>>({});
  const floorWrapRef = useRef<HTMLDivElement | null>(null);
  const floorObjectRef = useRef<HTMLObjectElement | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const hasMembers = formOptions.members.length > 0;
  const memberAvatarUrlByProfileId = useMemo(
    () =>
      new Map(
        formOptions.members.map((member) => [
          member.profile_id,
          member.avatar_url,
        ])
      ),
    [formOptions.members]
  );
  const getTaskAvatarUrl = (task: CleaningTask) =>
    task.assigned_to_profile_id
      ? memberAvatarUrlByProfileId.get(task.assigned_to_profile_id) ?? null
      : null;
  const pendingTasksByZone = useMemo(() => {
    const grouped = new Map<string, CleaningTask[]>();
    const availableZoneKeys = new Set(Object.keys(zoneBounds));

    if (!availableZoneKeys.size) {
      // Fallback mientras carga el SVG
      ["cocina", "salon", "recibidor", "comedor", "bano"].forEach((key) =>
        availableZoneKeys.add(key)
      );
    }

    for (const zone of zones) {
      const key = resolveSvgZoneKey(zone.zone_name, availableZoneKeys);
      if (!key) continue;

      const pendingTasks = zone.tasks.filter((task) => task.status === "pending");
      if (!pendingTasks.length) continue;

      grouped.set(key, pendingTasks);
    }

    return grouped;
  }, [zones, zoneBounds]);

  const refreshDashboard = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
      refreshTimeoutRef.current = null;
    }, 220);
  }, [router]);

  const recalculateZoneBounds = useCallback(() => {
    const svgObject = floorObjectRef.current;
    const svgDocument = svgObject?.contentDocument;

    if (!svgDocument) {
      setZoneBounds({});
      return;
    }

    const rootSvg = svgDocument.querySelector("svg");
    if (rootSvg) {
      rootSvg.setAttribute("width", "100%");
      rootSvg.setAttribute("height", "100%");
      rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      rootSvg.style.width = "100%";
      rootSvg.style.height = "100%";
      rootSvg.style.display = "block";
    }
    const viewBox =
      rootSvg?.getAttribute("viewBox")?.trim() ||
      "0 0 898 601";
    const viewBoxParts = viewBox.split(/\s+/).map((part) => Number(part));
    const viewBoxWidth = viewBoxParts[2] || 898;
    const viewBoxHeight = viewBoxParts[3] || 601;
    const nextBounds: Record<string, ZoneBounds> = {};
    const zoneNodes = svgDocument.querySelectorAll<SVGGraphicsElement>(
      "[id^='zona-'], [id^='zone-']"
    );

    zoneNodes.forEach((zoneNode) => {
      if (!zoneNode.id) return;

      const key = normalizeZoneKey(zoneNode.id);
      if (!key) return;

      const rect = zoneNode.querySelector("rect");
      if (!rect) return;

      const width = Number(rect.getAttribute("width") || 0);
      const height = Number(rect.getAttribute("height") || 0);
      if (!width || !height) return;

      const transform = rect.getAttribute("transform") || "";
      const translateMatch = transform.match(
        /translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)/i
      );
      const translateX = translateMatch ? Number(translateMatch[1] || 0) : 0;
      const translateY = translateMatch
        ? Number(translateMatch[2] || 0)
        : 0;

      const x = Number(rect.getAttribute("x") || 0) + translateX;
      const y = Number(rect.getAttribute("y") || 0) + translateY;

      const leftPct = (x / viewBoxWidth) * 100;
      const topPct = (y / viewBoxHeight) * 100;
      const widthPct = (width / viewBoxWidth) * 100;
      const heightPct = (height / viewBoxHeight) * 100;

      if (widthPct <= 0 || heightPct <= 0) return;

      nextBounds[key] = { leftPct, topPct, widthPct, heightPct };
    });

    setZoneBounds(nextBounds);
  }, []);

  useEffect(() => {
    const svgObject = floorObjectRef.current;
    if (!svgObject) return;

    const onLoad = () => recalculateZoneBounds();
    svgObject.addEventListener("load", onLoad);
    onLoad();

    return () => {
      svgObject.removeEventListener("load", onLoad);
    };
  }, [recalculateZoneBounds]);

  useEffect(() => {
    const wrapper = floorWrapRef.current;
    if (!wrapper) return;

    const resizeObserver = new ResizeObserver(() => {
      recalculateZoneBounds();
    });
    resizeObserver.observe(wrapper);

    const onWindowResize = () => recalculateZoneBounds();
    window.addEventListener("resize", onWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [recalculateZoneBounds]);

  useEffect(() => {
    recalculateZoneBounds();
  }, [zones, recalculateZoneBounds]);

  useEffect(() => {
    const channel = supabase
      .channel(`cleaning-tasks-${houseCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cleaning_tasks",
        },
        () => {
          refreshDashboard();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [supabase, houseCode, refreshDashboard]);

  const resetAddForm = () => {
    setTitle("");
    setSelectedZoneId(formOptions.zones[0]?.zone_id ?? "");
    setManualZoneName("");
    setAssignedProfileId(formOptions.members[0]?.profile_id ?? "");
    setDate(new Date());
    setNotes("");
    setErrorMessage(null);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((item) => item !== taskId);
      }

      return [...current, taskId].slice(-2);
    });
  };

  const handleOpenTask = (task: CleaningTask) => {
    setSelectedTask(task);
    setErrorMessage(null);
  };

  const handleSaveTask = () => {
    const normalizedTitle = title.trim();
    const dueDate = toIsoDate(date);
    const normalizedManualZone = normalizeManualZone(manualZoneName);
    const zoneId = normalizedManualZone ? null : selectedZoneId || null;
    const customZoneName = normalizedManualZone || null;

    if (!normalizedTitle) {
      setErrorMessage("Introduce un título para la tarea.");
      return;
    }

    if (!zoneId && !customZoneName) {
      setErrorMessage("Selecciona una zona o escribe una zona manual.");
      return;
    }

    if (!hasMembers || !assignedProfileId) {
      setErrorMessage("Selecciona una persona asignada.");
      return;
    }

    if (!dueDate) {
      setErrorMessage("Selecciona la fecha de la tarea.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await createCleaningTaskAction({
        houseCode,
        dashboardPath: basePath,
        title: normalizedTitle,
        dueDate,
        assignedProfileId,
        zoneId,
        customZoneName,
        notes: notes.trim() ? notes : null,
      });

      if (result.success) {
        resetAddForm();
        setIsAddOpen(false);
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleRotateTasks = () => {
    if (selectedTaskIds.length !== 2) {
      setErrorMessage("Selecciona exactamente 2 tareas para rotar.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await rotateCleaningTasksAction({
        houseCode,
        dashboardPath: basePath,
        taskAId: selectedTaskIds[0],
        taskBId: selectedTaskIds[1],
        note: rotateNote.trim() ? rotateNote : null,
      });

      if (result.success) {
        setSelectedTaskIds([]);
        setRotateNote("");
        setIsRotateOpen(false);
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleCompleteTask = () => {
    if (!selectedTask?.task_id) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await completeCleaningTaskAction({
        houseCode,
        dashboardPath: basePath,
        taskId: selectedTask.task_id,
      });

      if (result.success) {
        setSelectedTask(null);
        setSelectedTaskIds((current) =>
          current.filter((taskId) => taskId !== result.data.taskId)
        );
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleOpenHistory = (zone: CleaningZoneSection | null) => {
    setHistoryTitle(zone ? zone.zone_name : "Historial");
    setHistoryTasks([]);
    setHasLoadedHistory(false);
    setErrorMessage(null);

    startHistoryTransition(async () => {
      const result = await loadCleaningTaskHistoryAction({
        houseCode,
        zoneId: zone?.zone_id ?? null,
        zoneName: zone?.zone_name ?? null,
      });

      if (result.success) {
        setHistoryTasks(result.data);
        setHasLoadedHistory(true);
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }

      setHasLoadedHistory(true);
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
            <h1 className={styles.title}>Limpieza</h1>
            <p className={styles.subtitle}>Tareas del piso por zona</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={styles.headerPlusLink}
                  aria-label="Anadir tarea"
                  onClick={() => setIsAddOpen(true)}
                >
                  <Image
                    src="/iconos/A%C3%B1adir.svg"
                    alt="Anadir"
                    width={24}
                    height={24}
                    className={styles.headerPlusIcon}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Añadir tarea</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        <div
          className={`${styles.content} ${
            isAddOpen || historyTitle ? styles.contentSingle : ""
          }`}
        >
          {isAddOpen ? (
            <Card className={styles.addTaskInlineCard}>
              <div className={styles.addTaskCardTop}>
                <button
                  type="button"
                  className={styles.addTaskInlineBack}
                  aria-label="Volver"
                  onClick={() => {
                    setIsAddOpen(false);
                    setErrorMessage(null);
                  }}
                >
                  <Image src="/iconos/flechaatras.svg" alt="" width={32} height={32} />
                </button>
                <h2 className={styles.addTaskCardTitle}>Añadir tarea</h2>
              </div>

              <div className={styles.addTaskBlocks}>
                <section className={styles.addTaskBlock}>
                  <h3 className={styles.addTaskBlockTitle}>1 - Titulo de la tarea</h3>
                  <input
                    className={styles.fieldInput}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ej. Limpiar cocina"
                  />
                </section>

                <section className={styles.addTaskBlock}>
                  <h3 className={styles.addTaskBlockTitle}>2 - Zona de la tarea</h3>
                  <div className={styles.addTaskTwoCols}>
                    <label className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Zona existente</span>
                      <select
                        className={styles.fieldSelect}
                        value={selectedZoneId}
                        onChange={(event) => {
                          setSelectedZoneId(event.target.value);
                          setManualZoneName("");
                        }}
                      >
                        <option value="">Selecciona una zona</option>
                        {formOptions.zones.map((zone) => (
                          <option key={zone.zone_id} value={zone.zone_id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Zona manual</span>
                      <input
                        className={styles.fieldInput}
                        value={manualZoneName}
                        onChange={(event) => setManualZoneName(event.target.value)}
                        placeholder="Ej. Trastero"
                      />
                    </label>
                  </div>
                </section>

                <section className={styles.addTaskBlock}>
                  <h3 className={styles.addTaskBlockTitle}>3 - Persona asignada</h3>
                  <label className={styles.fieldGroup}>
                    <select
                      className={styles.fieldSelect}
                      value={assignedProfileId}
                      onChange={(event) => setAssignedProfileId(event.target.value)}
                      disabled={!hasMembers}
                    >
                      <option value="">Selecciona una persona</option>
                      {formOptions.members.map((member) => (
                        <option key={member.profile_id} value={member.profile_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className={styles.addTaskBlock}>
                  <h3 className={styles.addTaskBlockTitle}>4 - Fecha de la tarea</h3>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button className={styles.dateTrigger}>
                        {formatDate(date)}
                        <Image
                          src="/iconos/flechascalendario.svg"
                          alt=""
                          width={14}
                          height={14}
                          className={styles.dateArrow}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={styles.calendarPopover}>
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className={styles.calendar}
                      />
                    </PopoverContent>
                  </Popover>
                </section>

                <section className={styles.addTaskBlock}>
                  <h3 className={styles.addTaskBlockTitle}>5 - Notas</h3>
                  <label className={styles.fieldGroup}>
                    <textarea
                      className={styles.fieldTextarea}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={4}
                      placeholder="Añade contexto útil para esta tarea"
                    />
                  </label>
                </section>
              </div>

              {errorMessage ? (
                <p className={styles.feedbackMessage}>{errorMessage}</p>
              ) : null}

              <div className={`${styles.modalActions} ${styles.addTaskSaveWrap}`}>
                <Button
                  className={styles.saveButton}
                  onClick={handleSaveTask}
                  disabled={isPending}
                >
                  {isPending ? "Guardando..." : "Guardar tarea"}
                </Button>
              </div>
            </Card>
          ) : historyTitle ? (
            <Card className={styles.historyInlineCard}>
              <div className={styles.historyCardTop}>
                <button
                  type="button"
                  className={styles.historyInlineBack}
                  aria-label="Volver"
                  onClick={() => {
                    setHistoryTitle(null);
                    setHistoryTasks([]);
                    setHasLoadedHistory(false);
                    setErrorMessage(null);
                  }}
                >
                  <Image src="/iconos/flechaatras.svg" alt="" width={32} height={32} />
                </button>
                <h2 className={styles.historyCardTitle}>{historyTitle}</h2>
              </div>

              {errorMessage ? (
                <p className={styles.feedbackMessage}>{errorMessage}</p>
              ) : null}

              <div className={styles.historyList}>
                {isHistoryPending || !hasLoadedHistory ? (
                  <p className={styles.emptyModalText}>Cargando historial...</p>
                ) : historyTasks.length ? (
                  historyTasks.map((task) => (
                    <div key={task.task_id} className={styles.historyRow}>
                      <div className={styles.historyMain}>
                        <ProfileAvatar
                          src={getTaskAvatarUrl(task)}
                          alt=""
                          width={22}
                          height={22}
                        />
                        <div>
                          <p>{task.title}</p>
                          <small>{task.assigned_to_name || "Sin asignar"}</small>
                          <small>{formatTaskDate(task.due_date)}</small>
                        </div>
                      </div>
                      <span>{formatStatus(task.status)}</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyModalText}>No hay historial.</p>
                )}
              </div>
            </Card>
          ) : (
            <>
              <div className={styles.floorWrap}>
                <div className={styles.floorImageWrap} ref={floorWrapRef}>
                  <object
                    ref={floorObjectRef}
                    data="/images/limpieza/piso.svg"
                    type="image/svg+xml"
                    aria-label="Plano interactivo del piso"
                    className={styles.floorSvgObject}
                  />
                  <div className={styles.floorOverlayLayer}>
                    {Object.entries(zoneBounds).map(([zoneKey, bounds]) => {
                      const tasks = pendingTasksByZone.get(zoneKey) ?? [];
                      if (!tasks.length) return null;

                      return (
                        <div
                          key={zoneKey}
                          className={styles.zoneOverlay}
                          style={{
                            left: `${bounds.leftPct}%`,
                            top: `${bounds.topPct}%`,
                            width: `${bounds.widthPct}%`,
                            height: `${bounds.heightPct}%`,
                          }}
                        >
                          {tasks.map((task) => (
                            <button
                              key={task.task_id}
                              type="button"
                              className={styles.floorTaskCard}
                              onClick={() => handleOpenTask(task)}
                            >
                              <ProfileAvatar
                                src={getTaskAvatarUrl(task)}
                                alt=""
                                width={18}
                                height={18}
                              />
                              <div>
                                <p>{task.title}</p>
                                <small>{task.assigned_to_name || "Sin asignar"}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={styles.leftCol}>
                <div className={styles.topActions}>
                  <Button
                    className={styles.topButton}
                    onClick={() => {
                      setIsRotateOpen(true);
                      setErrorMessage(null);
                    }}
                  >
                    <span className={styles.topButtonContent}>
                      Rotar
                      <Image src="/iconos/rotar.svg" alt="" width={16} height={16} />
                    </span>
                  </Button>
                  <button
                    type="button"
                    className={styles.topViewAllLink}
                    onClick={() => handleOpenHistory(null)}
                  >
                    <span className={styles.viewAllContent}>
                      Ver todo
                      <Image
                        src="/iconos/flechascalendario.svg"
                        alt=""
                        width={20}
                        height={20}
                        className={styles.viewAllArrow}
                      />
                    </span>
                  </button>
                </div>
                <div className={styles.groupsScroll}>
                  {zones.length ? (
                    zones.map((zone) => (
                      <Card
                        key={`${zone.zone_id ?? "custom"}-${zone.zone_name}`}
                        className={styles.groupCard}
                      >
                        <div className={styles.groupHeader}>
                          <h2 className={styles.groupTitle}>{zone.zone_name}</h2>
                          <button
                            type="button"
                            className={styles.viewAllButton}
                            onClick={() => handleOpenHistory(zone)}
                          >
                            <span className={styles.viewAllContent}>
                              Ver todo
                              <Image
                                src="/iconos/flechascalendario.svg"
                                alt=""
                                width={20}
                                height={20}
                                className={styles.viewAllArrow}
                              />
                            </span>
                          </button>
                        </div>
                        <div className={styles.groupRows}>
                          {zone.tasks.length ? (
                            zone.tasks.map((task) => (
                              <div key={task.task_id} className={styles.taskRow}>
                                <Checkbox
                                  className={styles.taskCheckbox}
                                  checked={selectedTaskIds.includes(task.task_id)}
                                  onCheckedChange={() => toggleTaskSelection(task.task_id)}
                                  disabled={!task.task_id}
                                />
                                <button
                                  type="button"
                                  className={styles.taskDetailsButton}
                                  onClick={() => handleOpenTask(task)}
                                >
                                  <div className={styles.taskLeft}>
                                    <ProfileAvatar
                                      src={getTaskAvatarUrl(task)}
                                      alt=""
                                      width={22}
                                      height={22}
                                    />
                                <div>
                                  <p>{task.title}</p>
                                  <small className={styles.taskAssignee}>
                                    {task.assigned_to_name || "Sin asignar"}
                                  </small>
                                  <small>{formatTaskDate(task.due_date)}</small>
                                </div>
                              </div>
                            </button>
                          </div>
                            ))
                          ) : (
                            <p className={styles.emptyText}>No hay tareas en esta zona.</p>
                          )}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <p className={styles.emptyText}>No hay tareas de limpieza.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {selectedTask ? (
        <div className={styles.modalBackdrop}>
          <Card className={styles.modalCard}>
            <div className={styles.modalTop}>
              <div className={styles.modalHeading}>
                <button
                  type="button"
                  className={styles.modalBackButton}
                  onClick={() => {
                    setSelectedTask(null);
                    setErrorMessage(null);
                  }}
                  aria-label="Volver"
                >
                  <Image src="/iconos/flechaatras.svg" alt="" width={34} height={34} />
                </button>
                <h2 className={styles.modalTitle}>{selectedTask.title}</h2>
              </div>
            </div>

            <dl className={styles.taskInfoList}>
              <div>
                <dt>Notas</dt>
                <dd>{selectedTask.notes || "Sin notas"}</dd>
              </div>
              <div>
                <dt>Zona</dt>
                <dd>{selectedTask.zone_name || "Sin zona"}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatTaskDate(selectedTask.due_date)}</dd>
              </div>
              <div>
                <dt>Persona asignada</dt>
                <dd>{selectedTask.assigned_to_name || "Sin asignar"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{formatStatus(selectedTask.status)}</dd>
              </div>
            </dl>

            {errorMessage ? (
              <p className={styles.feedbackMessage}>{errorMessage}</p>
            ) : null}

            <div className={styles.modalActions}>
              <Button
                className={styles.saveButton}
                onClick={handleCompleteTask}
                disabled={isPending || selectedTask.status !== "pending"}
              >
                {isPending ? "Marcando..." : "Marcar como hecha"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {isRotateOpen ? (
        <div className={styles.modalBackdrop}>
          <Card className={styles.modalCard}>
            <div className={styles.modalTop}>
              <h2 className={styles.modalTitle}>Rotar tareas</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => {
                  setIsRotateOpen(false);
                  setErrorMessage(null);
                }}
              >
                Cerrar
              </button>
            </div>
            <p className={styles.modalCopy}>
              Seleccionadas: {selectedTaskIds.length}/2
            </p>
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Nota</span>
              <textarea
                className={styles.fieldTextarea}
                value={rotateNote}
                onChange={(event) => setRotateNote(event.target.value)}
                rows={3}
              />
            </label>
            {errorMessage ? (
              <p className={styles.feedbackMessage}>{errorMessage}</p>
            ) : null}
            <div className={styles.modalActions}>
              <Button
                className={styles.saveButton}
                onClick={handleRotateTasks}
                disabled={isPending || selectedTaskIds.length !== 2}
              >
                {isPending ? "Rotando..." : "Confirmar rotacion"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </main>
  );
}

