import { getCollection } from "astro:content";

export async function getIssueLabels(): Promise<Record<string, string>> {
  const issues = await getCollection("issues");
  return Object.fromEntries(issues.map((i) => [i.id, i.data.short]));
}
