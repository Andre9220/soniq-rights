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

describe("œuvre éditée", () => {
  const edited = (): Submission => {
    const s = validSubmission();
    s.publication = "editee";
    s.rightsHolders[0].authorShare = "40";
    s.rightsHolders[0].composerShare = "15";
    s.rightsHolders[1].composerShare = "15";
    s.publishers = [
      { id: "p", name: "Éditions Exemple", contactName: "Marie Durand", catalogue: "Électro 2026", role: "original", ipi: "", email: "contact@editions.fr", phone: "+33 6 98 76 54 32", share: "30" },
    ];
    return s;
  };

  it("accepts a published work whose key includes the publisher", () => {
    expect(submissionSchema.safeParse(edited()).success).toBe(true);
  });

  it("rejects a published work without publisher", () => {
    const s = edited();
    s.publishers = [];
    expect(submissionSchema.safeParse(s).error?.issues.map((i) => i.message)).toContain("Une œuvre éditée doit avoir au moins un éditeur.");
  });

  it("rejects publishers on an unpublished work", () => {
    const s = edited();
    s.publication = "inedite";
    expect(submissionSchema.safeParse(s).success).toBe(false);
  });

  it("does not send publishers typed before switching back to inédite", () => {
    const draft = createEmptyDraft();
    draft.publication = "inedite";
    draft.publishers = [{ id: "p", name: "X", contactName: "", catalogue: "", role: "", ipi: "", email: "", phone: "", share: "" }];
    expect(toSubmission(draft).publishers).toEqual([]);
  });

  it("lists the publisher in the PDF and the e-mail", async () => {
    const doc = await PDFDocument.load(await renderDeclarationPdf(edited(), { reference: "SR-3", submittedAt: new Date() }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const { send, deps: d } = deps();
    expect((await handleDeclarationSubmission(post(edited()), d)).status).toBe(201);
    const message = vi.mocked(send).mock.calls[0][0];
    expect(message.html).toContain("Éditions Exemple");
    expect(message.text).toContain("éditeur original 30 %");
    expect(message.text).toContain("catalogue Électro 2026");
  });

  it("rejects a publisher without name, catalogue or role", () => {
    const s = edited();
    s.publishers[0].catalogue = "";
    expect(submissionSchema.safeParse(s).success).toBe(false);
  });

  describe("publishing contract (multipart)", () => {
    const PDF = new TextEncoder().encode("%PDF-1.4\n% contrat\n");
    const multipart = (s: Submission, file?: File) => {
      const form = new FormData();
      form.append("declaration", JSON.stringify(s));
      if (file) form.append("contract", file);
      return new Request("http://localhost/api/declarations", { method: "POST", body: form });
    };

    it("attaches the contract next to the declaration PDF", async () => {
      const { send, deps: d } = deps();
      const res = await handleDeclarationSubmission(multipart(edited(), new File([PDF], "Contrat signé.pdf", { type: "application/pdf" })), d);
      expect(res.status).toBe(201);
      const message = vi.mocked(send).mock.calls[0][0];
      expect(message.attachments.map((a) => a.filename)).toEqual([
        "declaration-lumiere-du-nord-SR-20261027-ABC123.pdf",
        "contrat-edition-lumiere-du-nord-SR-20261027-ABC123.pdf",
      ]);
      expect(message.text).toContain("contrat d'édition sont joints");
    });

    it("accepts a multipart declaration without contract", async () => {
      const { send, deps: d } = deps();
      expect((await handleDeclarationSubmission(multipart(edited()), d)).status).toBe(201);
      expect(vi.mocked(send).mock.calls[0][0].attachments).toHaveLength(1);
    });

    it("rejects a file that is not really a PDF or an image", async () => {
      const { send, deps: d } = deps();
      const fake = new File(["MZ not a pdf"], "contrat.pdf", { type: "application/pdf" });
      expect((await handleDeclarationSubmission(multipart(edited(), fake), d)).status).toBe(415);
      expect(send).not.toHaveBeenCalled();
    });

    it("rejects a contract on an unpublished work", async () => {
      const { deps: d } = deps();
      const s = validSubmission();
      expect((await handleDeclarationSubmission(multipart(s, new File([PDF], "c.pdf")), d)).status).toBe(422);
    });

    it("rejects contracts over 4 MB", async () => {
      const { deps: d } = deps();
      const big = new File([PDF, new Uint8Array(4 * 1024 * 1024)], "c.pdf", { type: "application/pdf" });
      expect((await handleDeclarationSubmission(multipart(edited(), big), d)).status).toBe(413);
    });
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
