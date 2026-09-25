const TEXT_EXTENSIONS = new Set([
  // web
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "html", "htm", "css", "scss", "sass",
  "less", "vue", "svelte", "astro", "json", "jsonc", "json5", "graphql", "gql", "wasm", "wat",
  // systems & general purpose
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "hxx", "cs", "go", "rs", "java", "kt", "kts",
  "scala", "swift", "m", "mm", "py", "pyi", "rb", "php", "pl", "pm", "lua", "r", "dart",
  "ex", "exs", "erl", "hrl", "hs", "elm", "clj", "cljs", "edn", "fs", "fsx", "ml", "mli",
  "nim", "zig", "v", "sol", "jl", "groovy", "gradle", "vb", "asm", "s",
  // shell & config
  "sh", "bash", "zsh", "fish", "ps1", "psm1", "bat", "cmd", "yml", "yaml", "toml", "ini",
  "cfg", "conf", "env", "properties", "xml", "xsd", "xsl", "plist", "proto", "tf", "hcl",
  "nix", "cmake", "mk", "dockerfile", "sql", "prisma",
  // docs & data
  "md", "mdx", "markdown", "rst", "txt", "adoc", "tex", "csv", "tsv", "svg", "diff", "patch",
]);

const TEXT_FILENAMES = new Set([
  "dockerfile", "makefile", "gnumakefile", "rakefile", "gemfile", "procfile", "vagrantfile",
  "license", "licence", "copying", "readme", "authors", "contributors", "changelog", "notice",
  "codeowners", ".gitignore", ".gitattributes", ".gitmodules", ".editorconfig", ".npmrc",
  ".nvmrc", ".prettierrc", ".eslintrc", ".babelrc", ".dockerignore", ".env.example",
]);

const SKIP_FILENAMES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "cargo.lock",
  "poetry.lock", "composer.lock", "gemfile.lock", "go.sum",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "__pycache__", ".venv"]);

export function isTextPath(path: string): boolean {
  const segments = path.split("/");
  if (segments.slice(0, -1).some((d) => SKIP_DIRS.has(d))) return false;
  const name = segments[segments.length - 1].toLowerCase();
  if (SKIP_FILENAMES.has(name)) return false;
  if (/\.min\.(js|css)$/.test(name) || name.endsWith(".map")) return false;
  if (TEXT_FILENAMES.has(name)) return true;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1));
}

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : name;
}
