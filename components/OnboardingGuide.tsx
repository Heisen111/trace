"use client";

import { useState, useEffect } from "react";

const ONBOARDING_KEY = "trace-app-onboarding-dismissed";

const tabs = [
  {
    name: "Answer",
    desc: "Full model response as plain text — no formatting, just the raw output.",
  },
  {
    name: "Walkthrough",
    desc: "Every token colored by confidence (green = certain, red = likely wrong). Hover any token to see what the model almost said instead.",
  },
  {
    name: "Claims",
    desc: "Facts extracted from the answer with a risk score (safe/low/medium/high). Claims in low-confidence tokens or contradicted by consensus are flagged.",
  },
  {
    name: "Consensus",
    desc: "The same question run 3 more times. Sentences that appear across multiple runs are shared (reliable); unique ones may be hallucinations.",
  },
  {
    name: "Ablation",
    desc: "Parts of the question are removed one at a time. This shows which words the answer depends on most — load-bearing segments are flagged.",
  },
];

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY);
    if (dismissed !== "true") {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Welcome to Trace Dashboard</h2>
        <button
          onClick={dismiss}
          className="rounded-md px-2 py-0.5 text-xs font-medium hover:bg-blue-200/60 dark:hover:bg-blue-800/60"
          aria-label="Dismiss onboarding"
        >
          Dismiss
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed opacity-80">
        Ask a question and the model streams its answer token-by-token. Once
        complete, the tabs below let you inspect the response from different
        angles:
      </p>
      <div className="mb-3 grid gap-1.5 sm:grid-cols-5">
        {tabs.map((t) => (
          <div
            key={t.name}
            className="rounded-sm border border-blue-200/60 bg-white/60 p-2 dark:border-blue-800/60 dark:bg-black/20"
          >
            <span className="text-xs font-semibold">{t.name}</span>
            <p className="mt-0.5 text-[11px] leading-snug opacity-70">
              {t.desc}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] opacity-60">
        You can also check{" "}
        <a href="/history" className="underline">
          History
        </a>{" "}
        for past traces or run{" "}
        <a href="/batch" className="underline">
          Batch
        </a>{" "}
        to process many questions at once.
      </p>
    </div>
  );
}
