export interface Shop {
  id: string;
  name: string;
  location: string;
  ownerName: string;
  createdAt: Date;
}

// Initial shops data - Update this array to add/remove shops
export const shopsData: Shop[] = [
  {
    id: '1',
    name: 'Classic Cuts Barber',
    location: '123 Main Street, Downtown',
    ownerName: 'John Smith',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Elite Barbershop',
    location: '456 Oak Avenue, Midtown',
    ownerName: 'Maria Garcia',
    createdAt: new Date('2024-01-20'),
  },
  {
    id: '1761822010389',
    name: 'bdjdvbkj',
    location: 'biwiu ji',
    ownerName: 'gama pehlvan',
    createdAt: new Date('2025-10-30T11:00:10.389Z'),
  },
];
