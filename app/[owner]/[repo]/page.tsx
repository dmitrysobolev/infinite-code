import type { Metadata } from "next";
import { RepoView } from "@/components/RepoView";

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${owner}/${repo} · Infinite Code` };
}

export default async function RepoPage({ params, searchParams }: Props) {
  const { owner, repo } = await params;
  const { ref } = await searchParams;
  return <RepoView owner={owner} repo={repo} gitRef={ref} />;
}
