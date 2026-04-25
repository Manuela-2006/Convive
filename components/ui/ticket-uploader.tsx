"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { useTicketScanner, type TicketScanMode } from "../../hooks/use-ticket-scanner";
import type { TicketScannerData } from "../../lib/ticket-scanner-types";
import {
  DOCUMENT_MAX_FILE_SIZE_BYTES,
  SCANNER_ALLOWED_MEDIA_TYPES,
} from "../../lib/ticket-scanner-types";
import styles from "./ticket-uploader.module.css";

type TicketUploaderProps = {
  onScanComplete: (data: TicketScannerData) => void;
  onFileSelected?: (file: File | null) => void;
  className?: string;
  iconSrc?: string;
  iconAlt?: string;
  minHeight?: number;
  scanMode?: TicketScanMode;
};

export function TicketUploader({
  onScanComplete,
  onFileSelected,
  className,
  iconSrc = "/iconos/Escanearimagen.svg",
  iconAlt = "Subir archivo",
  minHeight = 190,
  scanMode = "ocr",
}: TicketUploaderProps) {
  const { scanning, progress, error, scanFile } = useTicketScanner({ scanMode });
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const allowedTypes = new Set<string>(SCANNER_ALLOWED_MEDIA_TYPES);
    if (!allowedTypes.has(file.type) || file.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
      onFileSelected?.(null);
      setPreview(null);
      await scanFile(file);
      return;
    }

    onFileSelected?.(file);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    const data = await scanFile(file);
    if (data) {
      onScanComplete(data);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    if (scanning) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  return (
    <div className={styles.root}>
      {!preview ? (
        <div
          className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ""} ${scanning ? styles.dropZoneBusy : ""} ${className ?? ""}`}
          style={{ minHeight }}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!scanning) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !scanning) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!scanning) {
              setDragging(true);
            }
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className={styles.dropInner}>
            <Image src={iconSrc} alt={iconAlt} width={48} height={48} />
            {scanning ? (
              <p className={styles.dropTitle}>Analizando con IA...</p>
            ) : (
              <>
                <p className={styles.dropTitle}>Sube o arrastra ticket/factura</p>
                <p className={styles.dropMeta}>JPG, PNG o WEBP - Max 10MB</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.previewWrap}>
          <img src={preview} alt="Preview del ticket" className={styles.previewImage} />
          {!scanning ? (
            <button
              type="button"
              className={styles.previewClose}
              onClick={() => {
                setPreview(null);
                onFileSelected?.(null);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              aria-label="Quitar archivo"
            >
              ×
            </button>
          ) : null}
        </div>
      )}

      {scanning ? (
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.progressCopy}>
            {progress < 70
              ? scanMode === "vision"
                ? "Analizando imagen del documento..."
                : "Extrayendo texto del documento..."
              : progress < 90
                ? "Interpretando datos con IA..."
                : "Preparando documento..."}
          </p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
