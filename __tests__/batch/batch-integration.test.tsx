import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchSelectionProvider } from '@/components/batch/batch-selection-provider';
import { BatchActionToolbar } from '@/components/batch/batch-action-toolbar';
import { BatchSelectionCheckbox } from '@/components/batch/batch-selection-checkbox';
import { BatchOperation } from '@/lib/types/batch-operations';
import { Languages, Download } from 'lucide-react';

// Mock batch operations
const mockOperations: BatchOperation[] = [
  {
    id: 'test-translate',
    name: 'Translate',
    icon: Languages,
    requiresConfirmation: false,
    action: vi.fn().mockResolvedValue({
      operationId: 'test-op-1',
      totalItems: 2,
      successCount: 2,
      failureCount: 0,
      results: [
        { itemId: 'item1', success: true, result: 'translated' },
        { itemId: 'item2', success: true, result: 'translated' }
      ],
      duration: 1000,
      completedAt: new Date()
    })
  },
  {
    id: 'test-export',
    name: 'Export',
    icon: Download,
    requiresConfirmation: true,
    action: vi.fn().mockResolvedValue({
      operationId: 'test-op-2',
      totalItems: 1,
      successCount: 1,
      failureCount: 0,
      results: [
        { itemId: 'item1', success: true, result: 'exported' }
      ],
      duration: 500,
      completedAt: new Date()
    })
  }
];

// Test component that uses batch selection
function TestBatchInterface() {
  return (
    <BatchSelectionProvider 
      initialItems={['item1', 'item2', 'item3']}
      initialOperations={mockOperations}
    >
      <div>
        <div className="items">
          <div className="item">
            <BatchSelectionCheckbox itemId="item1" />
            <span>Item 1</span>
          </div>
          <div className="item">
            <BatchSelectionCheckbox itemId="item2" />
            <span>Item 2</span>
          </div>
          <div className="item">
            <BatchSelectionCheckbox itemId="item3" />
            <span>Item 3</span>
          </div>
        </div>
        
        <BatchActionToolbar
          onOperationStart={(op, items) => {
            console.log(`Started ${op.name} on ${items.length} items`);
          }}
          onOperationComplete={(op, result) => {
            console.log(`Completed ${op.name}:`, result);
          }}
          onOperationError={(op, error) => {
            console.error(`Error in ${op.name}:`, error);
          }}
        />
      </div>
    </BatchSelectionProvider>
  );
}

describe('Batch Operations Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render batch interface without selection', () => {
    render(<TestBatchInterface />);
    
    // Should show checkboxes
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    
    // Should not show toolbar when nothing is selected
    expect(screen.queryByText('Translate')).not.toBeInTheDocument();
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('should show toolbar when items are selected', async () => {
    render(<TestBatchInterface />);
    
    // Select first item
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Toolbar should appear
    await waitFor(() => {
      expect(screen.getByText('Translate')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  it('should execute operation without confirmation', async () => {
    render(<TestBatchInterface />);
    
    // Select items
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    
    // Click translate button (no confirmation required)
    await waitFor(() => {
      expect(screen.getByText('Translate')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Translate'));
    
    // Should call the operation
    await waitFor(() => {
      expect(mockOperations[0].action).toHaveBeenCalledWith(['item1', 'item2']);
    });
  });

  it('should show confirmation dialog for operations that require it', async () => {
    render(<TestBatchInterface />);
    
    // Select an item
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Click export button (requires confirmation)
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Export'));
    
    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Confirm Batch Operation')).toBeInTheDocument();
    });
    
    // Should not have called the operation yet
    expect(mockOperations[1].action).not.toHaveBeenCalled();
    
    // Confirm the operation
    fireEvent.click(screen.getByText('Continue'));
    
    // Should call the operation
    await waitFor(() => {
      expect(mockOperations[1].action).toHaveBeenCalledWith(['item1']);
    });
  });

  it('should cancel confirmation dialog', async () => {
    render(<TestBatchInterface />);
    
    // Select an item
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Click export button
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Export'));
    
    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Confirm Batch Operation')).toBeInTheDocument();
    });
    
    // Cancel the operation
    fireEvent.click(screen.getByText('Cancel'));
    
    // Should not call the operation
    expect(mockOperations[1].action).not.toHaveBeenCalled();
    
    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText('Confirm Batch Operation')).not.toBeInTheDocument();
    });
  });

  it('should handle operation errors gracefully', async () => {
    const errorOperation: BatchOperation = {
      id: 'error-op',
      name: 'Error Op',
      icon: Languages,
      requiresConfirmation: false,
      action: vi.fn().mockRejectedValue(new Error('Operation failed'))
    };

    render(
      <BatchSelectionProvider 
        initialItems={['item1']}
        initialOperations={[errorOperation]}
      >
        <div>
          <BatchSelectionCheckbox itemId="item1" />
          <BatchActionToolbar />
        </div>
      </BatchSelectionProvider>
    );
    
    // Select item and execute operation
    fireEvent.click(screen.getByRole('checkbox'));
    
    await waitFor(() => {
      expect(screen.getByText('Error Op')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Error Op'));
    
    // Should handle the error without crashing
    await waitFor(() => {
      expect(errorOperation.action).toHaveBeenCalled();
    });
  });

  it('should clear selection after operation', async () => {
    render(<TestBatchInterface />);
    
    // Select items
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    
    // Verify selection
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
    
    // Clear selection
    fireEvent.click(screen.getByText('Clear'));
    
    // Should clear selection
    await waitFor(() => {
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    });
  });

  it('should handle multiple selection states correctly', async () => {
    render(<TestBatchInterface />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    
    // Select first item
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
    
    // Select second item
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
    
    // Deselect first item
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
    
    // Deselect second item
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(screen.queryByText('selected')).not.toBeInTheDocument();
    });
  });
});