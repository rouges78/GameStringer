import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Middleware per gestire le richieste API next-auth
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Per le API next-auth, permettiamo sempre l'accesso
        if (req.nextUrl.pathname.startsWith('/api/auth')) {
          return true;
        }
        
        // Per altre API protette, verifichiamo il token
        if (req.nextUrl.pathname.startsWith('/api/protected')) {
          return !!token;
        }
        
        return true;
      },
    },
  }
);

export const config = {
  matcher: ['/api/auth/:path*', '/api/protected/:path*']
};
