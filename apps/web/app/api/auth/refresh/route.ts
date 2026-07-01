import { type NextRequest, NextResponse } from "next/server";

const AUTH_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * POST /api/auth/refresh
 *
 * Proxies the refresh-token call to the auth service so the browser never
 * needs to make a cross-origin request with credentials.  The httpOnly
 * refreshToken cookie arrives from the browser, gets forwarded server-side,
 * and the rotated Set-Cookie header from the auth service is forwarded back
 * so the browser always holds the latest refresh token.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: "NO_TOKEN", message: "No refresh token." } },
      { status: 401 },
    );
  }

  try {
    const upstream = await fetch(`${AUTH_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
    });

    const body = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(body, { status: upstream.status });

    // Forward the rotated refreshToken cookie to the browser
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "REFRESH_FAILED", message: "Token refresh failed." } },
      { status: 500 },
    );
  }
}
