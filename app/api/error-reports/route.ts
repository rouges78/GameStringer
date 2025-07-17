import { NextRequest, NextResponse } from 'next/server';
import { globalErrorHandler } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const errorId = searchParams.get('errorId');

    if (errorId) {
      // Get specific error report
      const report = globalErrorHandler.getErrorReport(errorId);
      if (!report) {
        return NextResponse.json(
          { error: 'Error report not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(report);
    }

    // Get all error reports
    const reports = globalErrorHandler.getErrorReports();
    return NextResponse.json({
      reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Error fetching error reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error reports' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Clear all error reports
    globalErrorHandler.clearErrorReports();
    
    return NextResponse.json({
      message: 'Error reports cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing error reports:', error);
    return NextResponse.json(
      { error: 'Failed to clear error reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { error, errorInfo, context } = body;

    if (!error) {
      return NextResponse.json(
        { error: 'Missing error data' },
        { status: 400 }
      );
    }

    // Create error object from client data
    const errorObject = new Error(error.message || 'Unknown error');
    errorObject.name = error.name || 'ClientError';
    errorObject.stack = error.stack;

    // Handle client-side error
    const report = globalErrorHandler.handleClientError(
      errorObject,
      errorInfo,
      context
    );

    return NextResponse.json({
      message: 'Error report created successfully',
      errorId: report.errorId
    });

  } catch (error) {
    console.error('Error creating error report:', error);
    return NextResponse.json(
      { error: 'Failed to create error report' },
      { status: 500 }
    );
  }
}