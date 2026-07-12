import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = 'https://api-notenext.suvojeetsengupta.in';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;

    // Fetch note from backend securely
    const response = await fetch(`${API_BASE_URL}/api/notes/${shareId}`);
    if (resStatusIsNotOk(response.status)) {
      return NextResponse.json(
        { error: 'Note not found or expired' },
        { status: response.status }
      );
    }

    const note = await response.json();
    
    // Check if the user is the creator by checking the cookie
    const cookieStore = await cookies();
    const isCreator = cookieStore.has(`nn_del_${shareId}`);

    return NextResponse.json({
      ...note,
      isCreator, // Return isCreator to client safely
    });
  } catch (error: any) {
    console.error('Error in GET proxy route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    const cookieStore = await cookies();
    const cookieName = `nn_del_${shareId}`;
    
    const deleteTokenCookie = cookieStore.get(cookieName);
    const deleteToken = deleteTokenCookie ? deleteTokenCookie.value : '';

    if (!deleteToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the creator of this note can delete it.' },
        { status: 403 }
      );
    }

    // Call backend API securely server-side to delete the note
    const response = await fetch(`${API_BASE_URL}/api/notes/${shareId}?token=${deleteToken}&deleteToken=${deleteToken}`, {
      method: 'DELETE',
      headers: {
        'X-Delete-Token': deleteToken,
        'Delete-Token': deleteToken,
        'accept': '*/*',
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete note from backend server' },
        { status: response.status }
      );
    }

    const res = NextResponse.json({ success: true, message: 'Note deleted successfully' });
    
    // Delete the secure cookie
    res.cookies.set(cookieName, '', { path: '/', maxAge: 0 });

    return res;
  } catch (error: any) {
    console.error('Error in DELETE proxy route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function resStatusIsNotOk(status: number): boolean {
  return status < 200 || status >= 300;
}
