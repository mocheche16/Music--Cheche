import { useCallback, useEffect, useRef, useState } from "react";
import { uploadSong, fetchStatus } from "../api/client";
import styles from "./UploadZone.module.css";

const POLLING_INTERVAL = 4000;
type Phase = "idle" | "uploading" | "processing" | "done" | "error";

interface Props {
  onUploadComplete: () => void;
}

export default function UploadZone({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startPolling = useCallback(
    (songId: number) => {
      setStartTime(Date.now());
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      pollingRef.current = setInterval(async () => {
        try {
          const { data } = await fetchStatus(songId);
          setProgress(data.progress || 0);

          if (data.status === "done") {
            stopPolling();
            setPhase("done");
            setStatusMsg("¡Procesamiento completado!");
            onUploadComplete();
          } else if (data.status === "error") {
            stopPolling();
            setPhase("error");
            setStatusMsg(
              `Error: ${data.error_msg || "Procesamiento fallido"}`,
            );
          } else {
            setStatusMsg(
              "Demucs está separando los stems... (puede tardar varios minutos)",
            );
          }
        } catch (err) {
          console.error("[Polling error]", err);
        }
      }, POLLING_INTERVAL);
    },
    [onUploadComplete],
  );

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      const allowed = [
        "audio/mpeg",
        "audio/wav",
        "audio/flac",
        "audio/ogg",
        "audio/x-m4a",
      ];
      if (
        !allowed.includes(selectedFile.type) &&
        !selectedFile.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i)
      ) {
        setPhase("error");
        setStatusMsg("Formato no soportado. Usa MP3, WAV, FLAC o OGG.");
        return;
      }

      const MAX_SIZE = 50 * 1024 * 1024;
      if (selectedFile.size > MAX_SIZE) {
        setPhase("error");
        setStatusMsg("El archivo es demasiado grande. El límite es de 50MB.");
        return;
      }

      setFile(selectedFile);
      setPhase("uploading");
      setUploadProgress(0);
      setStatusMsg("Subiendo archivo...");

      try {
        const form = new FormData();
        form.append("file", selectedFile);

        const { data } = await uploadSong(form, setUploadProgress);
        setPhase("processing");
        setStatusMsg(
          "Archivo recibido. Iniciando análisis con Librosa y Demucs...",
        );
        startPolling(data.song_id);
      } catch (err) {
        setPhase("error");
        setStatusMsg(`Error al subir: ${(err as Error).message}`);
      }
    },
    [startPolling],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const reset = () => {
    stopPolling();
    setFile(null);
    setPhase("idle");
    setStatusMsg("");
    setUploadProgress(0);
    setProgress(0);
    setElapsed(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const fmtTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const isIdle = phase === "idle";

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ""} ${phase !== "idle" ? styles.active : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => isIdle && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && isIdle && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivos de audio"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,.ogg,.m4a,audio/*"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        {isIdle && (
          <div className={styles.idle}>
            <div className={styles.icon}>🎵</div>
            <h3>Arrastra tu canción aquí</h3>
            <p>o haz clic para seleccionar un archivo</p>
            <div className={styles.formats}>
              <span>MP3</span>
              <span>WAV</span>
              <span>FLAC</span>
              <span>OGG</span>
            </div>
          </div>
        )}

        {phase === "uploading" && (
          <div className={styles.inner}>
            <div className={styles.filename}>📁 {file?.name}</div>
            <div className={styles.progressLabel}>
              Subiendo... {uploadProgress}%
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className={styles.inner}>
            <div className={styles.waveform}>
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
            </div>
            <div className={styles.filename}>🎛️ {file?.name}</div>
            <div className={styles.stats}>
              <span className={styles.percentage}>{progress}%</span>
              <span className={styles.timer}>
                ⏱️ {fmtTime(elapsed)}
              </span>
            </div>
            <div className={`progress-bar-track ${styles.processingBar}`}>
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={styles.msg}>{statusMsg}</p>
            <p className={styles.hint}>
              Este proceso puede tardar 5-30 minutos según el hardware
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className={styles.inner}>
            <div className={styles.doneIcon}>✅</div>
            <h3 className={styles.doneTitle}>
              Procesamiento completado
            </h3>
            <p className={styles.doneText}>{file?.name}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
            >
              Subir otra canción
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className={styles.inner}>
            <div className={styles.errorIcon}>❌</div>
            <h3 className={styles.errorTitle}>Error</h3>
            <p className={styles.errorText}>{statusMsg}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
