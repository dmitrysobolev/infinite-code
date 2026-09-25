import { RepoForm } from "@/components/RepoForm";

const EXAMPLES = ["vercel/swr", "pmndrs/zustand", "sindresorhus/ky", "expressjs/express", "tj/commander.js"];

export default function Home() {
  return (
    <main className="home">
      <div className="home__glow" />
      <div className="home__content">
        <div className="home__badge">∞ Infinite Code</div>
        <h1>
          Every file of a repository,
          <br />
          <span className="gradient-text">on one infinite canvas.</span>
        </h1>
        <p className="home__lead">
          Paste a GitHub repository and fly through its source code. Files are grouped by folder, so the
          structure of the project becomes a map you can explore.
        </p>
        <RepoForm examples={EXAMPLES} />
      </div>
    </main>
  );
}
