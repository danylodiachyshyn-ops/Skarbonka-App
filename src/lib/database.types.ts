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
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
        };
      };
      box_templates: {
        Row: {
          id: string;
          name: string;
          total_amount: number;
          currency: string;
          grid_config: number[];
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          total_amount: number;
          currency?: string;
          grid_config: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          total_amount?: number;
          currency?: string;
          grid_config?: number[];
          created_at?: string;
        };
      };
      user_boxes: {
        Row: {
          id: string;
          user_id: string;
          template_id: string | null;
          name: string;
          currency: string | null;
          current_amount: number;
          target_amount: number | null;
          is_archived: boolean;
          crossed_out_indices: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id?: string | null;
          name: string;
          currency?: string | null;
          current_amount?: number;
          target_amount?: number | null;
          is_archived?: boolean;
          crossed_out_indices?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string | null;
          name?: string;
          currency?: string | null;
          current_amount?: number;
          target_amount?: number | null;
          is_archived?: boolean;
          crossed_out_indices?: number[];
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          box_id: string;
          amount: number;
          note: string | null;
          date: string;
        };
        Insert: {
          id?: string;
          box_id: string;
          amount: number;
          note?: string | null;
          date?: string;
        };
        Update: {
          id?: string;
          box_id?: string;
          amount?: number;
          note?: string | null;
          date?: string;
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
export type BoxTemplate = Database['public']['Tables']['box_templates']['Row'];
export type UserBox = Database['public']['Tables']['user_boxes']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];

export type UserBoxInsert = Database['public']['Tables']['user_boxes']['Insert'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
