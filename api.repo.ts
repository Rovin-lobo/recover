import { type ActionFunctionArgs } from "@remix-run/cloudflare";
import { GitRepoParser } from "~/lib/git-repo-parser";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { url, authToken } = await request.json<{
      url: string;
      authToken?: string;
    }>();
    const result = await GitRepoParser.parse(url, { authToken });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    let status = 400;
    let code = "INVALID_REPOSITORY_URL";
    const message =
      error instanceof Error ? error.message : "Failed to parse repository URL";

    if (message.includes("rate limit exceeded")) {
      status = 429;
      code = "RATE_LIMIT_EXCEEDED";
    } else if (message.includes("Repository not found")) {
      status = 404;
      code = "REPOSITORY_NOT_FOUND";
    } else if (message.includes("Invalid GitHub token")) {
      status = 401;
      code = "INVALID_TOKEN";
    }

    const errorResponse = {
      error: { code, message },
    };

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}