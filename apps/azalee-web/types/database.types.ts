export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_id: string
          created_at: string
          id: string
          id_token: string | null
          password: string | null
          provider_id: string
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id: string
          created_at?: string
          id: string
          id_token?: string | null
          password?: string | null
          provider_id: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id?: string
          created_at?: string
          id?: string
          id_token?: string | null
          password?: string | null
          provider_id?: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      article_bookmarks: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      article_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      article_comments: {
        Row: {
          article_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          is_pinned: boolean
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_comments_article_id_fkey"
            columns: ["article_id"]
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_comments_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "article_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      article_reactions: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      article_series: {
        Row: {
          author_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          author_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          author_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          app: string
          author_id: string | null
          category: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image_alt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          pinned: boolean | null
          published_at: string | null
          scheduled_at: string | null
          search_vector: unknown
          series_id: string | null
          series_order: number
          share_count: number
          slug: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          app?: string
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          pinned?: boolean | null
          published_at?: string | null
          scheduled_at?: string | null
          search_vector?: unknown
          series_id?: string | null
          series_order?: number
          share_count?: number
          slug: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          app?: string
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          pinned?: boolean | null
          published_at?: string | null
          scheduled_at?: string | null
          search_vector?: unknown
          series_id?: string | null
          series_order?: number
          share_count?: number
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_series_id_fkey"
            columns: ["series_id"]
            referencedRelation: "article_series"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chronicles: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          published: boolean | null
          slug: string
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: []
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_by: string | null
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            referencedRelation: "article_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_members: {
        Row: {
          avatar_url: string | null
          discord_id: string
          display_name: string | null
          is_bot: boolean | null
          joined_at: string | null
          nickname: string | null
          premium_since: string | null
          roles: string[] | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          discord_id: string
          display_name?: string | null
          is_bot?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          premium_since?: string | null
          roles?: string[] | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          discord_id?: string
          display_name?: string | null
          is_bot?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          premium_since?: string | null
          roles?: string[] | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      discord_roles: {
        Row: {
          color: number | null
          guild_id: string
          icon_url: string | null
          is_hoisted: boolean | null
          is_mentionable: boolean | null
          name: string
          permissions: string | null
          position: number | null
          role_id: string
          updated_at: string | null
        }
        Insert: {
          color?: number | null
          guild_id: string
          icon_url?: string | null
          is_hoisted?: boolean | null
          is_mentionable?: boolean | null
          name: string
          permissions?: string | null
          position?: number | null
          role_id: string
          updated_at?: string | null
        }
        Update: {
          color?: number | null
          guild_id?: string
          icon_url?: string | null
          is_hoisted?: boolean | null
          is_mentionable?: boolean | null
          name?: string
          permissions?: string | null
          position?: number | null
          role_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      discord_sync_logs: {
        Row: {
          created_at: string | null
          error_count: number | null
          id: string
          message: string | null
          status: string
          total_members: number | null
          updated_count: number | null
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          id?: string
          message?: string | null
          status: string
          total_members?: number | null
          updated_count?: number | null
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          id?: string
          message?: string | null
          status?: string
          total_members?: number | null
          updated_count?: number | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          description: string | null
          id: string
          slug: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          image_url: string | null
          location: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          image_url?: string | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          image_url?: string | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      inagle_auras: {
        Row: {
          asset_code: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_awakenings: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_basara: {
        Row: {
          agility: number | null
          alt_moveset: string | null
          alt_position: string | null
          character_id: string
          control: number | null
          element: string | null
          gender: string | null
          intelligence: number | null
          kick: number | null
          moveset: string | null
          name_localised: string | null
          name_romaji: string | null
          passive: string | null
          physical: number | null
          position: string | null
          pressure: number | null
          technique: number | null
        }
        Insert: {
          agility?: number | null
          alt_moveset?: string | null
          alt_position?: string | null
          character_id: string
          control?: number | null
          element?: string | null
          gender?: string | null
          intelligence?: number | null
          kick?: number | null
          moveset?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          passive?: string | null
          physical?: number | null
          position?: string | null
          pressure?: number | null
          technique?: number | null
        }
        Update: {
          agility?: number | null
          alt_moveset?: string | null
          alt_position?: string | null
          character_id?: string
          control?: number | null
          element?: string | null
          gender?: string | null
          intelligence?: number | null
          kick?: number | null
          moveset?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          passive?: string | null
          physical?: number | null
          position?: string | null
          pressure?: number | null
          technique?: number | null
        }
        Relationships: []
      }
      inagle_capsules: {
        Row: {
          data: Json | null
          id: string
          prize_data: Json | null
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          id: string
          prize_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          id?: string
          prize_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_characters: {
        Row: {
          base_slug: string | null
          chara_id: string | null
          constellation: string | null
          constellation_index: number | null
          control_type: string | null
          created_at: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element: string | null
          element_id: number | null
          gender: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_controllable: boolean | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          position: string | null
          position_id: number | null
          rarity: string | null
          rarity_code: number | null
          rarity_label: string | null
          series: string | null
          sheet_data: Json | null
          skills: Json | null
          slug: string | null
          stat_agilite: number | null
          stat_controle: number | null
          stat_frappe: number | null
          stat_intelligence: number | null
          stat_physique: number | null
          stat_pression: number | null
          stat_technique: number | null
          stat_total: number | null
          stats: Json | null
          team_id: string | null
          teams: Json | null
          zukan_hash: string | null
          zukan_order: number | null
        }
        Insert: {
          base_slug?: string | null
          chara_id?: string | null
          constellation?: string | null
          constellation_index?: number | null
          control_type?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element?: string | null
          element_id?: number | null
          gender?: string | null
          id: string
          image_url?: string | null
          internal_code?: string | null
          is_controllable?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          position?: string | null
          position_id?: number | null
          rarity?: string | null
          rarity_code?: number | null
          rarity_label?: string | null
          series?: string | null
          sheet_data?: Json | null
          skills?: Json | null
          slug?: string | null
          stat_agilite?: number | null
          stat_controle?: number | null
          stat_frappe?: number | null
          stat_intelligence?: number | null
          stat_physique?: number | null
          stat_pression?: number | null
          stat_technique?: number | null
          stat_total?: number | null
          stats?: Json | null
          team_id?: string | null
          teams?: Json | null
          zukan_hash?: string | null
          zukan_order?: number | null
        }
        Update: {
          base_slug?: string | null
          chara_id?: string | null
          constellation?: string | null
          constellation_index?: number | null
          control_type?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element?: string | null
          element_id?: number | null
          gender?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_controllable?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          position?: string | null
          position_id?: number | null
          rarity?: string | null
          rarity_code?: number | null
          rarity_label?: string | null
          series?: string | null
          sheet_data?: Json | null
          skills?: Json | null
          slug?: string | null
          stat_agilite?: number | null
          stat_controle?: number | null
          stat_frappe?: number | null
          stat_intelligence?: number | null
          stat_physique?: number | null
          stat_pression?: number | null
          stat_technique?: number | null
          stat_total?: number | null
          stats?: Json | null
          team_id?: string | null
          teams?: Json | null
          zukan_hash?: string | null
          zukan_order?: number | null
        }
        Relationships: []
      }
      inagle_coordinators: {
        Row: {
          buff: string | null
          element: string | null
          game: string | null
          gender: string | null
          id: number
          image: string | null
          name_hiragana: string | null
          name_kanji: string | null
          name_localised: string | null
          name_romaji: string | null
          passive_no: number | null
          passive_slot: number | null
          playstyle: string | null
          requirements: string | null
          role: string | null
          stat: string | null
        }
        Insert: {
          buff?: string | null
          element?: string | null
          game?: string | null
          gender?: string | null
          id?: number
          image?: string | null
          name_hiragana?: string | null
          name_kanji?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          passive_no?: number | null
          passive_slot?: number | null
          playstyle?: string | null
          requirements?: string | null
          role?: string | null
          stat?: string | null
        }
        Update: {
          buff?: string | null
          element?: string | null
          game?: string | null
          gender?: string | null
          id?: number
          image?: string | null
          name_hiragana?: string | null
          name_kanji?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          passive_no?: number | null
          passive_slot?: number | null
          playstyle?: string | null
          requirements?: string | null
          role?: string | null
          stat?: string | null
        }
        Relationships: []
      }
      inagle_costumes: {
        Row: {
          costume_index: number | null
          data: Json | null
          flag1: number | null
          flag2: number | null
          id: string
          model_ref: string | null
          type: number | null
          updated_at: string | null
        }
        Insert: {
          costume_index?: number | null
          data?: Json | null
          flag1?: number | null
          flag2?: number | null
          id: string
          model_ref?: string | null
          type?: number | null
          updated_at?: string | null
        }
        Update: {
          costume_index?: number | null
          data?: Json | null
          flag1?: number | null
          flag2?: number | null
          id?: string
          model_ref?: string | null
          type?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_custom_passives: {
        Row: {
          buff: string | null
          id: number
          requirements: string | null
          stat: string | null
        }
        Insert: {
          buff?: string | null
          id: number
          requirements?: string | null
          stat?: string | null
        }
        Update: {
          buff?: string | null
          id?: number
          requirements?: string | null
          stat?: string | null
        }
        Relationships: []
      }
      inagle_drops: {
        Row: {
          fixed_beans: string | null
          game: string | null
          id: number
          no: number | null
          passive_type: string | null
          requirement: string | null
          stat: string | null
          team: string | null
          value: string | null
        }
        Insert: {
          fixed_beans?: string | null
          game?: string | null
          id?: number
          no?: number | null
          passive_type?: string | null
          requirement?: string | null
          stat?: string | null
          team?: string | null
          value?: string | null
        }
        Update: {
          fixed_beans?: string | null
          game?: string | null
          id?: number
          no?: number | null
          passive_type?: string | null
          requirement?: string | null
          stat?: string | null
          team?: string | null
          value?: string | null
        }
        Relationships: []
      }
      inagle_drops_battles: {
        Row: {
          battle_group_id: number
          data: Json | null
          item_table_id: number | null
          updated_at: string | null
        }
        Insert: {
          battle_group_id: number
          data?: Json | null
          item_table_id?: number | null
          updated_at?: string | null
        }
        Update: {
          battle_group_id?: number
          data?: Json | null
          item_table_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_drops_tables: {
        Row: {
          entries: Json | null
          table_id: string
          updated_at: string | null
        }
        Insert: {
          entries?: Json | null
          table_id: string
          updated_at?: string | null
        }
        Update: {
          entries?: Json | null
          table_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_drops_treasures: {
        Row: {
          data: Json | null
          id: string
          items: Json | null
          map_id: string | null
          pos: Json | null
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          id?: string
          items?: Json | null
          map_id?: string | null
          pos?: Json | null
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          id?: string
          items?: Json | null
          map_id?: string | null
          pos?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_formations: {
        Row: {
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          emblem_url: string | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          emblem_url?: string | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          emblem_url?: string | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_gallery: {
        Row: {
          data: Json | null
          flg_no: number | null
          id: string
          img_path: string | null
          need_token_num: number | null
          thumb_path: string | null
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          flg_no?: number | null
          id: string
          img_path?: string | null
          need_token_num?: number | null
          thumb_path?: string | null
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          flg_no?: number | null
          id?: string
          img_path?: string | null
          need_token_num?: number | null
          thumb_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_heroes: {
        Row: {
          agility: number | null
          character_id: string
          control: number | null
          element: string | null
          gender: string | null
          intelligence: number | null
          kick: number | null
          moveset: string | null
          name_localised: string | null
          name_romaji: string | null
          physical: number | null
          playstyle: string
          position: string | null
          pressure: number | null
          technique: number | null
        }
        Insert: {
          agility?: number | null
          character_id: string
          control?: number | null
          element?: string | null
          gender?: string | null
          intelligence?: number | null
          kick?: number | null
          moveset?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          physical?: number | null
          playstyle: string
          position?: string | null
          pressure?: number | null
          technique?: number | null
        }
        Update: {
          agility?: number | null
          character_id?: string
          control?: number | null
          element?: string | null
          gender?: string | null
          intelligence?: number | null
          kick?: number | null
          moveset?: string | null
          name_localised?: string | null
          name_romaji?: string | null
          physical?: number | null
          playstyle?: string
          position?: string | null
          pressure?: number | null
          technique?: number | null
        }
        Relationships: []
      }
      inagle_items: {
        Row: {
          buy_price: number | null
          category: string | null
          created_at: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          price: number | null
          rarity: number | null
          sell_price: number | null
          sheet_data: Json | null
          shop_names: string[] | null
          shops: Json | null
        }
        Insert: {
          buy_price?: number | null
          category?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          id: string
          image_url?: string | null
          internal_code?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          price?: number | null
          rarity?: number | null
          sell_price?: number | null
          sheet_data?: Json | null
          shop_names?: string[] | null
          shops?: Json | null
        }
        Update: {
          buy_price?: number | null
          category?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          price?: number | null
          rarity?: number | null
          sell_price?: number | null
          sheet_data?: Json | null
          shop_names?: string[] | null
          shops?: Json | null
        }
        Relationships: []
      }
      inagle_keshins: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_kizuna_items: {
        Row: {
          name: string
          notes: string | null
          power: number | null
          shop: string | null
          size: string | null
        }
        Insert: {
          name: string
          notes?: string | null
          power?: number | null
          shop?: string | null
          size?: string | null
        }
        Update: {
          name?: string
          notes?: string | null
          power?: number | null
          shop?: string | null
          size?: string | null
        }
        Relationships: []
      }
      inagle_manager_passives: {
        Row: {
          coord_common: string | null
          coord_legendary: string | null
          id: number
          manager_common: string | null
          manager_legendary: string | null
          playstyle: string | null
          requirements: string | null
          stat: string | null
        }
        Insert: {
          coord_common?: string | null
          coord_legendary?: string | null
          id: number
          manager_common?: string | null
          manager_legendary?: string | null
          playstyle?: string | null
          requirements?: string | null
          stat?: string | null
        }
        Update: {
          coord_common?: string | null
          coord_legendary?: string | null
          id?: number
          manager_common?: string | null
          manager_legendary?: string | null
          playstyle?: string | null
          requirements?: string | null
          stat?: string | null
        }
        Relationships: []
      }
      inagle_miximax: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          icon_code: string | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          icon_code?: string | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          icon_code?: string | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_mode_changes: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_opponent_teams: {
        Row: {
          bg_texture: string | null
          data: Json | null
          difficulty_type: number | null
          game_id: string | null
          id: string
          team_id: string | null
          type: number | null
          updated_at: string | null
        }
        Insert: {
          bg_texture?: string | null
          data?: Json | null
          difficulty_type?: number | null
          game_id?: string | null
          id: string
          team_id?: string | null
          type?: number | null
          updated_at?: string | null
        }
        Update: {
          bg_texture?: string | null
          data?: Json | null
          difficulty_type?: number | null
          game_id?: string | null
          id?: string
          team_id?: string | null
          type?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_override_skills: {
        Row: {
          category_id: number | null
          conditions: Json | null
          created_at: string | null
          element_id: number | null
          id: string
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          power_max: number | null
          power_min: number | null
        }
        Insert: {
          category_id?: number | null
          conditions?: Json | null
          created_at?: string | null
          element_id?: number | null
          id: string
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          power_max?: number | null
          power_min?: number | null
        }
        Update: {
          category_id?: number | null
          conditions?: Json | null
          created_at?: string | null
          element_id?: number | null
          id?: string
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          power_max?: number | null
          power_min?: number | null
        }
        Relationships: []
      }
      inagle_passive_generation: {
        Row: {
          no: number
          passive_id: string
          requirement: string | null
          stat: string | null
        }
        Insert: {
          no: number
          passive_id: string
          requirement?: string | null
          stat?: string | null
        }
        Update: {
          no?: number
          passive_id?: string
          requirement?: string | null
          stat?: string | null
        }
        Relationships: []
      }
      inagle_passive_scaling: {
        Row: {
          advanced_high: string | null
          advanced_low: string | null
          common_high: string | null
          common_low: string | null
          growing_high: string | null
          growing_low: string | null
          id: number
          legendary_high: string | null
          legendary_low: string | null
          requirement: string | null
          stat_affected: string | null
          top_high: string | null
          top_low: string | null
        }
        Insert: {
          advanced_high?: string | null
          advanced_low?: string | null
          common_high?: string | null
          common_low?: string | null
          growing_high?: string | null
          growing_low?: string | null
          id: number
          legendary_high?: string | null
          legendary_low?: string | null
          requirement?: string | null
          stat_affected?: string | null
          top_high?: string | null
          top_low?: string | null
        }
        Update: {
          advanced_high?: string | null
          advanced_low?: string | null
          common_high?: string | null
          common_low?: string | null
          growing_high?: string | null
          growing_low?: string | null
          id?: number
          legendary_high?: string | null
          legendary_low?: string | null
          requirement?: string | null
          stat_affected?: string | null
          top_high?: string | null
          top_low?: string | null
        }
        Relationships: []
      }
      inagle_passives: {
        Row: {
          boost_type: string | null
          category: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          effect_value: string | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          stat_boost: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          boost_type?: string | null
          category?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          effect_value?: string | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          stat_boost?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          boost_type?: string | null
          category?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          effect_value?: string | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          stat_boost?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_quests: {
        Row: {
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          display_text: string | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          phase: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          display_text?: string | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          phase?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          display_text?: string | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          phase?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_skills: {
        Row: {
          category: string | null
          category_id: number | null
          created_at: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_hyper: boolean | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          poster_url: string | null
          power_max: number | null
          power_min: number | null
          sheet_data: Json | null
          tension_cost: number | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          category_id?: number | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          internal_code?: string | null
          is_hyper?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          poster_url?: string | null
          power_max?: number | null
          power_min?: number | null
          sheet_data?: Json | null
          tension_cost?: number | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          category_id?: number | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_hyper?: boolean | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          poster_url?: string | null
          power_max?: number | null
          power_min?: number | null
          sheet_data?: Json | null
          tension_cost?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      inagle_souls: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_code?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          element_id?: number | null
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
          sub_type?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inagle_tactics: {
        Row: {
          cooldown: number | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          duration: number | null
          effect1: string | null
          effect2: string | null
          effect3: string | null
          element: string | null
          element_id: number | null
          id: string | null
          internal_code: string | null
          name: string
          name_fr: string | null
          name_ja: string | null
          partner_count: number | null
          partner_ids: Json | null
          power: number | null
          recast_time: number | null
          shop: string | null
        }
        Insert: {
          cooldown?: number | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          duration?: number | null
          effect1?: string | null
          effect2?: string | null
          effect3?: string | null
          element?: string | null
          element_id?: number | null
          id?: string | null
          internal_code?: string | null
          name: string
          name_fr?: string | null
          name_ja?: string | null
          partner_count?: number | null
          partner_ids?: Json | null
          power?: number | null
          recast_time?: number | null
          shop?: string | null
        }
        Update: {
          cooldown?: number | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          duration?: number | null
          effect1?: string | null
          effect2?: string | null
          effect3?: string | null
          element?: string | null
          element_id?: number | null
          id?: string | null
          internal_code?: string | null
          name?: string
          name_fr?: string | null
          name_ja?: string | null
          partner_count?: number | null
          partner_ids?: Json | null
          power?: number | null
          recast_time?: number | null
          shop?: string | null
        }
        Relationships: []
      }
      inagle_teams: {
        Row: {
          country_code: string | null
          created_at: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          emblems: Json | null
          id: string
          internal_code: string | null
          kits: Json | null
          members: Json | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          emblems?: Json | null
          id: string
          internal_code?: string | null
          kits?: Json | null
          members?: Json | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          data?: Json | null
          description_en?: string | null
          description_fr?: string | null
          description_ja?: string | null
          emblems?: Json | null
          id?: string
          internal_code?: string | null
          kits?: Json | null
          members?: Json | null
          name_en?: string | null
          name_fr?: string | null
          name_ja?: string | null
          sheet_data?: Json | null
        }
        Relationships: []
      }
      merch_products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          stock: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          stock?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          stock?: number | null
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          categories: string[] | null
          created_at: string
          email: string
          frequency: string
          id: string
          is_active: boolean
          unsubscribe_token: string
          user_id: string | null
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          email: string
          frequency?: string
          id?: string
          is_active?: boolean
          unsubscribe_token?: string
          user_id?: string | null
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          email?: string
          frequency?: string
          id?: string
          is_active?: boolean
          unsubscribe_token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      patch_notes: {
        Row: {
          content_html: string | null
          content_html_fr: string | null
          created_at: string | null
          date: string
          featured_image: string | null
          id: string
          platform: Json
          title: string
          title_fr: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          content_html?: string | null
          content_html_fr?: string | null
          created_at?: string | null
          date: string
          featured_image?: string | null
          id: string
          platform?: Json
          title: string
          title_fr?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          content_html?: string | null
          content_html_fr?: string | null
          created_at?: string | null
          date?: string
          featured_image?: string | null
          id?: string
          platform?: Json
          title?: string
          title_fr?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          discord_id: string | null
          email: string | null
          full_name: string | null
          id: string
          patreon_id: string | null
          postal_code: string | null
          role: string | null
          twitter_handle: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          discord_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          patreon_id?: string | null
          postal_code?: string | null
          role?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          discord_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          patreon_id?: string | null
          postal_code?: string | null
          role?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number | null
          key: string
          last_request: string
        }
        Insert: {
          count?: number | null
          key: string
          last_request?: string
        }
        Update: {
          count?: number | null
          key?: string
          last_request?: string
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          article_id: string
          id: string
          last_read_at: string
          progress: number
          read_count: number
          user_id: string
        }
        Insert: {
          article_id: string
          id?: string
          last_read_at?: string
          progress?: number
          read_count?: number
          user_id: string
        }
        Update: {
          article_id?: string
          id?: string
          last_read_at?: string
          progress?: number
          read_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_article_id_fkey"
            columns: ["article_id"]
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id: string
          ip_address?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      share_tracking: {
        Row: {
          article_id: string
          created_at: string
          id: string
          platform: string
          user_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          platform: string
          user_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          platform?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_tracking_article_id_fkey"
            columns: ["article_id"]
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_schedules: {
        Row: {
          category: string | null
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: string | null
          streamer_name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
          streamer_name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
          streamer_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          discord_user_id: string | null
          display_index: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          member_link: string | null
          name: string
          order_index: number | null
          role: string
          source: string | null
          team_id: string
          team_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_user_id?: string | null
          display_index?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          member_link?: string | null
          name: string
          order_index?: number | null
          role: string
          source?: string | null
          team_id: string
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string | null
          display_index?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          member_link?: string | null
          name?: string
          order_index?: number | null
          role?: string
          source?: string | null
          team_id?: string
          team_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: string | null
          content_html: string | null
          created_at: string | null
          date: string
          id: string
          images: Json | null
          thumbnail: string | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          category?: string | null
          content_html?: string | null
          created_at?: string | null
          date: string
          id: string
          images?: Json | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          category?: string | null
          content_html?: string | null
          created_at?: string | null
          date?: string
          id?: string
          images?: Json | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      tweets: {
        Row: {
          author_id: string | null
          author_name: string | null
          author_username: string | null
          created_at: string | null
          id: string
          is_thread: boolean | null
          media: Json | null
          metrics: Json | null
          quoted_tweets: Json | null
          raw_tweets: Json | null
          text: string | null
          tweet_count: number | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          author_username?: string | null
          created_at?: string | null
          id: string
          is_thread?: boolean | null
          media?: Json | null
          metrics?: Json | null
          quoted_tweets?: Json | null
          raw_tweets?: Json | null
          text?: string | null
          tweet_count?: number | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          author_username?: string | null
          created_at?: string | null
          id?: string
          is_thread?: boolean | null
          media?: Json | null
          metrics?: Json | null
          quoted_tweets?: Json | null
          raw_tweets?: Json | null
          text?: string | null
          tweet_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          id: string
          image: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          id: string
          image?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          image?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          email_notifications: boolean
          font_size: string
          preferred_categories: string[] | null
          push_notifications: boolean
          reading_mode: boolean
          reduced_motion: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_notifications?: boolean
          font_size?: string
          preferred_categories?: string[] | null
          push_notifications?: boolean
          reading_mode?: boolean
          reduced_motion?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_notifications?: boolean
          font_size?: string
          preferred_categories?: string[] | null
          push_notifications?: boolean
          reading_mode?: boolean
          reduced_motion?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          created_at: string
          formation_data: Json
          formation_id: string
          id: string
          is_public: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          formation_data?: Json
          formation_id: string
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          formation_data?: Json
          formation_id?: string
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          identifier: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id: string
          identifier: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          identifier?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      wiki_overrides: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          field_path: string
          id: string
          value: Json
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          field_path: string
          id?: string
          value: Json
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          field_path?: string
          id?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      content_feed: {
        Row: {
          author_id: string | null
          category: string | null
          created_at: string | null
          date: string | null
          excerpt: string | null
          id: string | null
          image: string | null
          slug: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
      inagle_awakenings_clean: {
        Row: {
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          id: string | null
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      inagle_keshins_clean: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          id: string | null
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      inagle_miximax_clean: {
        Row: {
          asset_code: string | null
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          element_id: number | null
          icon_code: string | null
          id: string | null
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          sub_type: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      inagle_mode_changes_clean: {
        Row: {
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          id: string | null
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      inagle_souls_clean: {
        Row: {
          data: Json | null
          description_en: string | null
          description_fr: string | null
          description_ja: string | null
          id: string | null
          image_url: string | null
          name_en: string | null
          name_fr: string | null
          name_ja: string | null
          sheet_data: Json | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      generate_article_slug: { Args: { title: string }; Returns: string }
      get_comment_counts: {
        Args: { article_ids: string[] }
        Returns: Array<{
          article_id: string
          count: number
        }>
      }
      get_share_counts: {
        Args: { p_article_ids: string[] }
        Returns: Array<{
          article_id: string
          by_platform: Json
          total: number
        }>
      }
      get_trending_articles: {
        Args: { days_window?: number; result_limit?: number }
        Returns: Array<{
          category: string
          excerpt: string
          featured_image_url: string
          id: string
          published_at: string
          slug: string
          title: string
          trending_score: number
          view_count: number
        }>
      }
      increment_article_views: {
        Args: { article_id: string }
        Returns: undefined
      }
      increment_share_count: {
        Args: { p_article_id: string; p_platform: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      upsert_reading_progress: {
        Args: { p_article_id: string; p_progress: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
