import { createAppAuth } from '@octokit/auth-app';
import { z } from 'zod';

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  installationId?: string;
}

interface AuthenticationResult {
  token: string;
  type: 'app' | 'installation';
  expiresAt?: string;
  installationUrl?: string;
}

export class GitHubAppAuth {
  private static readonly GITHUB_APP_INSTALLATION_URL = 'https://github.com/apps/your-app-name/installations/new';
  private readonly config: GitHubAppConfig;

  constructor(config: GitHubAppConfig) {
    this.config = config;
  }

  async getAuthenticationToken(): Promise<AuthenticationResult> {
    try {
      const auth = createAppAuth({
        appId: this.config.appId,
        privateKey: this.config.privateKey,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        installationId: this.config.installationId
      });

      if (!this.config.installationId) {
        const appAuthentication = await auth({ type: 'app' });
        return {
          token: appAuthentication.token,
          type: 'app',
          expiresAt: appAuthentication.expiresAt,
          installationUrl: GitHubAppAuth.GITHUB_APP_INSTALLATION_URL
        };
      }

      const installationAuthentication = await auth({ type: 'installation' });
      return {
        token: installationAuthentication.token,
        type: 'installation',
        expiresAt: installationAuthentication.expiresAt
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`GitHub App authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  static validateConfig(config: unknown): GitHubAppConfig {
    const configSchema = z.object({
      appId: z.string(),
      privateKey: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      installationId: z.string().optional()
    });

    return configSchema.parse(config);
  }
}