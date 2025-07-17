import { NextRequest, NextResponse } from 'next/server';
import { getBatchAISuggestions } from '@/lib/db-queries';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const translationId = searchParams.get('translationId');
    const translationIds = searchParams.get('translationIds')?.split(',');

    // Handle batch requests for multiple translations
    if (translationIds && translationIds.length > 0) {
      const suggestions = await getBatchAISuggestions(translationIds);
      
      // Group suggestions by translation ID
      const grouped = suggestions.reduce((acc, suggestion) => {
        const { translationId } = suggestion;
        if (!acc[translationId]) acc[translationId] = [];
        acc[translationId].push(suggestion);
        return acc;
      }, {} as Record<string, typeof suggestions>);

      return NextResponse.json(grouped);
    }

    // Handle single translation request
    if (!translationId) {
      return NextResponse.json(
        { error: 'Missing translationId parameter' },
        { status: 400 }
      );
    }

    const suggestions = await prisma.aISuggestion.findMany({
      where: { translationId },
      orderBy: { confidence: 'desc' },
      take: 5
    });

    return NextResponse.json(suggestions);

  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { translationId, originalText, targetLanguage, provider = 'openai' } = body;

    if (!translationId || !originalText || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields: translationId, originalText, targetLanguage' },
        { status: 400 }
      );
    }

    // Simulate AI suggestion generation (replace with actual AI API calls)
    const mockSuggestions = await generateMockSuggestions(originalText, targetLanguage);

    // Create AI suggestions in database
    const suggestions = await Promise.all(
      mockSuggestions.map((suggestion, index) =>
        prisma.aISuggestion.create({
          data: {
            translationId,
            suggestion: suggestion.text,
            confidence: suggestion.confidence,
            provider
          }
        })
      )
    );

    return NextResponse.json(suggestions, { status: 201 });

  } catch (error) {
    console.error('Error creating AI suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to create AI suggestions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const translationId = searchParams.get('translationId');

    if (id) {
      // Delete specific suggestion
      await prisma.aISuggestion.delete({
        where: { id }
      });
      return NextResponse.json({ message: 'Suggestion deleted successfully' });
    }

    if (translationId) {
      // Delete all suggestions for a translation
      const result = await prisma.aISuggestion.deleteMany({
        where: { translationId }
      });
      return NextResponse.json({ 
        message: `Deleted ${result.count} suggestions`,
        count: result.count
      });
    }

    return NextResponse.json(
      { error: 'Missing id or translationId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error deleting AI suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to delete AI suggestion' },
      { status: 500 }
    );
  }
}

// Mock AI suggestion generator (replace with actual AI integration)
async function generateMockSuggestions(originalText: string, targetLanguage: string) {
  // This would be replaced with actual AI API calls
  const mockSuggestions = [
    { text: `${originalText} - Suggestion 1`, confidence: 0.95 },
    { text: `${originalText} - Suggestion 2`, confidence: 0.88 },
    { text: `${originalText} - Suggestion 3`, confidence: 0.82 }
  ];

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  return mockSuggestions;
}