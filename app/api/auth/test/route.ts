import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('[API Test] Testing next-auth configuration...');
    
    const session = await getServerSession(authOptions);
    
    console.log('[API Test] Session:', session);
    
    return NextResponse.json({
      success: true,
      message: 'Next-auth API funzionante',
      session: session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API Test] Errore:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
