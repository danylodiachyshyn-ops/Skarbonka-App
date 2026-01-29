import { create } from 'zustand';
import { UserBox, Transaction, BoxTemplate, TransactionInsert, UserBoxInsert } from '@/src/lib/database.types';
import { supabase } from '@/src/lib/supabase';
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
  getTotalSavedThisMonth: () => number;
  
  // Supabase async actions
  fetchUserBoxes: () => Promise<void>;
  addTransaction: (boxId: string, amount: number, note?: string | null) => Promise<void>;
  crossOutIndex: (boxId: string, index: number) => Promise<void>;
  createBoxFromTemplate: (templateId: string, name?: string) => Promise<void>;
  createUserBox: (name: string, targetAmount?: number | null) => Promise<void>;
  archiveUserBox: (boxId: string) => Promise<void>;
  
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

  fetchUserBoxes: async () => {
    set({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('user_boxes')
        .select('*, box_templates(name, total_amount, grid_config, currency)')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the joined result to UserBox[] (flatten the template data if needed)
      const boxes: UserBox[] = (data as UserBoxWithTemplate[]).map((item) => ({
        ...item,
        // Keep box_templates in the object if needed for UI, but type it as UserBox
      })) as UserBox[];

      set({ userBoxes: boxes, loading: false });
    } catch (err: any) {
      console.error('Error fetching user boxes:', err);
      set({ error: err.message || 'Failed to fetch boxes', loading: false });
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
        // Rollback optimistic update on error
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

  createUserBox: async (name: string, targetAmount?: number | null) => {
    set({ loading: true, error: null });

    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const target = targetAmount != null && targetAmount > 0 ? targetAmount : null;

      // Insert without target_amount so it works even if column is not yet in DB
      const boxInsert: Record<string, unknown> = {
        user_id: user.id,
        template_id: null,
        name: name.trim(),
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
      const newBoxId = (newBox as { id?: string } | null)?.id;
      if (target != null && newBoxId) {
        await supabase
          .from('user_boxes')
          .update({ target_amount: target } as never)
          .eq('id', newBoxId);
      }

      await get().fetchUserBoxes();
      set({ loading: false });
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
