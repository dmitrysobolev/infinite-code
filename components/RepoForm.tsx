"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseRepoInput } from "@/lib/repo";

export function RepoForm({ examples }: { examples: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) return setError("Enter a repository like owner/name or a github.com URL.");
    const qs = parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : "";
    router.push(`/${parsed.owner}/${parsed.repo}${qs}`);
  };

  return (
    <>
      <form
        className="repo-form"
        onSubmit={(e) => {
          e.preventDefault();
          open(value);
        }}
      >
        <span className="repo-form__prefix">github.com/</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="owner/repository"
          spellCheck={false}
        />
        <button type="submit" className="button">Open canvas →</button>
      </form>
      {error && <p className="repo-form__error">{error}</p>}
      <div className="examples">
        <span>Try</span>
        {examples.map((ex) => (
          <button key={ex} className="chip" onClick={() => open(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}
