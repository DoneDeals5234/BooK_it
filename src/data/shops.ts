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
    id: '1761822010389',
    name: 'bdjdvbkj',
    location: 'biwiu ji',
    ownerName: 'gama pehlvan',
    createdAt: new Date('2025-10-30T11:00:10.389Z'),
  },
];
