export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
      piggy_banks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount: number;
          currency: string;
          color_theme: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount?: number;
          currency?: string;
          color_theme?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: number;
          current_amount?: number;
          currency?: string;
          color_theme?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          piggy_bank_id: string;
          amount: number;
          date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          piggy_bank_id: string;
          amount: number;
          date?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          piggy_bank_id?: string;
          amount?: number;
          date?: string;
          note?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Type helpers for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PiggyBank = Database['public']['Tables']['piggy_banks']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];

export type PiggyBankInsert = Database['public']['Tables']['piggy_banks']['Insert'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
