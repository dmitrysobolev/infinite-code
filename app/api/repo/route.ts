import { NextRequest, NextResponse } from "next/server";
import { fetchRepoTree, GitHubError } from "@/lib/github";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const ref = searchParams.get("ref") ?? undefined;
  const valid = /^[A-Za-z0-9_.-]+$/;
  if (!owner || !repo || !valid.test(owner) || !valid.test(repo)) {
    return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
  }
  try {
    return NextResponse.json(await fetchRepoTree(owner, repo, ref));
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
