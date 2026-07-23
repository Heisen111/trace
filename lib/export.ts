import type { TokenData } from "./types";
import type { Claim } from "./claims";

function logprobBg(lp: number): string {
  const p = Math.exp(Math.max(lp, -10));
  if (p >= 0.9) return "#dcfce7";
  if (p >= 0.7) return "#dbeafe";
  if (p >= 0.5) return "#fef9c3";
  if (p >= 0.2) return "#ffedd5";
  return "#fce8e8";
}

function logprobColor(lp: number): string {
  const p = Math.exp(Math.max(lp, -10));
  if (p >= 0.9) return "#16a34a";
  if (p >= 0.7) return "#2563eb";
  if (p >= 0.5) return "#ca8a04";
  if (p >= 0.2) return "#ea580c";
  return "#dc2626";
}

function probPct(lp: number): string {
  return (Math.exp(Math.max(lp, -10)) * 100).toFixed(0) + "%";
}

function riskColor(risk: string): string {
  switch (risk) {
    case "high": return "#dc2626";
    case "medium": return "#ca8a04";
    case "low": return "#ea580c";
    default: return "#16a34a";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface ExportData {
  question: string;
  model: string;
  created_at: string;
  id: string;
  answer_text: string;
  token_confidence: TokenData[];
  claims: Claim[];
}

export function generateTraceHtml(data: ExportData): string {
  const tokens = data.token_confidence || [];

  let answerHtml = "";
  let forkCount = 0;
  const forkDetails: string[] = [];

  for (const t of tokens) {
    const lp = t.logprob ?? 0;
    const bg = logprobBg(lp);
    const color = logprobColor(lp);
    const p = Math.exp(Math.max(lp, -10));
    const alts = (t.top_logprobs || []).slice(0, 3);

    const tooltip =
      alts.length > 0
        ? ` title="p=${probPct(lp)} | alternatives: ${alts.map((a) => `${escapeHtml(a.token)} (${probPct(a.logprob)})`).join(", ")}"`
        : ` title="p=${probPct(lp)}"`;

    answerHtml += `<span style="background-color:${bg};color:${color};border-radius:2px;padding:0 1px;cursor:default"${tooltip}>${escapeHtml(t.token)}</span>`;

    if (p < 0.3 && alts.length >= 2) {
      forkCount++;
      forkDetails.push(`
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:8px;background:#fff">
          <code style="font-size:13px;color:#dc2626;font-weight:600">&ldquo;${escapeHtml(t.token)}&rdquo;</code>
          <span style="color:#6b7280;font-size:12px">&nbsp;was torn between&nbsp;</span>
          ${alts.map((a) => `<code style="font-size:12px">&ldquo;${escapeHtml(a.token)}&rdquo; <span style="color:#6b7280">(${probPct(a.logprob)})</span></code>`).join(", ")}
        </div>`);
    }
  }

  let claimsHtml = "";
  if (data.claims.length > 0) {
    const sections = [
      { label: "Safe", items: data.claims.filter((c) => c.adjustedRisk === "safe"), color: "#16a34a" },
      { label: "Low Risk", items: data.claims.filter((c) => c.adjustedRisk === "low"), color: "#ea580c" },
      { label: "Medium Risk", items: data.claims.filter((c) => c.adjustedRisk === "medium"), color: "#ca8a04" },
      { label: "High Risk", items: data.claims.filter((c) => c.adjustedRisk === "high"), color: "#dc2626" },
    ];

    for (const section of sections) {
      if (section.items.length === 0) continue;
      claimsHtml += `<h3 style="font-size:13px;font-weight:600;margin:16px 0 6px;color:${section.color}">${section.label} (${section.items.length})</h3>`;
      for (const c of section.items) {
        const showAdjusted = c.risk !== c.adjustedRisk;
        claimsHtml += `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:6px;background:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <span style="flex:1;font-size:13px;line-height:1.5">${escapeHtml(c.text)}</span>
          <span style="flex-shrink:0;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;color:${riskColor(c.adjustedRisk)};background-color:${riskColor(c.adjustedRisk)}1a">${showAdjusted ? c.risk + " → " : ""}${c.adjustedRisk}</span>
        </div>`;
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trace: ${escapeHtml(data.question.slice(0, 80))}</title>
<style>
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; margin:0; padding:24px; background:#f9fafb; color:#111827; line-height:1.6 }
  .container { max-width:800px; margin:0 auto }
  h1 { font-size:18px; font-weight:700; margin:0 0 4px; color:#111827 }
  .meta { font-size:12px; color:#6b7280; margin-bottom:20px }
  .meta span { margin-right:12px }
  .section-title { font-size:14px; font-weight:600; margin:24px 0 10px; padding-bottom:4px; border-bottom:2px solid #e5e7eb }
  .answer-wrap { line-height:2; padding:16px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; white-space:pre-wrap; font-size:14px }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center }
</style>
</head>
<body>
<div class="container">
  <h1>${escapeHtml(data.question)}</h1>
  <div class="meta">
    <span>Model: ${escapeHtml(data.model)}</span>
    <span>Date: ${new Date(data.created_at).toLocaleString()}</span>
    <span>Trace: ${data.id.slice(0, 8)}&hellip;</span>
    <span>Tokens: ${tokens.length}</span>
  </div>

  <div class="section-title">Answer — Token Confidence</div>
  <div class="answer-wrap">${answerHtml}</div>

  ${forkCount > 0 ? `<div class="section-title">Fork Points (${forkCount})</div>${forkDetails.join("")}` : ""}

  ${claimsHtml ? `<div class="section-title">Claims &amp; Risk Analysis</div>${claimsHtml}` : ""}

  <div class="footer">Generated by Trace Dashboard &mdash; ${new Date().toLocaleString()}</div>
</div>
</body>
</html>`;
}
