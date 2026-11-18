export const HELP_BUCKET = "platform-help-guides";
export const HELP_FILE_LIMIT = 10 * 1024 * 1024;
export const HELP_CATEGORIES = [
  "Getting started",
  "Calling and tasks",
  "Companies and contacts",
  "Sales",
  "Marketing",
  "Administration",
];
export type HelpGuide = {
  id: string;
  organisation_id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  archived: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};
export function filterHelpGuides(
  guides: HelpGuide[],
  query: string,
  category: string,
  archived: boolean,
) {
  const words = query
    .trim()
    .toLocaleLowerCase("en-GB")
    .split(/\s+/)
    .filter(Boolean);
  return guides.filter(
    (g) =>
      (archived || !g.archived) &&
      (!category || g.category === category) &&
      words.every((word) =>
        [g.title, g.category, g.summary, g.content]
          .join(" ")
          .toLocaleLowerCase("en-GB")
          .includes(word),
      ),
  );
}
export async function validateHelpPdf(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Choose a PDF file.");
  if (!file.size || file.size > HELP_FILE_LIMIT)
    throw new Error("Choose a PDF between 1 byte and 10 MB.");
  const signature = new TextDecoder().decode(
    await file.slice(0, 5).arrayBuffer(),
  );
  if (signature !== "%PDF-")
    throw new Error(
      "This file does not appear to be a PDF. Export it as PDF and try again.",
    );
}
