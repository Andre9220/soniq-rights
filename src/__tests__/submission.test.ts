import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { createEmptyDraft } from "@/lib/declaration/draft";
import { createRightsHolder } from "@/lib/declaration/rights";
import { submissionSchema, toSubmission, type Submission } from "@/lib/declaration/submission";
import { renderDeclarationPdf, toWinAnsi } from "@/lib/server/declarationPdf";
import { getMailConfig, MailerNotConfiguredError, type Mailer } from "@/lib/server/mailer";
import { handleDeclarationSubmission, makeReference, pdfFileName } from "@/lib/server/submitDeclaration";

function validSubmission(): Submission {
  const draft = createEmptyDraft();
  draft.publication = "inedite";
  draft.originCountry = "FR";
  draft.work.title = { value: "Lumière du Nord", source: "confirmed" };
  draft.work.duration = { value: "3:42", source: "confirmed" };
  draft.work.bpm = { value: "120", source: "confirmed" };
  draft.work.genre = { value: "Électro / Dance", source: "auto" };
  draft.work.iswc = { value: "T-034.524.680-1", source: "manual" };
  draft.rightsHolders = [
    { ...createRightsHolder("a"), lastName: "Dupont", firstName: "Camille", pseudonym: "Kami", ipi: "123456789", isAuthor: true, authorShare: "50", isComposer: true, composerShare: "25", phone: "+33 6 12 34 56 78", email: "camille@exemple.fr" },
    { ...createRightsHolder("b"), lastName: "Martin", firstName: "Léo", isComposer: true, composerShare: "25", phone: "0612345678", email: "leo@exemple.fr" },
  ];
  return toSubmission(draft);
}

