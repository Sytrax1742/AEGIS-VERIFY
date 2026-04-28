"use client";

import { useCallback, useMemo, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { useDropzone } from "react-dropzone";

import {
  AutopsyReport,
  type DynamicSieve,
  type ForensicReportData,
} from "@/components/AutopsyReport";

type AutopsyApiResponse = {
  status: string;
  message: string;
  filename: string;
  autopsy_report_ready?: boolean;
  active_sieves?: DynamicSieve[];
  findings?: Record<string, unknown>;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AutopsyApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileSha256, setFileSha256] = useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0] ?? null);
    setResult(null);
    setError(null);
    setFileSha256("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone(
    {
      onDrop,
      multiple: false,
      maxFiles: 1,
    } as unknown as Parameters<typeof useDropzone>[0],
  );

  const fileDetails = useMemo(() => {
    if (!file) {
      return "No file selected yet.";
    }

    return `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  const contextualVerdict = useMemo(() => {
    if (!result) {
      return "No verdict available yet.";
    }

    const verdict = result.findings?.contextual_verdict;

    return typeof verdict === "string" && verdict.trim().length > 0
      ? verdict
      : result.message;
  }, [result]);

  const computeSha256 = useCallback(async (currentFile: File) => {
    const buffer = await currentFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }, []);

  const reportData = useMemo<ForensicReportData | null>(() => {
    if (!result?.findings) {
      return null;
    }

    const criticalRedFlags = result.findings.critical_red_flags;
    const missingMetadata = result.findings.missing_metadata;
    const contextualVerdict = result.findings.contextual_verdict;

    const isStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === "string");

    if (
      !isStringArray(criticalRedFlags) ||
      !isStringArray(missingMetadata) ||
      typeof contextualVerdict !== "string"
    ) {
      return null;
    }

    return {
      critical_red_flags: criticalRedFlags,
      missing_metadata: missingMetadata,
      contextual_verdict: contextualVerdict,
    };
  }, [result]);

  const isVerdictThreat = useMemo(() => {
    const threatKeywords = ["fraudulent", "tampered", "forgery"];
    const verdict = contextualVerdict.toLowerCase();
    return threatKeywords.some((keyword) => verdict.includes(keyword));
  }, [contextualVerdict]);

  const trustScore = useMemo(() => {
    if (!result?.findings || !result?.active_sieves) {
      return null;
    }

    const criticalRedFlags = result.findings.critical_red_flags;
    const numSieves = result.active_sieves.length || 1;

    if (!Array.isArray(criticalRedFlags)) {
      return null;
    }

    const numFlags = criticalRedFlags.length;

    // If no flags, perfect trust
    if (numFlags === 0) {
      return { score: 100, level: "high", label: "Clean" };
    }

    // Calculate ratio: flags per sieve
    const flagsPerSieve = numFlags / numSieves;

    // High risk: more than 2 flags per sieve on average
    if (flagsPerSieve > 2) {
      return { score: 25, level: "low", label: "Suspicious" };
    }

    // Mid risk: 1-2 flags per sieve
    if (flagsPerSieve > 1) {
      return { score: 55, level: "mid", label: "Caution" };
    }

    // Low risk: less than 1 flag per sieve
    return { score: 75, level: "high", label: "Mostly Safe" };
  }, [result?.findings, result?.active_sieves]);

  const handleRunAutopsy = async () => {
    if (!file) {
      setError("Please upload a file before running an autopsy.");
      return;
    }

    if (!userPrompt.trim()) {
      setError("Please enter an Investigation Context before running an autopsy.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const [hash, formData] = await Promise.all([
        computeSha256(file),
        Promise.resolve(new FormData()),
      ]);

      formData.append("file", file);
      formData.append("user_prompt", userPrompt.trim());

      // Use the Cloud URL if deployed, otherwise fallback to local testing!
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const response = await fetch(`${API_BASE_URL}/api/v1/scan`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as AutopsyApiResponse;
      setResult(data);
      setFileSha256(hash);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "An unexpected error occurred while running the autopsy.";
      setError(message);
      setResult(null);
      setFileSha256("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f7f7f5_100%)] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
              Aegis-Verify
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              CISO Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Upload a suspect asset, define the investigation context, and run a
              forensic autopsy through the adaptive sieve pipeline.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Secure analysis workspace
          </div>
        </header>

        <section className="w-full overflow-hidden grid flex-1 gap-6 py-8 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Evidence Intake</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Drag and drop the file you want to analyze.
                </p>
              </div>

              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Live upload
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`group flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition-colors ${
                isDragActive
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input {...getInputProps({})} />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="h-8 w-8 rounded-full border-2 border-slate-900" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {isDragActive ? "Drop the file here" : "Drag & drop evidence here"}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Accepts a single file for forensic review. The system will route the
                asset through the adaptive sieve workflow after upload.
              </p>
              <div className="mt-6 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                Browse files
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Selected file</span>
              <span>{fileDetails}</span>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Sieve Pulse</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Real-time orchestration output from the adaptive sieve pipeline.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    {isSubmitting ? "Processing" : result ? "Complete" : "Idle"}
                  </div>
                  {result && reportData ? (
                    <PDFDownloadLink
                      document={
                        <AutopsyReport
                          reportData={reportData}
                          active_sieves={result.active_sieves ?? []}
                        />
                      }
                      fileName={`Aegis-Verify_Forensic_Autopsy_${result.filename.replace(/\.[^.]+$/, "")}.pdf`}
                    >
                      {({ loading }) => (
                        <button
                          type="button"
                          disabled={isSubmitting || loading}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white shadow-md transition hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading
                            ? "Preparing Forensic PDF..."
                            : "Download Forensic Autopsy"}
                        </button>
                      )}
                    </PDFDownloadLink>
                  ) : null}
                </div>
              </div>

              {isSubmitting ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  Forging Ephemeral Sieves via Vertex AI...
                </div>
              ) : error ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                  {error}
                </div>
              ) : result ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Scan Status
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {result.message}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">File: {result.filename}</p>
                    </article>

                    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Report Readiness
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {result.autopsy_report_ready ? "Ready" : "In Progress"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Autopsy graph execution has completed for the current request.
                      </p>
                    </article>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        SHA-256 Hash
                      </p>
                      <p className="mt-3 break-all font-mono text-sm leading-6 text-slate-900">
                        {fileSha256 || "Pending computation"}
                      </p>
                    </article>

                    <article
                      className={`rounded-2xl border p-4 ${
                        isVerdictThreat
                          ? "border-rose-200 bg-rose-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Contextual Verdict
                          </p>
                          <p
                            className={`mt-3 text-sm leading-6 ${
                              isVerdictThreat ? "text-rose-900" : "text-emerald-900"
                            }`}
                          >
                            {contextualVerdict}
                          </p>
                        </div>
                        {trustScore && (
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <div
                              className={`relative flex h-16 w-16 items-center justify-center rounded-full border-4 text-center ${
                                trustScore.level === "low"
                                  ? "border-rose-300 bg-rose-100"
                                  : trustScore.level === "mid"
                                    ? "border-amber-300 bg-amber-100"
                                    : "border-emerald-300 bg-emerald-100"
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-950">
                                  {trustScore.score}%
                                </p>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                  Trust
                                </p>
                              </div>
                            </div>
                            <p
                              className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                                trustScore.level === "low"
                                  ? "text-rose-700"
                                  : trustScore.level === "mid"
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                              }`}
                            >
                              {trustScore.label}
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  </div>

                  <article className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Active Sieves
                    </p>
                    <div className="mt-3 grid gap-3">
                      {(result.active_sieves ?? []).length > 0 ? (
                        result.active_sieves?.map((sieve) => (
                          <div
                            key={sieve.sieve_name}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-semibold text-slate-950">
                                {sieve.sieve_name}
                              </h3>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                {sieve.required_tool}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {sieve.objective}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No active sieves returned.</p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Findings
                    </p>
                    <div className="mt-3 overflow-x-auto max-w-full">
                      <pre className="rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap break-words">
                        {JSON.stringify(result.findings ?? {}, null, 2)}
                      </pre>
                    </div>
                  </article>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Run an autopsy to see sieve activity, cache routing, and findings.
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-semibold text-slate-950">
                Investigation Context
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Provide the forensic question or business risk to guide the autopsy.
              </p>

              <label
                className="mt-5 block text-sm font-medium text-slate-700"
                htmlFor="user_prompt"
              >
                Analyst prompt
              </label>
              <textarea
                id="user_prompt"
                value={userPrompt}
                onChange={(event) => setUserPrompt(event.target.value)}
                placeholder="Example: Audit this insurance claim for tampering, forged metadata, and inconsistencies."
                className="mt-2 min-h-[220px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />

              <button
                type="button"
                onClick={handleRunAutopsy}
                disabled={isSubmitting}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? "Running Autopsy..." : "Run Autopsy"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Pipeline status
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Adaptive sieve router</span>
                  <span className="font-medium text-emerald-300">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Vertex grounding</span>
                  <span className="font-medium text-emerald-300">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Firestore sieve memory</span>
                  <span className="font-medium text-emerald-300">Ready</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
