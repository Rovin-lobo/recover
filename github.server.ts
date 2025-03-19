
import crypto from "crypto";

interface GitHubConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  installationId: string;
}

interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUserResponse {
  login: string;
  id: number;
  name: string;
  email: string;
  avatar_url: string;
}

export class GitHubService {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  async getAuthorizationUrl() {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: "http://localhost:5173/api/auth/callback",
      state,
      scope: "repo",
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async getAccessToken(code: string): Promise<string> {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
        }),
      },
    );

    const data = (await response.json()) as GitHubAccessTokenResponse;

    return data.access_token;
  }

  async getUserData(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    return response.json() as Promise<GitHubUserResponse>;
  }
}