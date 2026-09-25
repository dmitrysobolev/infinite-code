import type { Metadata, Viewport } from "next";
import { RepoView } from "@/components/RepoView";

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string }>;
};

// The canvas does its own pinch-zoom; stop mobile browsers zooming the page.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
