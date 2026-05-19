import { useCallback, useEffect, useState } from "react";
import { fetchTracks, deleteTrack } from "../api/client";
import type { SongListItem } from "../types";
import { formatDate, formatTime } from "../types";
import styles from "./Catalog.module.css";

const STATUS_META: Record<
  string,
  { label: string; cls: string; dot: boolean }
> = {
  pending: { label: "En espera", cls: "badge-pending", dot: false },
  processing: { label: "Procesando", cls: "badge-processing", dot: true },
  done: { label: "Listo", cls: "badge-done", dot: false },
  error: { label: "Error", cls: "badge-error", dot: false },
};

interface StatusBadgeProps {
  status: string;
  progress: number;
  processingTime: number | null;
  createdAt: string;
}

function StatusBadge({
  status,
  progress,
  processingTime,
  createdAt,
}: StatusBadgeProps) {
  const [elapsed, setElapsed] = useState(0);
  const meta = STATUS_META[status] || STATUS_META.pending;

  useEffect(() => {
    if (status !== "processing" && status !== "pending") return;

    const dateStr =
      createdAt.endsWith("Z") || createdAt.includes("+")
        ? createdAt
        : createdAt + "Z";
    const startTime = new Date(dateStr).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [status, createdAt]);

  return (
    <div className={styles.statusContainer}>
      <div className={styles.statusTop}>
        <span className={`badge ${meta.cls}`}>
          {meta.dot && <span className="pulse-dot" />}
          {meta.label}{" "}
          {status === "processing" && progress > 0 ? `${progress}%` : ""}
        </span>
        {(status === "processing" || status === "pending" || status === "done") && (
          <span className={styles.timerLabel}>
            ⏱️{" "}
            {status === "done"
              ? formatTime(processingTime)
              : formatTime(elapsed)}
          </span>
        )}
      </div>
      {status === "processing" && (
        <div className={styles.progressMini}>
          <div
            className={styles.progressMiniFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface Props {
  onSelectSong: (song: SongListItem) => void;
}

export default function Catalog({ onSelectSong }: Props) {
  const [tracks, setTracks] = useState<SongListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadTracks = useCallback(async () => {
    try {
      const { data } = await fetchTracks();
      setTracks(data.items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(
    async (trackId: number) => {
      setConfirmDeleteId(null);
      try {
        await deleteTrack(trackId);
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
      } catch (err) {
        console.error("[Catalog] Error al eliminar:", err);
        alert(`Error al eliminar: ${(err as Error).message}`);
      }
    },
    [],
  );

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    const hasProcessing = tracks.some(
      (t) => t.status === "pending" || t.status === "processing",
    );
    if (!hasProcessing) return;

    const interval = setInterval(loadTracks, 2000);
    return () => clearInterval(interval);
  }, [tracks, loadTracks]);

  if (loading)
    return (
      <div className={`${styles.empty} glass-card`}>
        <div className="spinner" />
        <p>Cargando catálogo...</p>
      </div>
    );

  if (error)
    return (
      <div className={`${styles.empty} ${styles.error} glass-card`}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <p>Error al cargar el catálogo</p>
        <p style={{ fontSize: 12, color: "var(--clr-text-muted)" }}>
          {error}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={loadTracks}>
          Reintentar
        </button>
      </div>
    );

  if (tracks.length === 0)
    return (
      <div className={`${styles.empty} glass-card`}>
        <span style={{ fontSize: 48 }}>🎼</span>
        <h3>Catálogo vacío</h3>
        <p>Sube tu primera canción para comenzar</p>
      </div>
    );

  return (
    <div className={`glass-card ${styles.container}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.titleIcon}>🎵</span>
          Catálogo Musical
          <span className={styles.count}>
            {tracks.length} canción{tracks.length !== 1 ? "es" : ""}
          </span>
        </h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={loadTracks}
          title="Refrescar"
        >
          🔄 Refrescar
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>BPM</th>
              <th>Tonalidad</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, idx) => (
              <tr
                key={track.id}
                onClick={() =>
                  track.status === "done" && onSelectSong(track)
                }
                className={
                  track.status !== "done"
                    ? `data-table-row-disabled ${styles.rowDisabled}`
                    : ""
                }
                title={
                  track.status !== "done"
                    ? "Esperando procesamiento..."
                    : "Abrir mixer"
                }
              >
                <td className={styles.colId}>{idx + 1}</td>
                <td>
                  <div className={styles.trackName}>
                    <span className={styles.trackIcon}>🎸</span>
                    <span className={styles.trackFilename}>
                      {track.original_name}
                    </span>
                  </div>
                </td>
                <td>
                  {track.bpm != null ? (
                    <span className={styles.bpmBadge}>
                      {track.bpm.toFixed(1)} <small>BPM</small>
                    </span>
                  ) : (
                    <span className={styles.colEmpty}>—</span>
                  )}
                </td>
                <td>
                  {track.key ? (
                    <span className={styles.keyBadge}>{track.key}</span>
                  ) : (
                    <span className={styles.colEmpty}>—</span>
                  )}
                </td>
                <td>
                  <StatusBadge
                    status={track.status}
                    progress={track.progress}
                    processingTime={track.processing_time}
                    createdAt={track.created_at}
                  />
                </td>
                <td className={styles.colDate}>
                  {formatDate(track.created_at)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {track.status === "done" ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onSelectSong(track)}
                      >
                        🎛️ Mixer
                      </button>
                    ) : (
                      <span className={styles.colEmpty}>—</span>
                    )}
                    {confirmDeleteId === track.id ? (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onMouseDown={() => handleDelete(track.id)}
                          style={{
                            minWidth: "auto",
                            padding: "4px 8px",
                            fontSize: "11px",
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onMouseDown={() => setConfirmDeleteId(null)}
                          style={{
                            minWidth: "auto",
                            padding: "4px 8px",
                            fontSize: "11px",
                          }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onMouseDown={() => setConfirmDeleteId(track.id)}
                        title="Eliminar canción"
                        style={{
                          cursor: "pointer",
                          pointerEvents: "auto",
                          minWidth: "32px",
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
