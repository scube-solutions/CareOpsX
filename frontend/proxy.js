import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function middleware(request) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/home.html', request.url));
  }
}

export const config = {
  matcher: ['/'],
};
