import { z } from "zod";
import { parseDuration } from "@/lib/audio/duration";
import type { DeclarationDraft } from "./draft";
import { isCountryCode } from "./countries";
import { isValidIswc } from "./iswc";
import { parseBpm } from "./fields";
import { validateRights } from "./rights";

const text = (max: number) => z.string().trim().max(max);
const source = z.enum(["empty", "auto", "confirmed", "manual"]);
const tracked = (max: number) => z.object({ value: text(max), source });

/** What the browser sends when the declaration is submitted. */
export const submissionSchema = z
  .object({
    publication: z.enum(["inedite", "editee"], { message: "Indiquez si l'œuvre est inédite ou éditée" }),
    originCountry: z.string().refine(isCountryCode, "Pays d'origine invalide"),
    work: z.object({
      title: tracked(200),
      duration: tracked(10),
      bpm: tracked(8),
      genre: tracked(80),
      isrc: tracked(20),
      iswc: tracked(20),
    }),
    instrumental: z.boolean(),
    rightsHolders: z
      .array(
        z.object({
          id: text(80),
          lastName: text(100),
          firstName: text(100),
          pseudonym: text(100),
          ipi: text(20),
          isAuthor: z.boolean(),
          authorShare: text(8),
          isComposer: z.boolean(),
          composerShare: text(8),
          phone: text(30),
          email: text(200),
        }),
      )
      .min(1)
      .max(20),
    publishers: z
      .array(
        z.object({
          id: text(80),
          name: text(200),
          contactName: text(200),
          catalogue: text(200),
          role: z.enum(["original", "co", "sub", "admin", ""]),
          ipi: text(20),
          email: text(200),
          phone: text(30),
          share: text(8),
        }),
      )
      .max(10)
      .default([]),
    /** Honeypot: hidden field that real users never fill. */
    website: z.string().max(0).optional(),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    if (!data.work.title.value) issue("Titre requis", ["work", "title"]);
    if (parseDuration(data.work.duration.value) === null) issue("Durée invalide", ["work", "duration"]);
    if (data.work.bpm.value && parseBpm(data.work.bpm.value) === null) issue("BPM invalide", ["work", "bpm"]);
    if (data.work.iswc.value && !isValidIswc(data.work.iswc.value)) issue("ISWC invalide", ["work", "iswc"]);
    if (data.publication === "inedite" && data.publishers.length > 0) issue("Une œuvre inédite n'a pas d'éditeur", ["publishers"]);
    const rights = validateRights(data.rightsHolders, {
      instrumental: data.instrumental,
      publishers: data.publication === "editee" ? data.publishers : undefined,
    });
    if (!rights.valid) issue(rights.global[0] ?? "Ayants droit incomplets", ["rightsHolders"]);
  });

export type Submission = z.infer<typeof submissionSchema>;

export function toSubmission(draft: DeclarationDraft): Submission {
  return {
    publication: draft.publication as Submission["publication"],
    originCountry: draft.originCountry,
    work: draft.work,
    instrumental: draft.instrumental,
    rightsHolders: draft.rightsHolders,
    // Publishers typed before switching the work back to "inédite" are not sent.
    publishers: draft.publication === "editee" ? draft.publishers : [],
  };
}
