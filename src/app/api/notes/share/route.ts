import { NextResponse } from 'next/server';

const API_BASE_URL = 'https://api-notenext.suvojeetsengupta.in';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward the POST request to the backend API securely server-side
    const response = await fetch(`${API_BASE_URL}/api/notes/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to share note on backend' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const { deleteToken, shareId, ...clientData } = data;

    const res = NextResponse.json({ shareId, ...clientData });

    // Store the deleteToken in a secure, HttpOnly cookie that Javascript cannot access
    if (deleteToken && shareId) {
      res.cookies.set(`nn_del_${shareId}`, deleteToken, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return res;
  } catch (error: any) {
    console.error('Error in share proxy route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
