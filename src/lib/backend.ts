import { invoke } from "@tauri-apps/api/core";
import type { EngineCapabilities, JobRecord, JobRequest, UpdateInfo } from "../types/jobs";

export const backend = {
  capabilities: () => invoke<EngineCapabilities>("get_capabilities"),
  startJob: (request: JobRequest) => invoke<JobRecord>("start_job", { request }),
  listJobs: () => invoke<JobRecord[]>("list_jobs"),
  cancelJob: (id: string) => invoke<void>("cancel_job", { id }),
  clearFinished: () => invoke<void>("clear_finished_jobs"),
  defaultOutputDirectory: () => invoke<string>("get_default_output_directory"),
  prepareOutputDirectory: (path: string) =>
    invoke<string>("prepare_output_directory", { path }),
  openJobOutput: (jobId: string, outputPath: string) =>
    invoke<void>("open_job_output", { jobId, outputPath }),
  revealJobOutput: (jobId: string, outputPath: string) =>
    invoke<void>("reveal_job_output", { jobId, outputPath }),
  checkForUpdate: () => invoke<UpdateInfo | null>("check_for_update"),
};
