import type { User } from './types';

export const USERS: User[] = [
  // Admin
  { name: 'Kumar', password: '123456', role: 'Admin' },
  { name: 'Vandita', password: '123456', role: 'Admin' },
  { name: 'Ranjan', password: '123456', role: 'Admin' },

  // Management
  { name: 'Gurudatta', password: '123456', role: 'Management' },
  { name: 'Purshothama', password: '123456', role: 'Management' },
  { name: 'DC Venugopal', password: '123456', role: 'Management' },
  
  // Sales Person
  { name: 'Giridhar', password: '123456', role: 'Sales Person' },
  { name: 'Ananthapadmanabha Phandari', password: '123456', role: 'Sales Person' },
  { name: 'Veeresh', password: '123456', role: 'Sales Person' },
  { name: 'Office', password: '123456', role: 'Sales Person' },

  // SCM
  { name: 'Rachana', password: '123456', role: 'SCM' },
  { name: 'Mohan', password: '123456', role: 'SCM' },
  { name: 'Geetha', password: '123456', role: 'SCM' },
];