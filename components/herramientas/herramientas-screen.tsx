"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useComparador } from "../../hooks/useComparador";
import { useSimulador } from "../../hooks/useSimulador";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./herramientas-screen.module.css";

type HerramientasScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

function isSimulationTitleLine(line: string) {
  const trimmed = line.trim();
  const plainTitleLike =
    trimmed.length > 0 &&
    trimmed.length <= 48 &&
    !trimmed.includes(":") &&
    !/[.!?]$/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 4 &&
    /^[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü]*(\s+[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü]*)*$/.test(
      trimmed
    );

  return (
    /^\*{1,2}[^*]+\*{1,2}$/.test(trimmed) ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^\d+\)\s+/.test(trimmed) ||
    plainTitleLike
  );
}

function cleanSimulationTitle(line: string) {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+\)\s+/, "")
    .replace(/^\*{1,2}/, "")
    .replace(/\*{1,2}$/, "");
}

function isStarBulletLine(line: string) {
  return /^\*\s+/.test(line.trim());
}

function cleanStarBulletLine(line: string) {
  return line.trim().replace(/^\*\s+/, "");
}

function isPlusLine(line: string) {
  return /^\+\s+/.test(line.trim());
}

function cleanPlusLine(line: string) {
  return line.trim().replace(/^\+\s+/, "");
}

