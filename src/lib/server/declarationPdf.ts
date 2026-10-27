import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatIswc } from "@/lib/declaration/iswc";
import { displayName } from "@/lib/declaration/rights";
import type { Submission } from "@/lib/declaration/submission";

const INK = rgb(0.039, 0.078, 0.157); // #0A1428
const MUTED = rgb(0.357, 0.392, 0.47);
const BRAND = rgb(0.043, 0.42, 1); // #0B6BFF
const LINE = rgb(0.886, 0.906, 0.937);

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;

const SOURCE_NOTE: Record<string, string> = {
  auto: "détecté automatiquement, non confirmé",
  confirmed: "détecté puis confirmé",
  manual: "saisi",
};

/**
 * The standard PDF fonts only cover WinAnsi. Keep French typography (é, œ, «, ’…)
 * and replace anything else instead of failing the whole document.
 */
export function toWinAnsi(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, "-")
    .replace(/[  ]/g, " ")
    .replace(
      /[^\x20-\x7E -ÿŒœŠšŸŽžƒˆ˜–—‚„†-•…‰‹›€™]/gu,
      "?",
    );
}

class Writer {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 30) {
      this.page = this.doc.addPage([A4.width, A4.height]);
      this.y = A4.height - MARGIN;
    }
  }

  text(value: string, opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    const size = opts.size ?? 10;
    this.page.drawText(toWinAnsi(value), { x: opts.x ?? MARGIN, y: this.y, size, font, color: opts.color ?? INK, maxWidth: opts.maxWidth });
  }

  rule() {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.width - MARGIN, y: this.y }, thickness: 0.75, color: LINE });
  }

  heading(label: string) {
    this.ensure(48);
    this.y -= 26;
    this.text(label.toUpperCase(), { size: 8.5, bold: true, color: BRAND });
    this.y -= 8;
    this.rule();
    this.y -= 16;
  }

  row(label: string, value: string, note?: string) {
    this.ensure(20);
    this.text(label, { size: 9.5, color: MUTED });
    this.text(value || "—", { x: MARGIN + 130, size: 10.5, bold: Boolean(value) });
    if (note) {
      const width = this.regular.widthOfTextAtSize(toWinAnsi(note), 8);
      this.text(note, { x: A4.width - MARGIN - width, size: 8, color: MUTED });
    }
    this.y -= 18;
  }
}

export async function renderDeclarationPdf(submission: Submission, meta: { reference: string; submittedAt: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(`Déclaration — ${submission.work.title.value}`));
  doc.setAuthor("SONIQ RIGHTS");
  doc.setSubject("Déclaration d'œuvre musicale");
  doc.setCreationDate(meta.submittedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, regular, bold);

  // Header band
  w.page.drawRectangle({ x: 0, y: A4.height - 92, width: A4.width, height: 92, color: INK });
  w.page.drawRectangle({ x: 0, y: A4.height - 95, width: A4.width, height: 3, color: BRAND });
  w.y = A4.height - 44;
  w.text("SONIQ", { size: 20, bold: true, color: rgb(1, 1, 1) });
  w.text("RIGHTS", { x: MARGIN + 78, size: 9, color: rgb(0.7, 0.78, 0.92) });
  w.y -= 22;
  w.text("Déclaration d'œuvre musicale", { size: 10, color: rgb(0.8, 0.85, 0.95) });
  const dateLabel = meta.submittedAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
  const refText = `Réf. ${meta.reference}`;
  w.y = A4.height - 44;
  w.text(refText, { x: A4.width - MARGIN - bold.widthOfTextAtSize(toWinAnsi(refText), 10), size: 10, bold: true, color: rgb(1, 1, 1) });
  w.y -= 22;
  w.text(dateLabel, { x: A4.width - MARGIN - regular.widthOfTextAtSize(toWinAnsi(dateLabel), 9), size: 9, color: rgb(0.8, 0.85, 0.95) });
  w.y = A4.height - 120;

  // Title
  w.text(submission.work.title.value, { size: 22, bold: true, maxWidth: A4.width - MARGIN * 2 });
  w.y -= 18;
  const subtitle = [submission.work.genre.value, submission.work.duration.value, submission.instrumental ? "Instrumental" : null].filter(Boolean).join("  ·  ");
  if (subtitle) w.text(subtitle, { size: 10, color: MUTED });

  const { work } = submission;
  w.heading("L'œuvre");
  w.row("Titre", work.title.value, SOURCE_NOTE[work.title.source]);
  w.row("Durée", work.duration.value, SOURCE_NOTE[work.duration.source]);
  w.row("BPM", work.bpm.value, work.bpm.value ? `${SOURCE_NOTE[work.bpm.source] ?? ""}${work.bpm.source === "manual" ? "" : " · estimation"}` : undefined);
  w.row("Genre", work.genre.value, SOURCE_NOTE[work.genre.source]);
  w.row("ISWC", work.iswc.value ? formatIswc(work.iswc.value) : "");
  w.row("ISRC", work.isrc.value);
  w.row("Type", submission.instrumental ? "Œuvre instrumentale (sans paroles)" : "Œuvre avec paroles");

  w.heading(`Ayants droit (${submission.rightsHolders.length})`);
  submission.rightsHolders.forEach((h, i) => {
    w.ensure(92);
    w.text(`${i + 1}. ${displayName(h)}`, { size: 11.5, bold: true });
    const shares = [h.isAuthor && `Auteur ${h.authorShare} %`, h.isComposer && `Compositeur ${h.composerShare} %`].filter(Boolean).join("   ");
    const sw = bold.widthOfTextAtSize(toWinAnsi(shares), 10);
    w.text(shares, { x: A4.width - MARGIN - sw, size: 10, bold: true, color: BRAND });
    w.y -= 16;
    w.row("Nom", `${h.lastName} ${h.firstName}`.trim());
    if (h.pseudonym) w.row("Pseudonyme", h.pseudonym);
    w.row("Téléphone", h.phone);
    w.row("E-mail", h.email);
    w.y -= 4;
    if (i < submission.rightsHolders.length - 1) {
      w.rule();
      w.y -= 16;
    }
  });

  w.heading("Répartition");
  const sum = (role: "author" | "composer") =>
    submission.rightsHolders.reduce((s, h) => {
      const on = role === "author" ? h.isAuthor : h.isComposer;
      const v = Number((role === "author" ? h.authorShare : h.composerShare).replace(",", "."));
      return on && Number.isFinite(v) ? s + v : s;
    }, 0);
  if (!submission.instrumental) w.row("Paroles (auteurs)", `${Math.round(sum("author") * 100) / 100} %`);
  w.row("Musique (compositeurs)", `${Math.round(sum("composer") * 100) / 100} %`);

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: A4.width - MARGIN, y: 40 }, thickness: 0.5, color: LINE });
    page.drawText(toWinAnsi(`SONIQ RIGHTS · Réf. ${meta.reference} · BPM et genre : estimations automatiques, vérifiées par le déclarant`), {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    const label = `${i + 1} / ${pages.length}`;
    page.drawText(label, { x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 7.5), y: 26, size: 7.5, font: regular, color: MUTED });
  });

  return doc.save();
}
