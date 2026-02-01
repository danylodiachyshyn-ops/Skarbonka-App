import { create } from 'zustand';
import { UserBox, Transaction, BoxTemplate, TransactionInsert, UserBoxInsert } from '@/src/lib/database.types';
import { supabase } from '@/src/lib/supabase';
import {
  getOfflineQueue,
  setOfflineQueue,
  addToOfflineQueue,
  getCachedBoxes,
  setCachedBoxes,
  getCachedTransactions,
  setCachedTransactions,
  isLikelyNetworkError,
} from '@/src/lib/offlineQueue';
import { getRates } from '@/src/lib/currencyApi';
import { useAuthStore } from './useAuthStore';

// Type for UserBox with joined template data
export type UserBoxWithTemplate = UserBox & {
  box_templates: Pick<BoxTemplate, 'name' | 'total_amount' | 'grid_config' | 'currency'> | null;
};

interface BoxStore {
  userBoxes: UserBox[];
  transactions: Transaction[];
  currentBoxIndex: number;
  loading: boolean;
  error: string | null;
  
  // Actions
  reset: () => void;
  setUserBoxes: (boxes: UserBox[]) => void;
  setCurrentIndex: (index: number) => void;
  getCurrentBox: () => UserBox | null;
  getTransactionsForBox: (boxId: string) => Transaction[];
  getBalanceOverTimeForBox: (
    boxId: string,
    period: 'week' | 'month' | 'all'
  ) => { label: string; balance: number; date: string }[];
  getTotalSavedThisMonth: () => number;
  
  // Supabase async actions
  processOfflineQueue: () => Promise<void>;
  fetchUserBoxes: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  addTransaction: (boxId: string, amount: number, note?: string | null) => Promise<void>;
  withdrawFromBox: (boxId: string, amount: number, note?: string | null) => Promise<void>;
  resetBoxBalance: (boxId: string) => Promise<void>;
  crossOutIndex: (boxId: string, index: number) => Promise<void>;
  createBoxFromTemplate: (templateId: string, name?: string) => Promise<void>;
  createUserBox: (name: string, targetAmount?: number | null, currency?: string | null) => Promise<string | null>;
  archiveUserBox: (boxId: string) => Promise<void>;
  unarchiveUserBox: (boxId: string) => Promise<void>;
  deleteUserBox: (boxId: string) => Promise<void>;
  updateBoxName: (boxId: string, name: string) => Promise<void>;
  updateBoxTargetAmount: (boxId: string, targetAmount: number | null) => Promise<void>;
  updateBoxCurrency: (boxId: string, currency: string) => Promise<void>;
  updateBoxCurrencyWithConversion: (boxId: string, newCurrency: string) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  
  // Legacy sync methods (kept for backward compatibility)
  addUserBox: (box: Omit<UserBox, 'id' | 'created_at' | 'updated_at'>) => void;
  updateUserBox: (id: string, updates: Partial<UserBox>) => void;
}

