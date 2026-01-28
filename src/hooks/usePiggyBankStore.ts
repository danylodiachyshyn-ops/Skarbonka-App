import { create } from 'zustand';
import { PiggyBank, Transaction } from '@/src/lib/database.types';

interface PiggyBankStore {
  piggyBanks: PiggyBank[];
  transactions: Transaction[];
  currentPiggyBankIndex: number;
  setPiggyBanks: (banks: PiggyBank[]) => void;
  addPiggyBank: (bank: Omit<PiggyBank, 'id' | 'created_at' | 'updated_at'>) => void;
  updatePiggyBank: (id: string, updates: Partial<PiggyBank>) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => void;
  setCurrentIndex: (index: number) => void;
  getCurrentPiggyBank: () => PiggyBank | null;
  getTransactionsForBank: (piggyBankId: string) => Transaction[];
  getTotalSavedThisMonth: () => number;
}

export const usePiggyBankStore = create<PiggyBankStore>((set, get) => ({
  piggyBanks: [],
  transactions: [],
  currentPiggyBankIndex: 0,

  setPiggyBanks: (banks) => set({ piggyBanks: banks }),

  addPiggyBank: (bank) => {
    const newBank: PiggyBank = {
      ...bank,
      id: `pb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      piggyBanks: [...state.piggyBanks, newBank],
    }));
  },

  updatePiggyBank: (id, updates) => {
    set((state) => ({
      piggyBanks: state.piggyBanks.map((bank) =>
        bank.id === id
          ? { ...bank, ...updates, updated_at: new Date().toISOString() }
          : bank
      ),
    }));
  },

  addTransaction: (transaction) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    };

    set((state) => {
      // Update the piggy bank's current_amount
      const updatedBanks = state.piggyBanks.map((bank) =>
        bank.id === transaction.piggy_bank_id
          ? {
              ...bank,
              current_amount: Number(bank.current_amount) + Number(transaction.amount),
              updated_at: new Date().toISOString(),
            }
          : bank
      );

      return {
        transactions: [...state.transactions, newTransaction],
        piggyBanks: updatedBanks,
      };
    });
  },

  setCurrentIndex: (index) => set({ currentPiggyBankIndex: index }),

  getCurrentPiggyBank: () => {
    const state = get();
    return state.piggyBanks[state.currentPiggyBankIndex] || null;
  },

  getTransactionsForBank: (piggyBankId) => {
    return get().transactions.filter((tx) => tx.piggy_bank_id === piggyBankId);
  },

  getTotalSavedThisMonth: () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return get().transactions
      .filter((tx) => new Date(tx.date) >= startOfMonth)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  },
}));
