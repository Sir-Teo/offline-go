import { invoke } from "@tauri-apps/api/core";

export interface GtpEngineForm {
  id?: string;
  name: string;
  path: string;
  args?: string[];
  workingDirectory?: string;
  enabled?: boolean;
}

export interface GtpEngineInfo {
  id: string;
  name: string;
  path: string;
  args: string[];
  workingDirectory?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GtpSessionInfo {
  sessionId: string;
  engineId: string;
  status: string;
  startedAt: string;
}

export async function listEngines(): Promise<GtpEngineInfo[]> {
  return invoke<GtpEngineInfo[]>("list_gtp_engines");
}

export async function upsertEngine(input: GtpEngineForm): Promise<GtpEngineInfo> {
  return invoke<GtpEngineInfo>("register_gtp_engine", { payload: input });
}

export async function removeEngine(engineId: string): Promise<void> {
  await invoke("remove_gtp_engine", { engineId });
}

export async function launchEngine(engineId: string): Promise<GtpSessionInfo> {
  return invoke<GtpSessionInfo>("launch_gtp_engine", { engineId });
}

export async function stopEngine(sessionId: string): Promise<void> {
  await invoke("stop_gtp_engine", { sessionId });
}