const post = (body: unknown) =>
  new Request("http://localhost/api/declarations", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

function deps(send: Mailer["send"] = vi.fn(async () => ({ id: "email_1" }))) {
  return {
    send,
    deps: {
      getMailer: () => ({ send }),
      recipients: () => ["arnaudlehalle@gmail.com"],
      now: () => new Date("2026-10-27T10:00:00Z"),
      reference: () => "SR-20261027-ABC123",
    },
  };
}

describe("submissionSchema", () => {
  it("accepts a complete declaration", () => {
    expect(submissionSchema.safeParse(validSubmission()).success).toBe(true);
  });

  it("re-validates shares on the server", () => {
    const s = validSubmission();
    s.rightsHolders[1].composerShare = "15";
    const r = submissionSchema.safeParse(s);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Le total auteur + compositeur fait 90 % au lieu de 100 %.");
  });

  it.each([
    ["missing title", (s: Submission) => (s.work.title.value = "")],
    ["bad duration", (s: Submission) => (s.work.duration.value = "3:99")],
    ["bad ISWC", (s: Submission) => (s.work.iswc.value = "T-034.524.680-9")],
    ["bad email", (s: Submission) => (s.rightsHolders[0].email = "nope")],
    ["bad IPI", (s: Submission) => (s.rightsHolders[0].ipi = "12AB")],
    ["unknown country", (s: Submission) => (s.originCountry = "XX")],
    ["missing publication status", (s: Submission) => ((s as { publication: string }).publication = "")],
  ])("rejects %s", (_, mutate) => {
    const s = validSubmission();
    mutate(s);
    expect(submissionSchema.safeParse(s).success).toBe(false);
  });
});

describe("PDF", () => {
  it("renders a readable A4 document with metadata", async () => {
    const bytes = await renderDeclarationPdf(validSubmission(), { reference: "SR-1", submittedAt: new Date("2026-10-27T10:00:00Z") });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Déclaration — Lumière du Nord");
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });

  it("paginates long lists of rights holders", async () => {
    const s = validSubmission();
    s.rightsHolders = Array.from({ length: 12 }, (_, i) => ({ ...s.rightsHolders[1], id: `h${i}`, isAuthor: false, composerShare: i < 4 ? "25" : "0" }));
    const doc = await PDFDocument.load(await renderDeclarationPdf(s, { reference: "SR-2", submittedAt: new Date() }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("keeps French characters and replaces unsupported ones", () => {
    expect(toWinAnsi("Œuvre « été » – l’ami")).toBe("Œuvre « été » – l'ami");
    expect(toWinAnsi("Beat 🔥 東京")).toBe("Beat ? ??");
  });
});

describe("helpers", () => {
  it("builds references and file names", () => {
    expect(makeReference(new Date("2026-10-27T10:00:00Z"))).toMatch(/^SR-20261027-[0-9A-F]{6}$/);
    expect(pdfFileName("Lumière du Nord !", "SR-1")).toBe("declaration-lumiere-du-nord-SR-1.pdf");
    expect(pdfFileName("东京", "SR-1")).toBe("declaration-oeuvre-SR-1.pdf");
  });

  it("sends to Arnaud by default, overridable by env", () => {
    const prev = process.env.DECLARATION_RECIPIENTS;
    delete process.env.DECLARATION_RECIPIENTS;
    expect(getMailConfig().recipients).toEqual(["arnaudlehalle@gmail.com"]);
    process.env.DECLARATION_RECIPIENTS = "a@x.fr, b@y.fr";
    expect(getMailConfig().recipients).toEqual(["a@x.fr", "b@y.fr"]);
    if (prev === undefined) delete process.env.DECLARATION_RECIPIENTS;
    else process.env.DECLARATION_RECIPIENTS = prev;
  });
});

describe("POST /api/declarations", () => {
  it("e-mails the PDF to the configured recipient", async () => {
    const { send, deps: d } = deps();
    const res = await handleDeclarationSubmission(post(validSubmission()), d);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, reference: "SR-20261027-ABC123" });
    const message = vi.mocked(send).mock.calls[0][0];
    expect(message.to).toEqual(["arnaudlehalle@gmail.com"]);
    expect(message.subject).toBe("Déclaration d'œuvre — Lumière du Nord (SR-20261027-ABC123)");
    expect(message.replyTo).toEqual(["camille@exemple.fr"]);
    expect(message.attachments[0].filename).toBe("declaration-lumiere-du-nord-SR-20261027-ABC123.pdf");
    expect(new TextDecoder().decode(message.attachments[0].content.slice(0, 5))).toBe("%PDF-");
    expect(message.html).toContain("Camille Dupont (Kami)");
    expect(message.html).toContain("IPI 123456789");
    expect(message.text).toContain("Statut : inédite · Pays d'origine : FR");
  });

  it("escapes user content in the e-mail HTML", async () => {
    const { send, deps: d } = deps();
    const s = validSubmission();
    s.work.title.value = "<script>x</script>";
    await handleDeclarationSubmission(post(s), d);
    expect(vi.mocked(send).mock.calls[0][0].html).not.toContain("<script>");
  });

  it("rejects invalid JSON and incomplete declarations", async () => {
    const { send, deps: d } = deps();
    expect((await handleDeclarationSubmission(post("{oops"), d)).status).toBe(400);
    const s = validSubmission();
    s.work.title.value = "";
    const res = await handleDeclarationSubmission(post(s), d);
    expect(res.status).toBe(422);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies", async () => {
    const { deps: d } = deps();
    const res = await handleDeclarationSubmission(post({ pad: "x".repeat(70 * 1024) }), d);
    expect(res.status).toBe(413);
  });

  it("silently drops honeypot submissions", async () => {
    const { send, deps: d } = deps();
    const res = await handleDeclarationSubmission(post({ ...validSubmission(), website: "spam.example" }), d);
    expect(res.status).toBe(202);
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 503 when e-mail is not configured", async () => {
    const { deps: d } = deps();
    const res = await handleDeclarationSubmission(post(validSubmission()), {
      ...d,
      getMailer: () => {
        throw new MailerNotConfiguredError();
      },
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/brouillon est conservé/);
  });

  it("returns 502 when the provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps: d } = deps(vi.fn(async () => Promise.reject(new Error("Resend down"))));
    expect((await handleDeclarationSubmission(post(validSubmission()), d)).status).toBe(502);
  });
});
