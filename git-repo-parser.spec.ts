import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GitRepoParser } from "./git-repo-parser";

describe("GitRepoParser", () => {
  describe("parse", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should parse standard HTTPS Git URLs", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ private: false }),
      } as Response);

      const result = await GitRepoParser.parse(
        "https://github.com/user/repo.git",
      );
      expect(result.metadata).toEqual({
        owner: "user",
        repo: "repo",
        provider: "github",
        isPrivate: false,
        branch: undefined,
        commit: undefined,
      });
      expect(result.normalizedUrl).toBe("https://github.com/user/repo");
    });

    it("should parse GitHub shorthand format", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ private: false }),
      } as Response);

      const result = await GitRepoParser.parse("user/repo");
      expect(result.metadata).toEqual({
        owner: "user",
        repo: "repo",
        provider: "github",
        isPrivate: false,
        branch: undefined,
        commit: undefined,
      });
      expect(result.normalizedUrl).toBe("https://github.com/user/repo");
    });

    it("should parse URLs with branch specifications", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ private: false }),
      } as Response);

      const result = await GitRepoParser.parse(
        "https://github.com/user/repo/tree/main",
      );
      expect(result.metadata).toEqual({
        owner: "user",
        repo: "repo",
        provider: "github",
        isPrivate: false,
        branch: "main",
        commit: undefined,
      });
      expect(result.normalizedUrl).toBe("https://github.com/user/repo");
    });

    it("should parse URLs with commit specifications", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ private: false }),
      } as Response);

      const result = await GitRepoParser.parse(
        "https://github.com/user/repo/commit/abc123",
      );
      expect(result.metadata).toEqual({
        owner: "user",
        repo: "repo",
        provider: "github",
        isPrivate: false,
        branch: undefined,
        commit: "abc123",
      });
      expect(result.normalizedUrl).toBe("https://github.com/user/repo");
    });

    it("should parse GitLab URLs", async () => {
      const result = await GitRepoParser.parse("https://gitlab.com/user/repo");
      expect(result.metadata.provider).toBe("gitlab");
    });

    it("should parse Bitbucket URLs", async () => {
      const result = await GitRepoParser.parse(
        "https://bitbucket.org/user/repo",
      );
      expect(result.metadata.provider).toBe("bitbucket");
    });

    it("should throw error for invalid URLs", async () => {
      await expect(GitRepoParser.parse("invalid-url")).rejects.toThrow();
      await expect(
        GitRepoParser.parse("https://example.com/user"),
      ).rejects.toThrow();
    });

    it("should handle GitHub API rate limit errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("API rate limit exceeded"),
        headers: new Headers({
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        }),
      } as Response);

      await expect(
        GitRepoParser.parse("https://github.com/user/repo"),
      ).rejects.toThrow("GitHub API rate limit exceeded");
    });

    it("should handle repository not found errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Not Found"),
        headers: new Headers(),
      } as Response);

      await expect(
        GitRepoParser.parse("https://github.com/user/nonexistent"),
      ).rejects.toThrow("Repository not found");
    });

    it("should handle invalid token format", async () => {
      await expect(
        GitRepoParser.parse("https://github.com/user/repo", {
          authToken: "invalid_token",
        }),
      ).rejects.toThrow("Invalid GitHub token format");
    });

    it("should handle private repositories correctly", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ private: true }),
      } as Response);

      const result = await GitRepoParser.parse("https://github.com/user/repo");
      expect(result.metadata.isPrivate).toBe(true);
    });
  });

  describe("validate", () => {
    it("should validate correct URLs", () => {
      expect(
        GitRepoParser.validate("https://github.com/user/repo").success,
      ).toBe(true);
      expect(GitRepoParser.validate("user/repo").success).toBe(true);
    });

    it("should invalidate incorrect URLs", () => {
      expect(GitRepoParser.validate("invalid-url").success).toBe(false);
      expect(GitRepoParser.validate("https://example.com/user").success).toBe(
        false,
      );
    });
  });

  describe("isValidProvider", () => {
    it("should identify valid providers", () => {
      expect(
        GitRepoParser.isValidProvider("https://github.com/user/repo"),
      ).toBe(true);
      expect(
        GitRepoParser.isValidProvider("https://gitlab.com/user/repo"),
      ).toBe(true);
      expect(
        GitRepoParser.isValidProvider("https://bitbucket.org/user/repo"),
      ).toBe(true);
    });

    it("should identify invalid providers", () => {
      expect(
        GitRepoParser.isValidProvider("https://example.com/user/repo"),
      ).toBe(false);
    });
  });
});