import { type ActionFunctionArgs } from "@remix-run/cloudflare";
import { GitHubService } from "~/services/github.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const githubService = new GitHubService({
    appId: process.env.GITHUB_APP_ID!,
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    privateKey: process.env.GITHUB_PRIVATE_KEY!,
    installationId: process.env.GITHUB_INSTALLATION_ID!,
  });

  try {
    const authUrl = await githubService.getAuthorizationUrl();

    return new Response(
      JSON.stringify({
        needsAuth: true,
        authUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to generate authorization URL" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}