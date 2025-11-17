import React from 'react';

interface SortOption {
    value: string;
    label: string;
}

interface DataManagerTemplateProps<T> {
  title: string;
  form: React.ReactNode;
  tableHeaders: string[];
  tableRows: React.ReactNode[];
  isEditing: boolean;
  resetForm: () => void;
  data: T[] | null;
  onExport: () => void;
  // Optional search and sort props
  searchTerm?: string;
  setSearchTerm?: (value: string) => void;
  searchPlaceholder?: string;
  sortBy?: string;
  setSortBy?: (value: string) => void;
  sortOrder?: 'asc' | 'desc';
  setSortOrder?: (value: 'asc' | 'desc') => void;
  sortOptions?: SortOption[];
}

export const DataManagerTemplate = <T,>({
  title,
  form,
  tableHeaders,
  tableRows,
  isEditing,
  resetForm,
  data,
  onExport,
  searchTerm,
  setSearchTerm,
  searchPlaceholder,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  sortOptions
}: DataManagerTemplateProps<T>) => {
  const showSearchSort = setSearchTerm && setSortBy && setSortOrder && sortOptions;

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{isEditing ? `Edit ${title.slice(0, -1)}` : `Add New ${title.slice(0, -1)}`}</h2>
            {isEditing && (
                <button
                    onClick={resetForm}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    Cancel Edit
                </button>
            )}
        </div>
        {form}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Manage {title}</h2>
            <button
                onClick={onExport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
                Export All
            </button>
        </div>

        {showSearchSort && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b">
                <div className="md:col-span-1">
                    <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">Search</label>
                    <input
                        type="text"
                        id="searchTerm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={searchPlaceholder}
                    />
                </div>
                <div>
                    <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">Sort By</label>
                    <select
                        id="sortBy"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                     <label className="block text-sm font-medium text-gray-700">Order</label>
                     <button
                        type="button"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="mt-1 w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-md shadow-sm flex items-center justify-center"
                     >
                        {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                     </button>
                </div>
            </div>
        )}
        
        {data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {tableHeaders.map((header, index) => (
                    <th key={index} scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${header === 'Actions' ? 'text-right' : 'text-left'}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableRows}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {searchTerm ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} found. Add one to get started.`}
          </p>
        )}
      </div>
    </div>
  );
};
