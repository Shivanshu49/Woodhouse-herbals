export interface Money {
  amount: number;
  currency: 'INR';
}

export const toMoney = (minor: number): Money => ({ amount: minor, currency: 'INR' });
export const fromRupees = (rupees: number): Money => ({ amount: Math.round(rupees * 100), currency: 'INR' });
