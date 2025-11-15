
import React, { useState, useEffect } from 'react';
import type { SalesPerson } from '../types';
import { SALES_PERSON_NAMES } from '../constants';
import { DataManagerTemplate } from './common/DataManagerTemplate';

declare var XLSX: any;

interface SalesPersonManagerProps {
  salesPersons: SalesPerson[] | null;
  setSalesPersons: (value: React.SetStateAction<SalesPerson[]>) => Promise<void>;
}

const emptySalesPerson: Omit<SalesPerson, 'id'> = { name: '', email: '', mobile: '' };

export const SalesPersonManager: React.FC<SalesPersonManagerProps> = ({ salesPersons, setSalesPersons }) => {
  const [currentPerson, setCurrentPerson] = useState<Omit<SalesPerson, 'id'> | SalesPerson>(emptySalesPerson);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setIsEditing(false);
    setCurrentPerson(emptySalesPerson);
  };
  
  const handleEdit = (person: SalesPerson) => {
    setCurrentPerson(person);
    setIsEditing(true);
  };
  
  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this sales person?")) {
        await setSalesPersons(prev => (prev || []).filter(p => p.id !== id));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCurrentPerson({ ...currentPerson, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditing) {
        await setSalesPersons(prev => (prev || []).map(p => p.id === (currentPerson as SalesPerson).id ? currentPerson as SalesPerson : p));
      } else {
        await setSalesPersons(prev => {
          const prevPeople = prev || [];
          const newId = prevPeople.length > 0 ? Math.max(...prevPeople.map(p => p.id)) + 1 : 1;
          return [...prevPeople, { ...currentPerson, id: newId } as SalesPerson];
        });
      }
      resetForm();
    } catch (error) {
        alert("Failed to save sales person. Please try again.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!salesPersons) return;
    const dataToExport = salesPersons.map(({ id, name, email, mobile }) => ({ ID: id, Name: name, Email: email, Mobile: mobile }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesPersons");
    XLSX.writeFile(wb, "SalesPersons_Export.xlsx");
  };

  if (salesPersons === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading sales persons...</div>;
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset disabled={isSaving}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Sales Person</label>
              <select name="name" id="name" value={currentPerson.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Select a name</option>
                  {SALES_PERSON_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
          </div>
          <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" id="email" value={currentPerson.email} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
              <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">Mobile No.</label>
              <input type="tel" name="mobile" id="mobile" value={currentPerson.mobile} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50">
            {isSaving ? 'Saving...' : isEditing ? 'Update Sales Person' : 'Add Sales Person'}
          </button>
        </div>
      </fieldset>
    </form>
  );

  const tableRows = salesPersons.map(person => (
    <tr key={person.id} className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.id}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{person.name}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.email}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.mobile}</td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
        <button onClick={() => handleEdit(person)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
        <button onClick={() => handleDelete(person.id)} className="text-red-600 hover:text-red-900">Delete</button>
      </td>
    </tr>
  ));

  return (
    <DataManagerTemplate<SalesPerson>
      title="Sales Persons"
      form={form}
      tableHeaders={['ID', 'Name', 'Email', 'Mobile', 'Actions']}
      tableRows={tableRows}
      isEditing={isEditing}
      resetForm={resetForm}
      data={salesPersons}
      onExport={handleExport}
    />
  );
};
