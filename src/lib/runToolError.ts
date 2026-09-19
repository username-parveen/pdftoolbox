import type { PresentationBanner } from "../types/presentation";

type StructuredTauriError = {
  kind: string;
  message?: string;
};

export function runToolFailureBanner(cause: unknown): PresentationBanner {
  const structured = structuredTauriError(cause);
  const message = safeErrorMessage(cause, structured);
  if (structured && isDestinationFailure(structured)) {
    return {
      kind: "error",
      message: `PDF Toolbox could not create the output there. ${message} Choose another folder and try again.`,
      actionLabel: "Choose another folder",
    };
  }
  return { kind: "error", message: `PDF Toolbox could not start the operation. ${message}` };
}

function structuredTauriError(cause: unknown): StructuredTauriError | undefined {
  let candidate = cause;
  if (typeof cause === "string" && cause.trim().startsWith("{")) {
    try {
      candidate = JSON.parse(cause);
    } catch {
      return undefined;
    }
  }
  if (!candidate || typeof candidate !== "object" || !("kind" in candidate) || typeof candidate.kind !== "string") return undefined;
  return {
    kind: candidate.kind,
    message: "message" in candidate && typeof candidate.message === "string" ? candidate.message : undefined,
  };
}

function isDestinationFailure(error: StructuredTauriError): boolean {
  const kind = error.kind.replace(/[^a-z]/gi, "").toLowerCase();
  if (kind === "outputnotwritable" || kind === "outputexists") return true;
  if (kind !== "ioerror") return false;
  return /destination|output|save|writ|folder|director|creat|rename|disk|space/i.test(error.message ?? "");
}

function safeErrorMessage(cause: unknown, structured: StructuredTauriError | undefined): string {
  const raw = structured?.message
    ?? (cause instanceof Error ? cause.message : typeof cause === "string" && !cause.trim().startsWith("{") ? cause : undefined);
  const concise = raw?.replace(/\s+/g, " ").trim();
  return concise ? `${concise.slice(0, 240)}${concise.length > 240 ? "..." : ""}` : "Try again.";
}