function renderInlineBold(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return chunks.map((chunk, index) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      return (
        <strong key={`sim-bold-${index}`} className={styles.simulationInlineBold}>
          {chunk.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={`sim-text-${index}`}>{chunk}</Fragment>;
  });
}

export function HerramientasScreen({
  houseCode,
  dashboardPath,
}: HerramientasScreenProps) {
  const [showCambioModal, setShowCambioModal] = useState(false);
  const [cambioDescripcion, setCambioDescripcion] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<"luz" | "agua" | "wifi">("luz");

  const { loading: simulando, respuesta, error: simuladorError, simular } =
    useSimulador(houseCode);
  const {
    loading: comparando,
    data: comparador,
    error: comparadorError,
    comparar,
  } = useComparador(houseCode);

  useEffect(() => {
    void comparar("luz");
  }, [comparar]);

  const onSimularEntra = () =>
    simular("entra_alguien", {
      nombre: "Nuevo miembro",
      tamano_habitacion: "mediana",
    });

  const onSimularSale = () => simular("sale_alguien", {});

  const onOpenCambioModal = () => {
    if (simulando) {
      return;
    }
    setShowCambioModal(true);
  };

  const onCloseCambioModal = () => {
    setShowCambioModal(false);
    setCambioDescripcion("");
  };

  const onSimularCambio = () => {
    const descripción = cambioDescripcion.trim();
    if (!descripción) {
      return;
    }
    void simular("cambiar_condiciones", { descripción });
    onCloseCambioModal();
  };

  return (
    <main className={styles.page}>
      {showCambioModal && (
        <div
          className={styles.cambioModalOverlay}
          onClick={onCloseCambioModal}
          role="presentation"
        >
          <div
            className={styles.cambioModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cambio-condiciones-title"
          >
            <h3 id="cambio-condiciones-title" className={styles.cambioModalTitle}>
              Cambiar condiciones
            </h3>
            <p className={styles.cambioModalText}>
              Describe que cambio quieres simular en el piso.
            </p>
            <textarea
              className={styles.cambioModalTextarea}
              value={cambioDescripcion}
              onChange={(event) => setCambioDescripcion(event.target.value)}
              placeholder="Ej: Se rompe la lavadora y hay que comprar una nueva por 450EUR"
              rows={4}
              autoFocus
            />
            <div className={styles.cambioModalActions}>
              <Button
                className={styles.cambioModalButtonGhost}
                type="button"
                onClick={onCloseCambioModal}
              >
                Cancelar
              </Button>
              <Button
                className={styles.cambioModalButtonPrimary}
                type="button"
                onClick={onSimularCambio}
                disabled={!cambioDescripcion.trim() || simulando}
              >
                Simular impacto
              </Button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${dashboardPath}/menu`} className={styles.backLink}>
            <Image
              src="/iconos/flechaatras.svg"
              alt="Volver"
              width={20}
              height={20}
              className={styles.backIcon}
            />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Herramientas</h1>
            <p className={styles.subtitle}>Simula cambios y ahorra en gastos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.whiteCard}>
            <h2 className={styles.sectionTitle}>Simulador de escenarios</h2>
            <p className={styles.sectionText}>
              Simula como afectaria a los pagos comunes, la entrada o salida de
              personas al piso o incluso el cambio en otros factores.
            </p>

            <div className={styles.actionsRow}>
              <Button
                className={styles.smallButton}
                onClick={onSimularEntra}
                disabled={simulando}
              >
                <span className={styles.buttonWithIcon}>
                  <Image
                    src="/iconos/Añadir.svg"
                    alt=""
                    width={13}
                    height={13}
                    className={styles.buttonInlineIcon}
                  />
                  <span>Entra alguien</span>
                </span>
              </Button>
              <Button
                className={styles.smallButton}
                onClick={onSimularSale}
                disabled={simulando}
              >
                - Sale alguien
              </Button>
              <Button
                className={styles.smallButton}
                onClick={onOpenCambioModal}
                disabled={simulando}
              >
                Cambiar condiciones
              </Button>
            </div>

            {simulando && (
              <p className={styles.helperText}>La IA esta analizando tu piso...</p>
            )}
            {simuladorError && (
              <p className={styles.errorText}>{simuladorError}</p>
            )}
            {respuesta && (
              <Card className={styles.resultCard}>
                <div className={styles.simulationText}>
                  {respuesta.split(/\r?\n/).map((line, index) => {
                    if (!line.trim()) {
                      return <div key={`sim-space-${index}`} className={styles.simulationLineSpacer} />;
                    }

                    if (isSimulationTitleLine(line)) {
                      return (
                        <p
                          key={`sim-title-${index}`}
                          className={styles.simulationTitleLine}
                          style={{
                            fontFamily:
                              'var(--font-montserrat), "Montserrat", "Poppins", sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          {cleanSimulationTitle(line)}
                        </p>
                      );
                    }

                    return (
                      <p key={`sim-line-${index}`} className={styles.simulationLine}>
                        {isStarBulletLine(line) ? (
                          <span className={styles.simulationBulletWithIcon}>
                            <Image
                              src="/iconos/flechaderecha.svg"
                              alt=""
                              width={12}
                              height={12}
                              className={styles.simulationBulletIcon}
                            />
                            <span>{renderInlineBold(cleanStarBulletLine(line))}</span>
                          </span>
                        ) : isPlusLine(line) ? (
                          <span className={styles.simulationPlusLine}>
                            <span className={styles.simulationPlusSign}>+</span>
                            <span>{renderInlineBold(cleanPlusLine(line))}</span>
                          </span>
                        ) : (
                          renderInlineBold(line)
                        )}
                      </p>
                    );
                  })}
                </div>
              </Card>
            )}
          </Card>

          <Card className={styles.maroonCard}>
            <h2 className={styles.maroonTitle}>Comparador de compañías</h2>

            <div className={styles.tabsRow}>
              <button
                className={`${styles.tab} ${
                  categoriaActiva === "luz" ? styles.tabActive : ""
                }`}
                onClick={() => {
                  setCategoriaActiva("luz");
                  void comparar("luz");
                }}
                disabled={comparando}
              >
                Luz
              </button>
              <button
                className={`${styles.tab} ${
                  categoriaActiva === "agua" ? styles.tabActive : ""
                }`}
                onClick={() => {
                  setCategoriaActiva("agua");
                  void comparar("agua");
                }}
                disabled={comparando}
              >
                Agua
              </button>
              <button
                className={`${styles.tab} ${
                  categoriaActiva === "wifi" ? styles.tabActive : ""
                }`}
                onClick={() => {
                  setCategoriaActiva("wifi");
                  void comparar("wifi");
                }}
                disabled={comparando}
              >
                Wifi
              </button>
            </div>

            {comparando && (
              <p className={styles.helperTextMaroon}>Comparando tarifas...</p>
            )}
            {comparadorError && (
              <p className={styles.errorTextMaroon}>{comparadorError}</p>
            )}

            {comparador && (
              <div className={styles.compareGrid}>
                <Card className={styles.compareCard}>
                  <div className={styles.compareRow}>
                    <div className={styles.vendorLeft}>
                      <Image
                        src="/iconos/building-2-svgrepo-com 1.svg"
                        alt=""
                        width={20}
                        height={20}
                      />
                      <div>
                        <p>
                          {comparador.proveedor_actual?.nombre ||
                            "Proveedor actual"}
                        </p>
                        <small>
                          {comparador.proveedor_actual?.valoracion ||
                            "Referencia actual"}
                        </small>
                      </div>
                    </div>
                    <strong>
                      {Math.round(
                        comparador.proveedor_actual?.importe_mensual || 0
                      )}
                      €
                    </strong>
                  </div>
                  <p className={styles.compareNote}>
                    {comparador.recomendacion ||
                      "Basado en tarifas de referencia del mercado."}
                  </p>
                </Card>

                <Card className={styles.compareCard}>
                  {(comparador.alternativas || []).slice(0, 2).map((item, i) => (
                    <div
                      key={`${item.nombre}-${i}`}
                      className={`${styles.compareRow} ${
                        i > 0 ? styles.compareRowSecond : ""
                      }`}
                    >
                      <div className={styles.vendorLeft}>
                        <Image
                          src="/iconos/building-2-svgrepo-com 1.svg"
                          alt=""
                          width={20}
                          height={20}
                        />
                        <div>
                          <p>{item.nombre}</p>
                        </div>
                      </div>
                      <div className={styles.priceRight}>
                        <strong>{Math.round(item.importe_estimado || 0)}€</strong>
                        <span>↓{Math.round(item.ahorro_mensual || 0)}€</span>
                      </div>
                    </div>
                  ))}

                  <p className={styles.legalNote}>
                    {comparador.nota_legal ||
                      "Basado en tarifas de referencia del mercado."}
                  </p>
                </Card>
              </div>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}

