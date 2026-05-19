import axios from "axios";
import type {
  PaginatedResponse,
  SongResponse,
  SongStatusResponse,
  UploadResponse,
} from "../types";

const BASE_URL = "/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg =
      error.response?.data?.detail || error.message || "Error desconocido";
    console.error("[API Error]", msg);
    return Promise.reject(new Error(msg));
  },
);

export const uploadSong = (
  formData: FormData,
  onProgress?: (pct: number) => void,
) =>
  api.post<UploadResponse>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60_000,
    onUploadProgress: (e) => {
      if (onProgress && e.total)
        onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

export const fetchTracks = (skip = 0, limit = 100) =>
  api.get<PaginatedResponse>("/tracks", { params: { skip, limit } });

export const fetchTrack = (id: number) =>
  api.get<SongResponse>(`/tracks/${id}`);

export const fetchStatus = (id: number) =>
  api.get<SongStatusResponse>(`/tracks/${id}/status`);

export const deleteTrack = (id: number) =>
  api.delete(`/tracks/${id}`);

export const getStemUrl = (songId: number, stemName: string) =>
  `/stems/${songId}/${stemName}`;

export const getExportAllUrl = (songId: number, format: string) =>
  `/api/tracks/${songId}/export-all?format=${format}`;

export default api;
