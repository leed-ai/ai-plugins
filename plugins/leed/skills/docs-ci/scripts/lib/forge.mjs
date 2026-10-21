/**
 * Which forge a `git remote` URL belongs to, and the OIDC issuer and trust profile that go with it.
 *
 * github.com is GitHub Actions; gitlab.com is GitLab.com; any other host is taken to be a self-managed GitLab
 * instance, which the skill confirms with the user. GitHub Enterprise Server and the other well-known forges are not
 * supported: their tokens come from issuers the github and gitlab trust profiles do not describe.
 */

export const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const GITLAB_COM_ISSUER = "https://gitlab.com";

/** Hosts that are known not to be GitLab, with the reason the skill gives. */
const UNSUPPORTED_HOSTS = [
  { pattern: /(^|\.)bitbucket\.org$/, reason: "Bitbucket Pipelines is not a GitHub or GitLab pipeline" },
  { pattern: /(^|\.)(dev\.azure\.com|visualstudio\.com)$/, reason: "Azure DevOps is not a GitHub or GitLab pipeline" },
  { pattern: /(^|\.)codeberg\.org$/, reason: "Codeberg is not a GitHub or GitLab pipeline" },
  {
    pattern: /github/,
    reason:
      "this looks like GitHub Enterprise Server, whose Actions tokens come from the server's own issuer, which the github trust profile does not cover",
  },
];

/** Host suffixes that never resolve publicly. Leed runs OIDC discovery against the issuer, so it must be public. */
const PRIVATE_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home.arpa", ".corp", ".intranet"];

/**
 * The parts of a remote URL: `https://<host>/<path>`, `ssh://<user>@<host>:<port>/<path>` or the scp form `<user>@<host>:<path>`.
 * Returns null for anything else, such as a local path.
 */
export function parseRemote(remote) {
  const text = String(remote).trim();
  const url = /^(https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::(\d+))?\/(.+)$/i.exec(text);
  if (url) return { scheme: url[1].toLowerCase(), host: url[2].toLowerCase(), port: url[3], path: cleanPath(url[4]) };
  const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/\/)(.+)$/.exec(text);
  if (scp && !/^[a-z]$/i.test(scp[1])) return { scheme: "ssh", host: scp[1].toLowerCase(), path: cleanPath(scp[2]) };
  return null;
}

function cleanPath(value) {
  return value.replace(/\/+$/, "").replace(/\.git$/, "");
}

/** Why `issuer` cannot be a trust's issuer, or null when it can. The backend still checks it resolves publicly. */
export function issuerProblem(issuer) {
  let url;
  try {
    url = new URL(issuer);
  } catch {
    return "the issuer must be a full URL";
  }
  if (url.protocol !== "https:") return "the issuer must use https";
  if (url.username || url.password) return "the issuer must not contain a username or password";
  if (url.search || url.hash || issuer.includes("?") || issuer.includes("#")) {
    return "the issuer must not contain a query string or fragment";
  }
  const host = url.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return "the issuer must be a hostname, not an IP";
  if (host === "localhost" || !host.includes(".") || PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "the issuer must be a public hostname: Leed fetches its OIDC discovery document when the trust is created";
  }
  return null;
}

/**
 * Classify a remote. `issuerOverride` replaces the derived issuer of a self-managed instance, for one served under a
 * path or on a different host from its git remote.
 */
export function classify(remote, issuerOverride) {
  const parts = parseRemote(remote);
  if (!parts) return { ok: false, forge: "unsupported", reason: `${remote} is not a GitHub or GitLab remote URL` };
  const { host, path } = parts;
  const base = { host, path, identityLabel: path, trustName: `Docs release: ${path}` };
  // ssh.github.com is GitHub's own SSH-over-443 endpoint for github.com, not an Enterprise server.
  if (host === "github.com" || host === "www.github.com" || host === "ssh.github.com") {
    return { ok: true, forge: "github", ...base, profile: "github", issuer: GITHUB_ISSUER };
  }
  if (host === "gitlab.com" || host === "www.gitlab.com") {
    return { ok: true, forge: "gitlab.com", ...base, profile: "gitlab", issuer: GITLAB_COM_ISSUER };
  }
  const unsupported = UNSUPPORTED_HOSTS.find(({ pattern }) => pattern.test(host));
  if (unsupported) return { ok: false, forge: "unsupported", ...base, reason: unsupported.reason };
  const port = parts.scheme === "https" && parts.port ? `:${parts.port}` : "";
  const issuer = (issuerOverride ?? `https://${host}${port}`).replace(/\/$/, "");
  const problem = issuerProblem(issuer);
  if (problem) return { ok: false, forge: "gitlab-self-managed", ...base, issuer, reason: problem };
  return {
    ok: true,
    forge: "gitlab-self-managed",
    ...base,
    profile: "gitlab",
    issuer,
    confirm: `Confirm with the user that ${host} is a GitLab instance, and that ${issuer} is its own URL: the issuer of its ID tokens`,
  };
}
