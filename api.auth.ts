import { json } from '@remix-run/cloudflare';
import { GitHubAppAuth } from '~/lib/github-app-auth';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const config = GitHubAppAuth.validateConfig(body);

    const githubAuth = new GitHubAppAuth(config);
    const authResult = await githubAuth.getAuthenticationToken();

    return json(authResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid request';
    return json({ error: errorMessage }, { status: 400 });
  }
}