import { defaultSubmitDeps, handleDeclarationSubmission } from "@/lib/server/submitDeclaration";

export async function POST(request: Request) {
  return handleDeclarationSubmission(request, await defaultSubmitDeps());
}
