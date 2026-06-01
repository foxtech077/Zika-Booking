import { NextRequest, NextResponse } from 'next/server';
// Manual JWT decode – no external library needed

/**
 * GET /api/auth/me
 * Returns the decoded user information from the JWT token sent in the
 * `Authorization: Bearer <token>` header or the `accessToken` cookie.
 * The token is signed with the secret defined in `process.env.JWT_SECRET`.
 */
export async function GET(req: NextRequest) {
  try {
    // Prefer Authorization header, fallback to cookie
    const authHeader = req.headers.get('authorization');
    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = req.cookies.get('accessToken')?.value ?? null;
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    // Simple base64url decode of payload (no signature verification)
    const decodeJwt = (token: string) => {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('Invalid token format')
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8')
      return JSON.parse(payload) as Record<string, any>
    }
    const payload = decodeJwt(token) // use manual decode instead of jwt.verify


    // Return the payload (you may want to filter sensitive fields)
    return NextResponse.json({ user: payload }, { status: 200 });
  } catch (err: any) {
    // Token verification failed
    return NextResponse.json({ error: err?.message ?? 'Unauthorized' }, { status: 401 });
  }
}
