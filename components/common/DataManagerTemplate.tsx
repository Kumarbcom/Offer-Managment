
import React from 'react';

interface DataManagerTemplateProps<T> {
  title: string;
  form: React.ReactNode;
  tableHeaders: string[];
  tableRows: React.ReactNode[];
  isEditing: boolean;
  resetForm: () => void;
  data: T[] | null;
  onExport: () => void;
}

export const DataManagerTemplate = <T,>({
  title,
  form,
  tableHeaders,
  tableRows,
  isEditing,
  resetForm,
  data,
  onExport
}: DataManagerTemplateProps<T>) => {
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
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Manage {title}</h2>
            <button
                onClick={onExport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
                Export All
            </button>
        </div>
        
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
          <p className="text-gray-500 text-center py-8">No {title.toLowerCase()} found. Add one to get started.</p>
        )}
      </div>
    </div>
  );
};
