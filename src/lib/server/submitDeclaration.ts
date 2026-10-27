import { displayName } from "@/lib/declaration/rights";
import { submissionSchema, type Submission } from "@/lib/declaration/submission";
import { renderDeclarationPdf } from "./declarationPdf";
import { getMailConfig, MailerNotConfiguredError, type Mailer } from "./mailer";

const MAX_BODY_BYTES = 64 * 1024;

export interface SubmitDeps {
  getMailer: () => Mailer;
  recipients: () => string[];
  now?: () => Date;
  reference?: () => string;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function makeReference(date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SR-${ymd}-${rand}`;
}

export function pdfFileName(title: string, reference: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `declaration-${slug || "oeuvre"}-${reference}.pdf`;
}

function emailBody(s: Submission, reference: string) {
  const holders = s.rightsHolders.map((h) => {
    const shares = [h.isAuthor && `auteur ${h.authorShare} %`, h.isComposer && `compositeur ${h.composerShare} %`].filter(Boolean).join(", ");
    return { name: displayName(h), shares, contact: `${h.email} · ${h.phone}${h.ipi ? ` · IPI ${h.ipi}` : ""}` };
  });
  const text = [
    `Nouvelle déclaration d'œuvre — ${s.work.title.value}`,
    `Référence : ${reference}`,
    `Statut : ${s.publication === "inedite" ? "inédite" : "éditée"} · Pays d'origine : ${s.originCountry}`,
    `Durée : ${s.work.duration.value}${s.work.bpm.value ? ` · BPM : ${s.work.bpm.value}` : ""}${s.work.genre.value ? ` · Genre : ${s.work.genre.value}` : ""}`,
    "",
    "Ayants droit :",
    ...holders.map((h) => `- ${h.name} (${h.shares}) — ${h.contact}`),
    "",
    "Le récapitulatif complet est joint en PDF.",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0a1428;max-width:560px">
  <p style="font-size:12px;letter-spacing:.14em;color:#0b6bff;font-weight:700;margin:0 0 8px">SONIQ RIGHTS · NOUVELLE DÉCLARATION</p>
  <h1 style="font-size:22px;margin:0 0 4px">${escapeHtml(s.work.title.value)}</h1>
  <p style="color:#5b6478;margin:0 0 20px">Réf. ${escapeHtml(reference)} · ${escapeHtml(s.work.duration.value)}${s.work.genre.value ? ` · ${escapeHtml(s.work.genre.value)}` : ""}</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">${holders
    .map(
      (h) =>
        `<tr><td style="padding:8px 0;border-top:1px solid #e2e7ef"><strong>${escapeHtml(h.name)}</strong><br><span style="color:#5b6478;font-size:12px">${escapeHtml(h.contact)}</span></td><td style="padding:8px 0;border-top:1px solid #e2e7ef;text-align:right;color:#0b6bff">${escapeHtml(h.shares)}</td></tr>`,
    )
    .join("")}</table>
  <p style="color:#5b6478;font-size:13px;margin-top:20px">Le récapitulatif complet est joint en PDF.</p>
</div>`;
  return { text, html };
}

/** Validates the submission, renders the PDF and e-mails it. Returns an HTTP response. */
export async function handleDeclarationSubmission(request: Request, deps: SubmitDeps): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    // Honeypot filled: pretend success so bots get no signal.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return Response.json({ ok: true, reference: "SR-0" }, { status: 202 });
    return Response.json({ error: "Déclaration incomplète.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const submission = parsed.data;
  const submittedAt = deps.now?.() ?? new Date();
  const reference = deps.reference?.() ?? makeReference(submittedAt);

  let mailer: Mailer;
  try {
    mailer = deps.getMailer();
  } catch (error) {
    if (error instanceof MailerNotConfiguredError) {
      console.error("[declarations] RESEND_API_KEY missing");
      return Response.json({ error: "L'envoi par e-mail n'est pas encore configuré. Votre brouillon est conservé." }, { status: 503 });
    }
    throw error;
  }

  try {
    const pdf = await renderDeclarationPdf(submission, { reference, submittedAt });
    const { text, html } = emailBody(submission, reference);
    const replyTo = submission.rightsHolders.map((h) => h.email).filter(Boolean).slice(0, 1);
    await mailer.send({
      to: deps.recipients(),
      replyTo,
      subject: `Déclaration d'œuvre — ${submission.work.title.value} (${reference})`,
      text,
      html,
      attachments: [{ filename: pdfFileName(submission.work.title.value, reference), content: pdf }],
    });
    return Response.json({ ok: true, reference }, { status: 201 });
  } catch (error) {
    console.error("[declarations] send failed", error);
    return Response.json({ error: "L'envoi a échoué. Réessayez dans un instant ; votre brouillon est conservé." }, { status: 502 });
  }
}

export const defaultSubmitDeps = async (): Promise<SubmitDeps> => {
  const { createResendMailer } = await import("./mailer");
  return { getMailer: createResendMailer, recipients: () => getMailConfig().recipients };
};
