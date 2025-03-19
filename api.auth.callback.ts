import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "gh_session",
    secrets: ["temp_secret"], // Replace with your actual secret
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
});

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  const storedState = session.get("state");

  if (!code || !state || state !== storedState) {
    return redirect("/?error=invalid_state");
  }

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    );

    const data = (await tokenResponse.json()) as GitHubTokenResponse;

    if (data.error) {
      throw new Error(data.error_description || "Failed to get access token");
    }

    // Store token in session
    const session = await sessionStorage.getSession();
    const repoMetadata = session.get("repoMetadata");

    if (!repoMetadata) {
      throw new Error("Invalid repository state");
    }

    session.set("githubToken", data.access_token);
    session.set("tokenType", data.token_type);
    session.set("scope", data.scope);

    // Redirect back to the app with success message and repository metadata
    return redirect("/?success=true", {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
  } catch (error) {
    return redirect("/?error=auth_failed");
  }
}