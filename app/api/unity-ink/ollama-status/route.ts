import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const resp = await fetch('http://localhost:11434/api/tags', { 
      signal: AbortSignal.timeout(3000) 
    });
    
    if (!resp.ok) {
      return NextResponse.json({ online: false, models: [] });
    }
    
    const data = await resp.json();
    const models = (data.models || []).map((m: any) => m.name);
    
    return NextResponse.json({ online: true, models });
  } catch {
    return NextResponse.json({ online: false, models: [] });
  }
}
