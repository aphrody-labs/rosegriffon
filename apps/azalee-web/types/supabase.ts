export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      inagle_auras: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_awakenings: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_characters: {
        Row: {
          chara_id: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          gender: number | null;
          id: string;
          image_url: string | null;
          internal_code: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          position_id: number | null;
          rarity: string | null;
          rarity_code: number | null;
          series_name: string | null;
          sheet_data: Json | null;
          skills: Json | null;
          stats: Json | null;
          teams: Json | null;
          wiki_sections: Json | null;
        };
        Insert: {
          chara_id?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          gender?: number | null;
          id: string;
          image_url?: string | null;
          internal_code?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          position_id?: number | null;
          rarity?: string | null;
          rarity_code?: number | null;
          series_name?: string | null;
          sheet_data?: Json | null;
          skills?: Json | null;
          stats?: Json | null;
          teams?: Json | null;
          wiki_sections?: Json | null;
        };
        Update: {
          chara_id?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          gender?: number | null;
          id?: string;
          image_url?: string | null;
          internal_code?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          position_id?: number | null;
          rarity?: string | null;
          rarity_code?: number | null;
          series_name?: string | null;
          sheet_data?: Json | null;
          skills?: Json | null;
          stats?: Json | null;
          teams?: Json | null;
          wiki_sections?: Json | null;
        };
        Relationships: [];
      };
      inagle_coordinators: {
        Row: {
          buff: string | null;
          element: string | null;
          game: string | null;
          gender: string | null;
          id: number;
          image: string | null;
          name_hiragana: string | null;
          name_kanji: string | null;
          name_localised: string | null;
          name_romaji: string | null;
          passive_no: number | null;
          passive_slot: number | null;
          playstyle: string | null;
          requirements: string | null;
          role: string | null;
          stat: string | null;
        };
        Insert: {
          buff?: string | null;
          element?: string | null;
          game?: string | null;
          gender?: string | null;
          id?: number;
          image?: string | null;
          name_hiragana?: string | null;
          name_kanji?: string | null;
          name_localised?: string | null;
          name_romaji?: string | null;
          passive_no?: number | null;
          passive_slot?: number | null;
          playstyle?: string | null;
          requirements?: string | null;
          role?: string | null;
          stat?: string | null;
        };
        Update: {
          buff?: string | null;
          element?: string | null;
          game?: string | null;
          gender?: string | null;
          id?: number;
          image?: string | null;
          name_hiragana?: string | null;
          name_kanji?: string | null;
          name_localised?: string | null;
          name_romaji?: string | null;
          passive_no?: number | null;
          passive_slot?: number | null;
          playstyle?: string | null;
          requirements?: string | null;
          role?: string | null;
          stat?: string | null;
        };
        Relationships: [];
      };
      inagle_drops: {
        Row: {
          fixed_beans: string | null;
          game: string | null;
          id: number;
          no: number | null;
          passive_type: string | null;
          requirement: string | null;
          stat: string | null;
          team: string | null;
          value: string | null;
        };
        Insert: {
          fixed_beans?: string | null;
          game?: string | null;
          id?: number;
          no?: number | null;
          passive_type?: string | null;
          requirement?: string | null;
          stat?: string | null;
          team?: string | null;
          value?: string | null;
        };
        Update: {
          fixed_beans?: string | null;
          game?: string | null;
          id?: number;
          no?: number | null;
          passive_type?: string | null;
          requirement?: string | null;
          stat?: string | null;
          team?: string | null;
          value?: string | null;
        };
        Relationships: [];
      };
      inagle_items: {
        Row: {
          category: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          rarity: number | null;
          sheet_data: Json | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          rarity?: number | null;
          sheet_data?: Json | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          rarity?: number | null;
          sheet_data?: Json | null;
        };
        Relationships: [];
      };
      inagle_keshins: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_kizuna_items: {
        Row: {
          name: string;
          notes: string | null;
          power: number | null;
          shop: string | null;
          size: string | null;
        };
        Insert: {
          name: string;
          notes?: string | null;
          power?: number | null;
          shop?: string | null;
          size?: string | null;
        };
        Update: {
          name?: string;
          notes?: string | null;
          power?: number | null;
          shop?: string | null;
          size?: string | null;
        };
        Relationships: [];
      };
      inagle_miximax: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_mode_changes: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_passives: {
        Row: {
          boost_type: string | null;
          category: string | null;
          data: Json | null;
          description_en: string | null;
          description_fr: string | null;
          description_ja: string | null;
          effect_value: number | null;
          id: string;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          updated_at: string | null;
        };
        Insert: {
          boost_type?: string | null;
          category?: string | null;
          data?: Json | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          effect_value?: number | null;
          id: string;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          updated_at?: string | null;
        };
        Update: {
          boost_type?: string | null;
          category?: string | null;
          data?: Json | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          effect_value?: number | null;
          id?: string;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      inagle_skills: {
        Row: {
          category_id: number | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          internal_code: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          power_max: number | null;
          power_min: number | null;
          sheet_data: Json | null;
          tension_cost: number | null;
        };
        Insert: {
          category_id?: number | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          internal_code?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          power_max?: number | null;
          power_min?: number | null;
          sheet_data?: Json | null;
          tension_cost?: number | null;
        };
        Update: {
          category_id?: number | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          internal_code?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          power_max?: number | null;
          power_min?: number | null;
          sheet_data?: Json | null;
          tension_cost?: number | null;
        };
        Relationships: [];
      };
      inagle_souls: {
        Row: {
          asset_code: string | null;
          created_at: string | null;
          description_fr: string | null;
          description_ja: string | null;
          element_id: number | null;
          id: string;
          image_url: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
          sub_type: string | null;
        };
        Insert: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Update: {
          asset_code?: string | null;
          created_at?: string | null;
          description_fr?: string | null;
          description_ja?: string | null;
          element_id?: number | null;
          id?: string;
          image_url?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
          sub_type?: string | null;
        };
        Relationships: [];
      };
      inagle_tactics: {
        Row: {
          cooldown: number | null;
          duration: number | null;
          effect1: string | null;
          effect2: string | null;
          effect3: string | null;
          name: string;
          shop: string | null;
        };
        Insert: {
          cooldown?: number | null;
          duration?: number | null;
          effect1?: string | null;
          effect2?: string | null;
          effect3?: string | null;
          name: string;
          shop?: string | null;
        };
        Update: {
          cooldown?: number | null;
          duration?: number | null;
          effect1?: string | null;
          effect2?: string | null;
          effect3?: string | null;
          name?: string;
          shop?: string | null;
        };
        Relationships: [];
      };
      inagle_teams: {
        Row: {
          created_at: string | null;
          emblems: Json | null;
          id: string;
          internal_code: string | null;
          kits: Json | null;
          members: Json | null;
          name_en: string | null;
          name_fr: string | null;
          name_ja: string | null;
          sheet_data: Json | null;
        };
        Insert: {
          created_at?: string | null;
          emblems?: Json | null;
          id: string;
          internal_code?: string | null;
          kits?: Json | null;
          members?: Json | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
        };
        Update: {
          created_at?: string | null;
          emblems?: Json | null;
          id?: string;
          internal_code?: string | null;
          kits?: Json | null;
          members?: Json | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_ja?: string | null;
          sheet_data?: Json | null;
        };
        Relationships: [];
      };
      patch_notes: {
        Row: {
          content_html: string | null;
          date: string;
          featured_image: string | null;
          id: string;
          platform: Json | null;
          title: string;
          updated_at: string | null;
          url: string;
        };
        Insert: {
          content_html?: string | null;
          date: string;
          featured_image?: string | null;
          id: string;
          platform?: Json | null;
          title: string;
          updated_at?: string | null;
          url: string;
        };
        Update: {
          content_html?: string | null;
          date?: string;
          featured_image?: string | null;
          id?: string;
          platform?: Json | null;
          title?: string;
          updated_at?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          city: string | null;
          country: string | null;
          discord_id: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          patreon_id: string | null;
          postal_code: string | null;
          role: string | null;
          twitter_handle: string | null;
          updated_at: string | null;
          username: string | null;
          website: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          city?: string | null;
          country?: string | null;
          discord_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          patreon_id?: string | null;
          postal_code?: string | null;
          role?: string | null;
          twitter_handle?: string | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          city?: string | null;
          country?: string | null;
          discord_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          patreon_id?: string | null;
          postal_code?: string | null;
          role?: string | null;
          twitter_handle?: string | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          created_at: string | null;
          discord_user_id: string | null;
          display_index: number | null;
          id: number;
          image_url: string | null;
          is_active: boolean | null;
          member_link: string | null;
          name: string | null;
          order_index: number | null;
          role: string | null;
          source: string | null;
          team_id: string | null;
          team_name: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          discord_user_id?: string | null;
          display_index?: number | null;
          id?: number;
          image_url?: string | null;
          is_active?: boolean | null;
          member_link?: string | null;
          name?: string | null;
          order_index?: number | null;
          role?: string | null;
          source?: string | null;
          team_id?: string | null;
          team_name?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          discord_user_id?: string | null;
          display_index?: number | null;
          id?: number;
          image_url?: string | null;
          is_active?: boolean | null;
          member_link?: string | null;
          name?: string | null;
          order_index?: number | null;
          role?: string | null;
          source?: string | null;
          team_id?: string | null;
          team_name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          category: string | null;
          content_html: string | null;
          date: string;
          id: string;
          images: Json | null;
          thumbnail: string | null;
          title: string;
          updated_at: string | null;
          url: string;
        };
        Insert: {
          category?: string | null;
          content_html?: string | null;
          date: string;
          id: string;
          images?: Json | null;
          thumbnail?: string | null;
          title: string;
          updated_at?: string | null;
          url: string;
        };
        Update: {
          category?: string | null;
          content_html?: string | null;
          date?: string;
          id?: string;
          images?: Json | null;
          thumbnail?: string | null;
          title?: string;
          updated_at?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      tweets: {
        Row: {
          author_id: string | null;
          author_name: string | null;
          author_username: string | null;
          conversation_id: string | null;
          created_at: string | null;
          id: string;
          in_reply_to_status_id: string | null;
          media: Json | null;
          metrics: Json | null;
          raw_data: Json | null;
          text: string | null;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          author_name?: string | null;
          author_username?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id: string;
          in_reply_to_status_id?: string | null;
          media?: Json | null;
          metrics?: Json | null;
          raw_data?: Json | null;
          text?: string | null;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          author_name?: string | null;
          author_username?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          in_reply_to_status_id?: string | null;
          media?: Json | null;
          metrics?: Json | null;
          raw_data?: Json | null;
          text?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_article_slug: { Args: { title: string }; Returns: string };
      increment_article_views: {
        Args: { article_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
