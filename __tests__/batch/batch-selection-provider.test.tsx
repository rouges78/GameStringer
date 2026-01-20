import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchSelectionProvider, useBatchSelection } from '@/components/batch/batch-selection-provider';
import { BatchOperation } from '@/lib/types/batch-operations';
import { Languages } from 'lucide-react';

// Test component to access the context
function TestComponent() {
  const {
    selectedItems,
    selectAll,
    selectNone,
    toggleItem,
    toggleAll,
    isSelected,
    hasSelection,
    selectedCount,
    availableItems,
    setAvailableItems
  } = useBatchSelection();

  return (
    <div>
      <div data-testid="selected-count">{selectedCount}</div>
      <div data-testid="has-selection">{hasSelection.toString()}</div>
      <div data-testid="available-count">{availableItems.length}</div>
      
      <button onClick={selectAll} data-testid="select-all">
        Select All
      </button>
      <button onClick={selectNone} data-testid="select-none">
        Select None
      </button>
      <button onClick={() => toggleItem('item1')} data-testid="toggle-item1">
        Toggle Item 1
      </button>
      <button onClick={() => toggleAll(['item1', 'item2'])} data-testid="toggle-group">
        Toggle Group
      </button>
      <button onClick={() => setAvailableItems(['item1', 'item2', 'item3'])} data-testid="set-items">
        Set Items
      </button>
      
      <div data-testid="item1-selected">{isSelected('item1').toString()}</div>
      <div data-testid="item2-selected">{isSelected('item2').toString()}</div>
    </div>
  );
}

describe('BatchSelectionProvider', () => {
  const mockOperations: BatchOperation[] = [
    {
      id: 'test-op',
      name: 'Test Operation',
      icon: Languages,
      requiresConfirmation: false,
      action: async () => ({
        operationId: 'test',
        totalItems: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        duration: 0,
        completedAt: new Date()
      })
    }
  ];

  function renderWithProvider(initialItems: string[] = []) {
    return render(
      <BatchSelectionProvider 
        initialItems={initialItems}
        initialOperations={mockOperations}
      >
        <TestComponent />
      </BatchSelectionProvider>
    );
  }

  it('should initialize with empty selection', () => {
    renderWithProvider(['item1', 'item2']);
    
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('has-selection')).toHaveTextContent('false');
    expect(screen.getByTestId('available-count')).toHaveTextContent('2');
  });

  it('should select all items', () => {
    renderWithProvider(['item1', 'item2', 'item3']);
    
    fireEvent.click(screen.getByTestId('select-all'));
    
    expect(screen.getByTestId('selected-count')).toHaveTextContent('3');
    expect(screen.getByTestId('has-selection')).toHaveTextContent('true');
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('true');
    expect(screen.getByTestId('item2-selected')).toHaveTextContent('true');
  });

  it('should select none', () => {
    renderWithProvider(['item1', 'item2']);
    
    // First select all
    fireEvent.click(screen.getByTestId('select-all'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    
    // Then select none
    fireEvent.click(screen.getByTestId('select-none'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('has-selection')).toHaveTextContent('false');
  });

  it('should toggle individual items', () => {
    renderWithProvider(['item1', 'item2']);
    
    // Toggle item1 on
    fireEvent.click(screen.getByTestId('toggle-item1'));
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('true');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    
    // Toggle item1 off
    fireEvent.click(screen.getByTestId('toggle-item1'));
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('false');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('should toggle groups of items', () => {
    renderWithProvider(['item1', 'item2', 'item3']);
    
    // Toggle group on (both items should be selected)
    fireEvent.click(screen.getByTestId('toggle-group'));
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('true');
    expect(screen.getByTestId('item2-selected')).toHaveTextContent('true');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    
    // Toggle group off (both items should be deselected)
    fireEvent.click(screen.getByTestId('toggle-group'));
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('false');
    expect(screen.getByTestId('item2-selected')).toHaveTextContent('false');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('should update available items', () => {
    renderWithProvider(['item1']);
    
    expect(screen.getByTestId('available-count')).toHaveTextContent('1');
    
    fireEvent.click(screen.getByTestId('set-items'));
    expect(screen.getByTestId('available-count')).toHaveTextContent('3');
  });

  it('should handle partial group toggle', () => {
    renderWithProvider(['item1', 'item2', 'item3']);
    
    // Select item1 individually
    fireEvent.click(screen.getByTestId('toggle-item1'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    
    // Toggle group (item1, item2) - should select item2 since item1 is already selected
    fireEvent.click(screen.getByTestId('toggle-group'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    expect(screen.getByTestId('item1-selected')).toHaveTextContent('true');
    expect(screen.getByTestId('item2-selected')).toHaveTextContent('true');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useBatchSelection must be used within a BatchSelectionProvider');
    
    console.error = originalError;
  });
});