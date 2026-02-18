import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QueryResults from '../components/QueryResults';
import type { QueryResult } from '../lib/api';

describe('QueryResults Component', () => {
  const mockResult: QueryResult = {
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    data: [
      [1, 'Alice', 'alice@test.com'],
      [2, 'Bob', 'bob@test.com'],
    ],
    rowCount: 2,
    executionTime: 0.05,
  };

  test('should render table with data', () => {
    render(<QueryResults result={mockResult} />);

    // Check headers
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();

    // Check data
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  test('should show message for empty results', () => {
    const emptyResult: QueryResult = {
      columns: [],
      data: [],
      rowCount: 0,
      executionTime: 0.01,
    };

    render(<QueryResults result={emptyResult} />);

    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  test('should handle null values', () => {
    const resultWithNull: QueryResult = {
      columns: [
        { name: 'id', type: 'number' },
        { name: 'value', type: 'string' },
      ],
      data: [[1, null]],
      rowCount: 1,
      executionTime: 0.01,
    };

    render(<QueryResults result={resultWithNull} />);

    expect(screen.getByText('null')).toBeInTheDocument();
  });

  test('should handle boolean values', () => {
    const resultWithBool: QueryResult = {
      columns: [
        { name: 'active', type: 'boolean' },
      ],
      data: [[true], [false]],
      rowCount: 2,
      executionTime: 0.01,
    };

    render(<QueryResults result={resultWithBool} />);

    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});
