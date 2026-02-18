import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Save, Download, LogOut, Database, RefreshCw, ChevronRight, ChevronDown, Table2, FileJson, FileSpreadsheet } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { api, type QueryResult, type TableInfo } from '../lib/api';
import QueryResults from '../components/QueryResults';
import toast from 'react-hot-toast';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [sql, setSql] = useState('SELECT 1 as test;');
  const [selectedSchema, setSelectedSchema] = useState('main');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Fetch schemas
  const { data: schemasData } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => api.get<{ schemas: string[] }>('/schemas'),
  });

  // Fetch tables for selected schema
  const { data: tablesData, refetch: refetchTables } = useQuery({
    queryKey: ['tables', selectedSchema],
    queryFn: () => api.get<{ tables: TableInfo[] }>(`/tables/${selectedSchema}`),
    enabled: !!selectedSchema,
  });

  // Fetch saved queries
  const { data: savedQueriesData } = useQuery({
    queryKey: ['queries'],
    queryFn: () => api.get<{ queries: Array<{ id: string; name: string; sql: string; tags: string[] }> }>('/queries'),
  });

  // Execute query mutation
  const executeMutation = useMutation({
    mutationFn: (query: string) => api.post<QueryResult>('/query', { sql: query }),
    onSuccess: () => {
      toast.success('Query executed successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Query failed');
    },
  });

  // Save query mutation
  const saveMutation = useMutation({
    mutationFn: (data: { name: string; sql: string; tags: string[] }) =>
      api.post('/queries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast.success('Query saved');
    },
  });

  // Delete query mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/queries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast.success('Query deleted');
    },
  });

  const result = executeMutation.data;

  const handleExecute = useCallback(() => {
    if (sql.trim()) {
      executeMutation.mutate(sql);
    }
  }, [sql, executeMutation]);

  const handleSave = useCallback(() => {
    const name = prompt('Enter query name:');
    if (name) {
      saveMutation.mutate({ name, sql, tags: [] });
    }
  }, [sql, saveMutation]);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    if (!result) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      const jsonData = result.data.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => {
          obj[col.name] = row[i];
        });
        return obj;
      });
      content = JSON.stringify(jsonData, null, 2);
      filename = 'query_result.json';
      mimeType = 'application/json';
    } else {
      const header = result.columns.map((c) => c.name).join(',');
      const rows = result.data.map((row) => row.map(cell => {
        // Escape cells with commas or quotes
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')).join('\n');
      content = `${header}\n${rows}`;
      filename = 'query_result.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    onLogout();
  }, [onLogout]);

  const toggleTable = useCallback((tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  }, []);

  const insertToEditor = useCallback((text: string) => {
    setSql((prev) => prev + text);
  }, []);

  const loadQuery = useCallback((querySql: string) => {
    setSql(querySql);
  }, []);

  const generateSelectQuery = useCallback((tableName: string, columns: string[]) => {
    const cols = columns.join(', ');
    setSql(`SELECT ${cols}\nFROM ${tableName}\nLIMIT 100;`);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold text-white">White Duck</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Schema:
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="ml-2 bg-gray-700 text-white px-2 py-1 rounded border border-gray-600"
            >
              {schemasData?.schemas?.map((schema) => (
                <option key={schema} value={schema}>{schema}</option>
              ))}
              {!schemasData?.schemas?.length && <option value="main">main</option>}
            </select>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Schema Explorer */}
        <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* Tables section */}
            <div className="border-b border-gray-700">
              <div className="p-3 flex items-center justify-between bg-gray-750">
                <h2 className="text-sm font-semibold text-gray-300 uppercase flex items-center gap-2">
                  <Table2 className="w-4 h-4" />
                  Tables
                </h2>
                <button
                  onClick={() => refetchTables()}
                  className="p-1 hover:bg-gray-700 rounded"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="p-2">
                {tablesData?.tables?.map((table) => (
                  <div key={table.name} className="mb-1">
                    <button
                      onClick={() => toggleTable(table.name)}
                      className="w-full flex items-center gap-1 px-2 py-1.5 text-left text-gray-300 hover:bg-gray-700 rounded"
                    >
                      {expandedTables.has(table.name) ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate text-sm">{table.name}</span>
                    </button>

                    {expandedTables.has(table.name) && (
                      <div className="ml-4 mt-1 border-l border-gray-600 pl-2">
                        {table.columns.map((col) => (
                          <button
                            key={col.name}
                            onClick={() => insertToEditor(col.name)}
                            className="w-full text-left px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded flex justify-between"
                          >
                            <span>{col.name}</span>
                            <span className="text-xs text-gray-500">{col.type}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => generateSelectQuery(
                            table.name,
                            table.columns.slice(0, 5).map(c => c.name)
                          )}
                          className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"
                        >
                          SELECT * FROM {table.name} ...
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!tablesData?.tables?.length && (
                  <div className="p-4 text-sm text-gray-500 text-center">No tables found</div>
                )}
              </div>
            </div>

            {/* Saved Queries section */}
            <div>
              <div className="p-3 flex items-center justify-between bg-gray-750">
                <h2 className="text-sm font-semibold text-gray-300 uppercase flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  Saved Queries
                </h2>
              </div>

              <div className="p-2">
                {savedQueriesData?.queries?.map((query) => (
                  <div key={query.id} className="group flex items-center gap-1 mb-1">
                    <button
                      onClick={() => loadQuery(query.sql)}
                      className="flex-1 text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded truncate"
                      title={query.sql}
                    >
                      {query.name}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(query.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {!savedQueriesData?.queries?.length && (
                  <div className="p-4 text-sm text-gray-500 text-center">No saved queries</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Query Editor */}
          <div className="border-b border-gray-700" style={{ height: '280px' }}>
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-sm text-gray-400">Query Editor</span>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executeMutation.isPending}
                  className="flex items-center gap-1 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {executeMutation.isPending ? 'Running...' : 'Run (Ctrl+Enter)'}
                </button>
              </div>
            </div>
            <div className="h-full">
              <Editor
                height="100%"
                defaultLanguage="sql"
                value={sql}
                onChange={(value) => setSql(value || '')}
                theme="vs-dark"
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter') {
                    handleExecute();
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                  wordWrap: 'on',
                  tabSize: 2,
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-sm text-gray-400">
                {executeMutation.isError ? (
                  <span className="text-red-400">Error</span>
                ) : result ? (
                  <>
                    Results: <span className="text-green-400">{result.rowCount} rows</span>
                    <span className="mx-2">•</span>
                    <span className="text-blue-400">{result.executionTime.toFixed(3)}s</span>
                  </>
                ) : (
                  'Results'
                )}
              </span>
              {result && result.rowCount > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                  >
                    <FileJson className="w-3 h-3" />
                    JSON
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {executeMutation.isError && (
                <div className="p-4 m-4 bg-red-900/30 border border-red-800 rounded text-red-400">
                  <div className="font-semibold mb-1">Query Error</div>
                  {executeMutation.error?.message || 'Query failed'}
                </div>
              )}
              {executeMutation.isPending && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span className="text-gray-400">Executing query...</span>
                  </div>
                </div>
              )}
              {result && !executeMutation.isPending && <QueryResults result={result} />}
              {!result && !executeMutation.isPending && !executeMutation.isError && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Database className="w-12 h-12 mb-4 opacity-50" />
                  <p>Execute a query to see results</p>
                  <p className="text-sm mt-2">Press Ctrl+Enter to run</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
