import { z } from "zod";
import { GitHubAppAuth } from "./github-app-auth";

interface GitRepoMetadata {
  owner: string;
  repo: string;
  branch?: string;
  commit?: string;
  provider: "github" | "gitlab" | "bitbucket";
  isPrivate: boolean;
}

interface GitHubRepoResponse {
  private: boolean;
  description?: string;
  html_url?: string;
  default_branch?: string;
  visibility?: string;
  fork?: boolean;
}

interface ParsedGitUrl {
  metadata: GitRepoMetadata;
  normalizedUrl: string;
  originalUrl: string;
}

interface ParseOptions {
  authToken?: string;
  githubApp?: {
    appId: string;
    privateKey: string;
    clientId: string;
    clientSecret: string;
    installationId?: string;
  };
}

const gitUrlSchema = z.string().refine(
  (url) => {
    try {
      // Test if it's a valid URL
      if (url.includes("://")) {
        new URL(url);
        return true;
      }

      // Test if it's a shorthand format (user/repo)
      return /^[\w-]+\/[\w.-]+$/.test(url);
    } catch {
      return false;
    }
  },
  { message: "Invalid Git repository URL format" },
);

export class GitRepoParser {
  private static readonly PROVIDER_PATTERNS = {
    github: /github\.com/,
    gitlab: /gitlab\.com/,
    bitbucket: /bitbucket\.org/,
  };

  private static readonly BRANCH_PATTERN = /\/tree\/([\w.-]+)/;
  private static readonly COMMIT_PATTERN = /\/commit\/([a-f0-9]+)/i;

  static async parse(
    url: string,
    options: ParseOptions = {},
  ): Promise<ParsedGitUrl> {
    // Validate URL format
    gitUrlSchema.parse(url);

    // Handle shorthand format (user/repo)
    if (!url.includes("://")) {
      url = `https://github.com/${url}`;
    }

    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);

    // Determine provider
    const provider =
      (Object.entries(this.PROVIDER_PATTERNS).find(([_, pattern]) =>
        pattern.test(urlObj.hostname),
      )?.[0] as GitRepoMetadata["provider"]) || "github";

    // Extract branch
    const branchMatch = url.match(this.BRANCH_PATTERN);
    const branch = branchMatch ? branchMatch[1] : undefined;

    // Extract commit
    const commitMatch = url.match(this.COMMIT_PATTERN);
    const commit = commitMatch ? commitMatch[1] : undefined;

    // Extract owner and repo
    const [owner, repo] = pathSegments;
    const cleanRepo = repo?.replace(/\.git$/, "");

    if (!owner || !cleanRepo) {
      throw new Error(
        "Invalid repository URL: missing owner or repository name",
      );
    }

    // Construct normalized URL
    const normalizedUrl = `https://${urlObj.hostname}/${owner}/${cleanRepo}`;

    // Fetch repository metadata from GitHub API
    let isPrivate = false;
    let repoData: GitHubRepoResponse | null = null;

    if (provider === "github") {
      try {
        const headers: HeadersInit = {
          Accept: "application/vnd.github.v3+json",
        };

        if (options.githubApp) {
          const githubAppAuth = new GitHubAppAuth(options.githubApp);
          try {
            const authResult = await githubAppAuth.getAuthenticationToken();
            if (authResult.type === 'app' && authResult.installationUrl) {
              throw new Error('GitHub App installation required');
            }
            headers.Authorization = `Bearer ${authResult.token}`;
          } catch (error) {
            if (error instanceof Error && error.message === 'GitHub App installation required') {
              throw error;
            }
            throw new Error(`GitHub App authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else if (options.authToken) {
          if (
            !options.authToken.startsWith("ghp_") &&
            !options.authToken.startsWith("github_pat_")
          ) {
            throw new Error(
              "Invalid GitHub token format. Token should be a GitHub Personal Access Token.",
            );
          }
          headers.Authorization = `Bearer ${options.authToken}`;
        }

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${cleanRepo}`,
          { headers },
        );
        const rateLimitRemaining = response.headers.get(
          "x-ratelimit-remaining",
        );
        const rateLimitReset = response.headers.get("x-ratelimit-reset");

        if (!response.ok) {
          const errorBody = await response.text();
          const errorInfo = {
            status: response.status,
            statusText: response.statusText,
            rateLimit: rateLimitRemaining
              ? {
                  remaining: rateLimitRemaining,
                  reset: rateLimitReset
                    ? new Date(Number(rateLimitReset) * 1000).toISOString()
                    : undefined,
                }
              : undefined,
            body: errorBody,
          };

          if (response.status === 404) {
            throw new Error(`Repository not found: ${owner}/${cleanRepo}`);
          } else if (response.status === 403 && rateLimitRemaining === "0") {
            throw new Error(
              `GitHub API rate limit exceeded. Reset at ${new Date(Number(rateLimitReset) * 1000).toISOString()}`,
            );
          } else {
            throw new Error(
              `GitHub API Error: ${response.status} - ${errorBody}`,
            );
          }
        }

        repoData = (await response.json()) as GitHubRepoResponse;
        isPrivate = repoData.private;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("rate limit exceeded")) {
            console.warn(error.message);
          } else {
            console.error("Failed to fetch repository metadata:", {
              error: error.message,
              stack: error.stack,
            });
          }
        }

        // Continue with default values if API call fails
        isPrivate = false;
      }
    }

    return {
      metadata: {
        owner,
        repo: cleanRepo,
        branch,
        commit,
        provider,
        isPrivate,
      },
      normalizedUrl,
      originalUrl: url,
    };
  }

  static validate(url: string): z.SafeParseReturnType<string, string> {
    return gitUrlSchema.safeParse(url);
  }

  static isValidProvider(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return Object.values(this.PROVIDER_PATTERNS).some((pattern) =>
        pattern.test(urlObj.hostname),
      );
    } catch {
      return false;
    }
  }
}