export const useBoxStore = create<BoxStore>((set, get) => ({
  userBoxes: [],
  transactions: [],
  currentBoxIndex: 0,
  loading: false,
  error: null,

  reset: () =>
    set({
      userBoxes: [],
      transactions: [],
      currentBoxIndex: 0,
      error: null,
    }),

  setUserBoxes: (boxes) => set({ userBoxes: boxes }),

  setCurrentIndex: (index) => set({ currentBoxIndex: index }),

  getCurrentBox: () => {
    const state = get();
    return state.userBoxes[state.currentBoxIndex] ?? null;
  },

  getTransactionsForBox: (boxId) => {
    return get().transactions.filter((tx) => tx.box_id === boxId);
  },

  /** Returns chart data: cumulative balance over time for the given period. Uses box current_amount so the chart ends at the real balance. */
  getBalanceOverTimeForBox: (
    boxId: string,
    period: 'week' | 'month' | 'all'
  ): { label: string; balance: number; date: string }[] => {
    const state = get();
    const box = state.userBoxes.find((b) => b.id === boxId);
    const currentAmount = box ? Number(box.current_amount) : 0;

    const dayStr = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.toISOString().slice(0, 10);
    };
    const txList = state.transactions
      .filter((tx) => tx.box_id === boxId)
      .map((tx) => ({ ...tx, date: new Date(tx.date) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let start: Date;
    let dayCount: number;
    if (period === 'week') {
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      dayCount = 7;
    } else if (period === 'month') {
      start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      dayCount = 30;
    } else {
      if (txList.length === 0) {
        if (currentAmount === 0) return [];
        return [
          {
            label: 'Start',
            balance: 0,
            date: dayStr(now),
          },
          {
            label: 'Now',
            balance: currentAmount,
            date: dayStr(now),
          },
        ];
      }
      start = new Date(txList[0].date);
      start.setHours(0, 0, 0, 0);
      dayCount = 0;
    }

    const dateStrings: string[] = [];
    if (period === 'week' || period === 'month') {
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dateStrings.push(dayStr(d));
      }
    } else {
      const set = new Set<string>();
      for (const tx of txList) set.add(dayStr(tx.date));
      dateStrings.push(...Array.from(set).sort());
    }

    const startEndOfDay = new Date(start);
    startEndOfDay.setHours(0, 0, 0, 0);
    const txInPeriod =
      period === 'all'
        ? txList
        : txList.filter((tx) => tx.date >= startEndOfDay);
    const sumInPeriod = txInPeriod.reduce((s, tx) => s + Number(tx.amount), 0);
    const startBalance = Math.max(0, currentAmount - sumInPeriod);

    const result: { label: string; balance: number; date: string }[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (const dateStr of dateStrings) {
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      let balance: number;
      if (period === 'all') {
        balance = txList
          .filter((tx) => tx.date <= endOfDay)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
      } else {
        const sumUpToDay = txInPeriod
          .filter((tx) => tx.date <= endOfDay)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
        balance = startBalance + sumUpToDay;
      }
      const d = new Date(dateStr);
      const label =
        period === 'week'
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
          : period === 'month'
            ? `${d.getDate()}`
            : `${d.getDate()} ${months[d.getMonth()]}`;
      result.push({ label, balance, date: dateStr });
    }
    const lastDateIsToday = dateStrings.length > 0 && dateStrings[dateStrings.length - 1] === dayStr(now);
    if (result.length > 0 && (period === 'week' || period === 'month' || lastDateIsToday)) {
      result[result.length - 1].balance = currentAmount;
    }
    return result;
  },

  getTotalSavedThisMonth: () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return get().transactions
      .filter((tx) => new Date(tx.date) >= startOfMonth)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  },

  // ============================================
  // SUPABASE ASYNC ACTIONS
  // ============================================

  processOfflineQueue: async () => {
    let queue = await getOfflineQueue();
    while (queue.length > 0) {
      const item = queue[0];
      const amount = item.action === 'withdraw' ? -Math.abs(item.amount) : Math.abs(item.amount);
      const { error } = await supabase
        .from('transactions')
        .insert({
          box_id: item.boxId,
          amount,
          note: item.note ?? null,
          date: item.date,
        } as never);
      if (error) {
        console.warn('Offline queue item failed, will retry:', error.message);
        break;
      }
      queue = queue.slice(1);
      await setOfflineQueue(queue);
    }
  },

  fetchUserBoxes: async () => {
    set({ loading: true, error: null });
    try {
      await get().processOfflineQueue();
    } catch (_) {
      // ignore
    }
    try {
      const { data, error } = await supabase
        .from('user_boxes')
        .select('*, box_templates(name, total_amount, grid_config, currency)')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const boxes: UserBox[] = (data as UserBoxWithTemplate[]).map((item) => ({
        ...item,
      })) as UserBox[];

      set({ userBoxes: boxes, loading: false });
      await setCachedBoxes(boxes);
      await get().fetchTransactions();
    } catch (err: any) {
      console.error('Error fetching user boxes:', err);
      const cached = await getCachedBoxes();
      if (cached && cached.length >= 0) {
        set({ userBoxes: cached, loading: false });
        await get().fetchTransactions();
      } else {
        set({ error: err.message || 'Failed to fetch boxes', loading: false });
      }
    }
  },

  fetchTransactions: async () => {
    const boxIds = get().userBoxes.map((b) => b.id);
    if (boxIds.length === 0) {
      set({ transactions: [] });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('box_id', boxIds)
        .order('date', { ascending: false });
      if (error) throw error;
      const tx = (data ?? []) as Transaction[];
      set({ transactions: tx });
      await setCachedTransactions(tx);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      const cached = await getCachedTransactions();
      if (cached) set({ transactions: cached });
    }
  },

  addTransaction: async (boxId: string, amount: number, note?: string | null) => {
    set({ loading: true, error: null });

    try {
      // Optimistic update: update local state immediately
      const state = get();
      const box = state.userBoxes.find((b) => b.id === boxId);
      if (!box) {
        throw new Error('Box not found');
      }

      const newAmount = Number(box.current_amount) + Number(amount);
      
      // Optimistically update UI
      set((prevState) => ({
        userBoxes: prevState.userBoxes.map((b) =>
          b.id === boxId
            ? {
                ...b,
                current_amount: newAmount,
                updated_at: new Date().toISOString(),
              }
            : b
        ),
      }));

      // Insert transaction into Supabase
      const transactionInsert: TransactionInsert = {
        box_id: boxId,
        amount,
        note: note ?? null,
        date: new Date().toISOString(),
      };
      
      const { data: transactionData, error: txError } = await supabase
        .from('transactions')
        .insert(transactionInsert as any)
        .select()
        .single();

      if (txError) {
        if (isLikelyNetworkError(txError)) {
          await addToOfflineQueue({
            action: 'add',
            boxId,
            amount,
            note: note ?? null,
            date: new Date().toISOString(),
          });
          const tempTx: Transaction = {
            id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            box_id: boxId,
            amount,
            note: note ?? null,
            date: new Date().toISOString(),
          };
          set((prevState) => ({
            transactions: [tempTx, ...prevState.transactions],
          }));
          set({ loading: false });
          return;
        }
        set((prevState) => ({
          userBoxes: prevState.userBoxes.map((b) =>
            b.id === boxId ? box : b
          ),
        }));
        throw txError;
      }

      // The trigger `update_box_amount` will update current_amount in the database
      // But we already updated it optimistically, so we're in sync
      
      // Add transaction to local state
      if (transactionData) {
        set((prevState) => ({
          transactions: [...prevState.transactions, transactionData as Transaction],
        }));
      }

      set({ loading: false });
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      set({ error: err.message || 'Failed to add transaction', loading: false });
    }
  },

  withdrawFromBox: async (boxId: string, amount: number, note?: string | null) => {
    set({ loading: true, error: null });

    try {
      const state = get();
      const box = state.userBoxes.find((b) => b.id === boxId);
      if (!box) throw new Error('Box not found');

      const absAmount = Math.abs(amount);
      const current = Number(box.current_amount);
      if (absAmount <= 0 || current < absAmount) {
        throw new Error(current < absAmount ? 'Not enough balance' : 'Enter a valid amount');
      }

      const newAmount = current - absAmount;

      set((prevState) => ({
        userBoxes: prevState.userBoxes.map((b) =>
          b.id === boxId
            ? { ...b, current_amount: newAmount, updated_at: new Date().toISOString() }
            : b
        ),
      }));

      const transactionInsert: TransactionInsert = {
        box_id: boxId,
        amount: -absAmount,
        note: note ?? null,
        date: new Date().toISOString(),
      };

      const { data: transactionData, error: txError } = await supabase
        .from('transactions')
        .insert(transactionInsert as any)
        .select()
        .single();

      if (txError) {
        if (isLikelyNetworkError(txError)) {
          await addToOfflineQueue({
            action: 'withdraw',
            boxId,
            amount: absAmount,
            note: note ?? null,
            date: new Date().toISOString(),
          });
          const tempTx: Transaction = {
            id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            box_id: boxId,
            amount: -absAmount,
            note: note ?? null,
            date: new Date().toISOString(),
          };
          set((prevState) => ({
            transactions: [tempTx, ...prevState.transactions],
          }));
          set({ loading: false });
          return;
        }
        set((prevState) => ({
          userBoxes: prevState.userBoxes.map((b) => (b.id === boxId ? box : b)),
        }));
        throw txError;
      }

      if (transactionData) {
        set((prevState) => ({
          transactions: [...prevState.transactions, transactionData as Transaction],
        }));
      }

      set({ loading: false });
    } catch (err: any) {
      console.error('Error withdrawing:', err);
      set({ error: err?.message ?? 'Failed to withdraw', loading: false });
      throw err;
    }
  },

  resetBoxBalance: async (boxId: string) => {
    try {
      const state = get();
      const box = state.userBoxes.find((b) => b.id === boxId);
      if (!box) throw new Error('Box not found');
      const { error } = await supabase
        .from('user_boxes')
        .update({ current_amount: 0, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((prev) => ({
        userBoxes: prev.userBoxes.map((b) =>
          b.id === boxId ? { ...b, current_amount: 0, updated_at: new Date().toISOString() } : b
        ),
      }));
    } catch (err) {
      console.error('Error resetting box balance:', err);
      throw err;
    }
  },

  deleteUserBox: async (boxId: string) => {
    try {
      const { error } = await supabase.from('user_boxes').delete().eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.filter((b) => b.id !== boxId),
        transactions: state.transactions.filter((t) => t.box_id !== boxId),
      }));
    } catch (err) {
      console.error('Error deleting box:', err);
      throw err;
    }
  },

  crossOutIndex: async (boxId: string, index: number) => {
    set({ loading: true, error: null });

    try {
      const state = get();
      const box = state.userBoxes.find((b) => b.id === boxId);
      if (!box) {
        throw new Error('Box not found');
      }

      // Get template to find the amount for this index
      let amountForIndex = 0;
      if (box.template_id) {
        const { data: templateData, error: templateError } = await supabase
          .from('box_templates')
          .select('grid_config')
          .eq('id', box.template_id)
          .single();

        if (!templateError && templateData) {
          const template = templateData as BoxTemplate;
          if (template.grid_config && Array.isArray(template.grid_config)) {
            const gridConfig = template.grid_config;
            if (index >= 0 && index < gridConfig.length) {
              amountForIndex = gridConfig[index];
            }
          }
        }
      }

      // Update crossed_out_indices (avoid duplicates)
      const currentIndices = box.crossed_out_indices || [];
      if (currentIndices.includes(index)) {
        set({ loading: false });
        return; // Already crossed out
      }

      const updatedIndices = [...currentIndices, index];

      // Optimistic update
      set((prevState) => ({
        userBoxes: prevState.userBoxes.map((b) =>
          b.id === boxId
            ? {
                ...b,
                crossed_out_indices: updatedIndices,
                updated_at: new Date().toISOString(),
              }
            : b
        ),
      }));

      // Update in Supabase
      const updateData = { crossed_out_indices: updatedIndices };
      const { error: updateError } = await (supabase
        .from('user_boxes')
        // @ts-ignore - Supabase types inference issue, but runtime is correct
        .update(updateData)
        .eq('id', boxId));

      if (updateError) {
        // Rollback
        set((prevState) => ({
          userBoxes: prevState.userBoxes.map((b) => (b.id === boxId ? box : b)),
        }));
        throw updateError;
      }

      // If we found an amount for this index, create a transaction
      if (amountForIndex > 0) {
        await get().addTransaction(boxId, amountForIndex, `Crossed out index ${index}`);
      }

      set({ loading: false });
    } catch (err: any) {
      console.error('Error crossing out index:', err);
      set({ error: err.message || 'Failed to cross out index', loading: false });
    }
  },

  createBoxFromTemplate: async (templateId: string, name?: string) => {
    set({ loading: true, error: null });

    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch template details
      const { data: template, error: templateError } = await supabase
        .from('box_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        throw templateError || new Error('Template not found');
      }

      const templateData = template as BoxTemplate;

      // Insert new box
      const boxInsert: UserBoxInsert = {
        user_id: user.id,
        template_id: templateId,
        name: name || templateData.name,
        current_amount: 0,
        is_archived: false,
        crossed_out_indices: [],
      };

      // @ts-ignore - Supabase types inference issue, but runtime is correct
      const { data: newBox, error: insertError } = await supabase
        .from('user_boxes')
        .insert(boxInsert as any)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Add to local state
      if (newBox) {
        set((prevState) => ({
          userBoxes: [newBox as UserBox, ...prevState.userBoxes],
        }));
      }

      // Refresh the list to get the joined template data
      await get().fetchUserBoxes();

      set({ loading: false });
    } catch (err: any) {
      console.error('Error creating box from template:', err);
      set({ error: err.message || 'Failed to create box', loading: false });
    }
  },

  archiveUserBox: async (boxId: string) => {
    set({ loading: true, error: null });
    try {
      // @ts-ignore - Supabase types inference
      const { error } = await supabase
        .from('user_boxes')
        .update({ is_archived: true } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.map((b) =>
          b.id === boxId ? { ...b, is_archived: true, updated_at: new Date().toISOString() } : b
        ),
      }));
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to close goal', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  unarchiveUserBox: async (boxId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_boxes')
        .update({ is_archived: false, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.map((b) =>
          b.id === boxId ? { ...b, is_archived: false, updated_at: new Date().toISOString() } : b
        ),
      }));
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to restore', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  updateBoxName: async (boxId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_boxes')
        .update({ name: trimmed, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.map((b) =>
          b.id === boxId ? { ...b, name: trimmed, updated_at: new Date().toISOString() } : b
        ),
      }));
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to update name', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  updateBoxTargetAmount: async (boxId: string, targetAmount: number | null) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_boxes')
        .update({ target_amount: targetAmount, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.map((b) =>
          b.id === boxId
            ? { ...b, target_amount: targetAmount, updated_at: new Date().toISOString() }
            : b
        ),
      }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to update target', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  updateBoxCurrency: async (boxId: string, currency: string) => {
    const code = (currency?.trim() || 'EUR').toUpperCase();
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_boxes')
        .update({ currency: code, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (error) throw error;
      set((state) => ({
        userBoxes: state.userBoxes.map((b) =>
          b.id === boxId ? { ...b, currency: code, updated_at: new Date().toISOString() } : b
        ),
      }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to update currency', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  updateBoxCurrencyWithConversion: async (boxId: string, newCurrency: string) => {
    const toCode = (newCurrency?.trim() || 'EUR').toUpperCase();
    set({ loading: true, error: null });
    try {
      const state = get();
      const box = state.userBoxes.find((b) => b.id === boxId);
      if (!box) throw new Error('Box not found');
      const fromCode = (box.currency ?? 'EUR').toUpperCase();
      const currentAmount = Number(box.current_amount);

      if (fromCode === toCode) {
        set({ loading: false });
        return;
      }

      const rates = await getRates(fromCode);
      const rateToNew = rates[toCode];
      if (rateToNew == null || rateToNew <= 0) {
        throw new Error('Conversion not available for this currency. Check your connection.');
      }
      const convertedAmount = Math.round(currentAmount * rateToNew * 100) / 100;

      const { error } = await supabase
        .from('user_boxes')
        .update({
          currency: toCode,
          current_amount: convertedAmount,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', boxId);

      if (error) throw error;
      set((s) => ({
        userBoxes: s.userBoxes.map((b) =>
          b.id === boxId
            ? { ...b, currency: toCode, current_amount: convertedAmount, updated_at: new Date().toISOString() }
            : b
        ),
      }));
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to update currency', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  deleteTransaction: async (transactionId: string) => {
    const state = get();
    const tx = state.transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    const boxId = tx.box_id;
    const amount = Number(tx.amount);
    const box = state.userBoxes.find((b) => b.id === boxId);
    if (!box) return;
    set({ loading: true, error: null });
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);
      if (deleteError) throw deleteError;
      const newAmount = Math.max(0, Number(box.current_amount) - amount);
      const { error: updateError } = await supabase
        .from('user_boxes')
        .update({ current_amount: newAmount, updated_at: new Date().toISOString() } as never)
        .eq('id', boxId);
      if (updateError) throw updateError;
      set((prev) => ({
        transactions: prev.transactions.filter((t) => t.id !== transactionId),
        userBoxes: prev.userBoxes.map((b) =>
          b.id === boxId
            ? { ...b, current_amount: newAmount, updated_at: new Date().toISOString() }
            : b
        ),
      }));
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to delete transaction', loading: false });
      throw err;
    }
    set({ loading: false });
  },

  createUserBox: async (name: string, targetAmount?: number | null, currency?: string | null) => {
    set({ loading: true, error: null });

    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const target = targetAmount != null && targetAmount > 0 ? targetAmount : null;
      const currencyCode = (currency?.trim() || 'EUR').toUpperCase();

      const boxInsert: Record<string, unknown> = {
        user_id: user.id,
        template_id: null,
        name: name.trim(),
        currency: currencyCode,
        current_amount: 0,
        is_archived: false,
        crossed_out_indices: [],
      };

      const { data: newBox, error: insertError } = await supabase
        .from('user_boxes')
        .insert(boxInsert as never)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Set target_amount if provided (works once column exists)
      const newBoxId = (newBox as { id?: string } | null)?.id ?? null;
      if (target != null && newBoxId) {
        await supabase
          .from('user_boxes')
          .update({ target_amount: target } as never)
          .eq('id', newBoxId);
      }

      await get().fetchUserBoxes();
      set({ loading: false });
      return newBoxId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create box';
      console.error('Error creating user box:', err);
      set({ error: message, loading: false });
      throw err;
    }
  },

  // ============================================
  // LEGACY SYNC METHODS (for backward compatibility)
  // ============================================

  addUserBox: (box) => {
    const newBox: UserBox = {
      ...box,
      id: crypto.randomUUID?.() ?? `ub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      userBoxes: [...state.userBoxes, newBox],
    }));
  },

  updateUserBox: (id, updates) => {
    set((state) => ({
      userBoxes: state.userBoxes.map((b) =>
        b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
      ),
    }));
  },
}));
