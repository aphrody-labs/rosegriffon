import type { Database } from "./types.gen";
export declare function createSupabaseServiceClient(): import("@supabase/supabase-js").SupabaseClient<Database, "public", "public", {
    Tables: {
        account: {
            Row: {
                access_token: string | null;
                access_token_expires_at: string | null;
                account_id: string;
                created_at: string;
                id: string;
                id_token: string | null;
                password: string | null;
                provider_id: string;
                refresh_token: string | null;
                refresh_token_expires_at: string | null;
                scope: string | null;
                updated_at: string;
                user_id: string;
            };
            Insert: {
                access_token?: string | null;
                access_token_expires_at?: string | null;
                account_id: string;
                created_at?: string;
                id: string;
                id_token?: string | null;
                password?: string | null;
                provider_id: string;
                refresh_token?: string | null;
                refresh_token_expires_at?: string | null;
                scope?: string | null;
                updated_at?: string;
                user_id: string;
            };
            Update: {
                access_token?: string | null;
                access_token_expires_at?: string | null;
                account_id?: string;
                created_at?: string;
                id?: string;
                id_token?: string | null;
                password?: string | null;
                provider_id?: string;
                refresh_token?: string | null;
                refresh_token_expires_at?: string | null;
                scope?: string | null;
                updated_at?: string;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "account_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        admin_audit_log: {
            Row: {
                action: string;
                created_at: string;
                details: import("./types.gen").Json | null;
                entity_id: string | null;
                entity_type: string;
                id: string;
                ip_address: string | null;
                user_id: string;
            };
            Insert: {
                action: string;
                created_at?: string;
                details?: import("./types.gen").Json | null;
                entity_id?: string | null;
                entity_type: string;
                id?: string;
                ip_address?: string | null;
                user_id: string;
            };
            Update: {
                action?: string;
                created_at?: string;
                details?: import("./types.gen").Json | null;
                entity_id?: string | null;
                entity_type?: string;
                id?: string;
                ip_address?: string | null;
                user_id?: string;
            };
            Relationships: [];
        };
        agent: {
            Row: {
                activatedAt: string | null;
                createdAt: string;
                expiresAt: string | null;
                hostId: string;
                id: string;
                jwksUrl: string | null;
                kid: string | null;
                lastUsedAt: string | null;
                metadata: string | null;
                mode: string;
                name: string;
                publicKey: string;
                status: string;
                updatedAt: string;
                userId: string | null;
            };
            Insert: {
                activatedAt?: string | null;
                createdAt: string;
                expiresAt?: string | null;
                hostId: string;
                id: string;
                jwksUrl?: string | null;
                kid?: string | null;
                lastUsedAt?: string | null;
                metadata?: string | null;
                mode: string;
                name: string;
                publicKey: string;
                status: string;
                updatedAt: string;
                userId?: string | null;
            };
            Update: {
                activatedAt?: string | null;
                createdAt?: string;
                expiresAt?: string | null;
                hostId?: string;
                id?: string;
                jwksUrl?: string | null;
                kid?: string | null;
                lastUsedAt?: string | null;
                metadata?: string | null;
                mode?: string;
                name?: string;
                publicKey?: string;
                status?: string;
                updatedAt?: string;
                userId?: string | null;
            };
            Relationships: [{
                foreignKeyName: "agent_hostId_fkey";
                columns: ["hostId"];
                isOneToOne: false;
                referencedRelation: "agentHost";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "agent_userId_fkey";
                columns: ["userId"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        agentCapabilityGrant: {
            Row: {
                agentId: string;
                capability: string;
                constraints: string | null;
                createdAt: string;
                deniedBy: string | null;
                expiresAt: string | null;
                grantedBy: string | null;
                id: string;
                reason: string | null;
                status: string;
                updatedAt: string;
            };
            Insert: {
                agentId: string;
                capability: string;
                constraints?: string | null;
                createdAt: string;
                deniedBy?: string | null;
                expiresAt?: string | null;
                grantedBy?: string | null;
                id: string;
                reason?: string | null;
                status: string;
                updatedAt: string;
            };
            Update: {
                agentId?: string;
                capability?: string;
                constraints?: string | null;
                createdAt?: string;
                deniedBy?: string | null;
                expiresAt?: string | null;
                grantedBy?: string | null;
                id?: string;
                reason?: string | null;
                status?: string;
                updatedAt?: string;
            };
            Relationships: [{
                foreignKeyName: "agentCapabilityGrant_agentId_fkey";
                columns: ["agentId"];
                isOneToOne: false;
                referencedRelation: "agent";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "agentCapabilityGrant_deniedBy_fkey";
                columns: ["deniedBy"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "agentCapabilityGrant_grantedBy_fkey";
                columns: ["grantedBy"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        agentHost: {
            Row: {
                activatedAt: string | null;
                createdAt: string;
                defaultCapabilities: string | null;
                enrollmentTokenExpiresAt: string | null;
                enrollmentTokenHash: string | null;
                expiresAt: string | null;
                id: string;
                jwksUrl: string | null;
                kid: string | null;
                lastUsedAt: string | null;
                name: string | null;
                publicKey: string | null;
                status: string;
                updatedAt: string;
                userId: string | null;
            };
            Insert: {
                activatedAt?: string | null;
                createdAt: string;
                defaultCapabilities?: string | null;
                enrollmentTokenExpiresAt?: string | null;
                enrollmentTokenHash?: string | null;
                expiresAt?: string | null;
                id: string;
                jwksUrl?: string | null;
                kid?: string | null;
                lastUsedAt?: string | null;
                name?: string | null;
                publicKey?: string | null;
                status: string;
                updatedAt: string;
                userId?: string | null;
            };
            Update: {
                activatedAt?: string | null;
                createdAt?: string;
                defaultCapabilities?: string | null;
                enrollmentTokenExpiresAt?: string | null;
                enrollmentTokenHash?: string | null;
                expiresAt?: string | null;
                id?: string;
                jwksUrl?: string | null;
                kid?: string | null;
                lastUsedAt?: string | null;
                name?: string | null;
                publicKey?: string | null;
                status?: string;
                updatedAt?: string;
                userId?: string | null;
            };
            Relationships: [{
                foreignKeyName: "agentHost_userId_fkey";
                columns: ["userId"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        approvalRequest: {
            Row: {
                agentId: string | null;
                bindingMessage: string | null;
                capabilities: string | null;
                clientNotificationEndpoint: string | null;
                clientNotificationToken: string | null;
                createdAt: string;
                deliveryMode: string | null;
                expiresAt: string;
                hostId: string | null;
                id: string;
                interval: number;
                lastPolledAt: string | null;
                loginHint: string | null;
                method: string;
                status: string;
                updatedAt: string;
                userCodeHash: string | null;
                userId: string | null;
            };
            Insert: {
                agentId?: string | null;
                bindingMessage?: string | null;
                capabilities?: string | null;
                clientNotificationEndpoint?: string | null;
                clientNotificationToken?: string | null;
                createdAt: string;
                deliveryMode?: string | null;
                expiresAt: string;
                hostId?: string | null;
                id: string;
                interval: number;
                lastPolledAt?: string | null;
                loginHint?: string | null;
                method: string;
                status: string;
                updatedAt: string;
                userCodeHash?: string | null;
                userId?: string | null;
            };
            Update: {
                agentId?: string | null;
                bindingMessage?: string | null;
                capabilities?: string | null;
                clientNotificationEndpoint?: string | null;
                clientNotificationToken?: string | null;
                createdAt?: string;
                deliveryMode?: string | null;
                expiresAt?: string;
                hostId?: string | null;
                id?: string;
                interval?: number;
                lastPolledAt?: string | null;
                loginHint?: string | null;
                method?: string;
                status?: string;
                updatedAt?: string;
                userCodeHash?: string | null;
                userId?: string | null;
            };
            Relationships: [{
                foreignKeyName: "approvalRequest_agentId_fkey";
                columns: ["agentId"];
                isOneToOne: false;
                referencedRelation: "agent";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "approvalRequest_hostId_fkey";
                columns: ["hostId"];
                isOneToOne: false;
                referencedRelation: "agentHost";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "approvalRequest_userId_fkey";
                columns: ["userId"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        article_bookmarks: {
            Row: {
                article_id: string;
                created_at: string | null;
                id: string;
                user_id: string;
            };
            Insert: {
                article_id: string;
                created_at?: string | null;
                id?: string;
                user_id: string;
            };
            Update: {
                article_id?: string;
                created_at?: string | null;
                id?: string;
                user_id?: string;
            };
            Relationships: [];
        };
        article_categories: {
            Row: {
                color: string | null;
                created_at: string | null;
                description: string | null;
                id: string;
                name: string;
                slug: string;
            };
            Insert: {
                color?: string | null;
                created_at?: string | null;
                description?: string | null;
                id?: string;
                name: string;
                slug: string;
            };
            Update: {
                color?: string | null;
                created_at?: string | null;
                description?: string | null;
                id?: string;
                name?: string;
                slug?: string;
            };
            Relationships: [];
        };
        article_comments: {
            Row: {
                article_id: string;
                content: string;
                created_at: string;
                id: string;
                is_edited: boolean;
                is_pinned: boolean;
                parent_id: string | null;
                updated_at: string;
                user_id: string;
            };
            Insert: {
                article_id: string;
                content: string;
                created_at?: string;
                id?: string;
                is_edited?: boolean;
                is_pinned?: boolean;
                parent_id?: string | null;
                updated_at?: string;
                user_id: string;
            };
            Update: {
                article_id?: string;
                content?: string;
                created_at?: string;
                id?: string;
                is_edited?: boolean;
                is_pinned?: boolean;
                parent_id?: string | null;
                updated_at?: string;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "article_comments_article_id_fkey";
                columns: ["article_id"];
                isOneToOne: false;
                referencedRelation: "articles";
                referencedColumns: ["id"];
            }, {
                foreignKeyName: "article_comments_parent_id_fkey";
                columns: ["parent_id"];
                isOneToOne: false;
                referencedRelation: "article_comments";
                referencedColumns: ["id"];
            }];
        };
        article_reactions: {
            Row: {
                article_id: string;
                created_at: string | null;
                id: string;
                reaction_type: string;
                user_id: string;
            };
            Insert: {
                article_id: string;
                created_at?: string | null;
                id?: string;
                reaction_type?: string;
                user_id: string;
            };
            Update: {
                article_id?: string;
                created_at?: string | null;
                id?: string;
                reaction_type?: string;
                user_id?: string;
            };
            Relationships: [];
        };
        article_series: {
            Row: {
                author_id: string | null;
                cover_image_url: string | null;
                created_at: string;
                description: string | null;
                id: string;
                slug: string;
                title: string;
            };
            Insert: {
                author_id?: string | null;
                cover_image_url?: string | null;
                created_at?: string;
                description?: string | null;
                id?: string;
                slug: string;
                title: string;
            };
            Update: {
                author_id?: string | null;
                cover_image_url?: string | null;
                created_at?: string;
                description?: string | null;
                id?: string;
                slug?: string;
                title?: string;
            };
            Relationships: [];
        };
        articles: {
            Row: {
                app: string;
                author_id: string | null;
                category: string | null;
                co_authors: import("./types.gen").Json | null;
                content: string;
                created_at: string | null;
                excerpt: string | null;
                featured_image_alt: string | null;
                featured_image_url: string | null;
                id: string;
                meta_description: string | null;
                meta_title: string | null;
                pinned: boolean | null;
                published_at: string | null;
                scheduled_at: string | null;
                search_vector: unknown;
                series_id: string | null;
                series_order: number;
                share_count: number;
                slug: string;
                status: string | null;
                tags: string[] | null;
                title: string;
                updated_at: string | null;
                view_count: number | null;
            };
            Insert: {
                app?: string;
                author_id?: string | null;
                category?: string | null;
                co_authors?: import("./types.gen").Json | null;
                content: string;
                created_at?: string | null;
                excerpt?: string | null;
                featured_image_alt?: string | null;
                featured_image_url?: string | null;
                id?: string;
                meta_description?: string | null;
                meta_title?: string | null;
                pinned?: boolean | null;
                published_at?: string | null;
                scheduled_at?: string | null;
                search_vector?: unknown;
                series_id?: string | null;
                series_order?: number;
                share_count?: number;
                slug: string;
                status?: string | null;
                tags?: string[] | null;
                title: string;
                updated_at?: string | null;
                view_count?: number | null;
            };
            Update: {
                app?: string;
                author_id?: string | null;
                category?: string | null;
                co_authors?: import("./types.gen").Json | null;
                content?: string;
                created_at?: string | null;
                excerpt?: string | null;
                featured_image_alt?: string | null;
                featured_image_url?: string | null;
                id?: string;
                meta_description?: string | null;
                meta_title?: string | null;
                pinned?: boolean | null;
                published_at?: string | null;
                scheduled_at?: string | null;
                search_vector?: unknown;
                series_id?: string | null;
                series_order?: number;
                share_count?: number;
                slug?: string;
                status?: string | null;
                tags?: string[] | null;
                title?: string;
                updated_at?: string | null;
                view_count?: number | null;
            };
            Relationships: [{
                foreignKeyName: "articles_series_id_fkey";
                columns: ["series_id"];
                isOneToOne: false;
                referencedRelation: "article_series";
                referencedColumns: ["id"];
            }];
        };
        audit_logs: {
            Row: {
                action: string;
                created_at: string | null;
                details: import("./types.gen").Json | null;
                id: string;
                ip_address: string | null;
                user_agent: string | null;
                user_id: string | null;
            };
            Insert: {
                action: string;
                created_at?: string | null;
                details?: import("./types.gen").Json | null;
                id?: string;
                ip_address?: string | null;
                user_agent?: string | null;
                user_id?: string | null;
            };
            Update: {
                action?: string;
                created_at?: string | null;
                details?: import("./types.gen").Json | null;
                id?: string;
                ip_address?: string | null;
                user_agent?: string | null;
                user_id?: string | null;
            };
            Relationships: [];
        };
        chronicles: {
            Row: {
                author_id: string;
                category: string;
                content: string;
                created_at: string | null;
                excerpt: string | null;
                featured_image: string | null;
                id: string;
                published: boolean | null;
                slug: string;
                title: string;
                updated_at: string | null;
                views_count: number | null;
            };
            Insert: {
                author_id: string;
                category?: string;
                content: string;
                created_at?: string | null;
                excerpt?: string | null;
                featured_image?: string | null;
                id?: string;
                published?: boolean | null;
                slug: string;
                title: string;
                updated_at?: string | null;
                views_count?: number | null;
            };
            Update: {
                author_id?: string;
                category?: string;
                content?: string;
                created_at?: string | null;
                excerpt?: string | null;
                featured_image?: string | null;
                id?: string;
                published?: boolean | null;
                slug?: string;
                title?: string;
                updated_at?: string | null;
                views_count?: number | null;
            };
            Relationships: [];
        };
        comment_reports: {
            Row: {
                comment_id: string;
                created_at: string;
                details: string | null;
                id: string;
                reason: string;
                reporter_id: string;
                reviewed_by: string | null;
                status: string;
            };
            Insert: {
                comment_id: string;
                created_at?: string;
                details?: string | null;
                id?: string;
                reason: string;
                reporter_id: string;
                reviewed_by?: string | null;
                status?: string;
            };
            Update: {
                comment_id?: string;
                created_at?: string;
                details?: string | null;
                id?: string;
                reason?: string;
                reporter_id?: string;
                reviewed_by?: string | null;
                status?: string;
            };
            Relationships: [{
                foreignKeyName: "comment_reports_comment_id_fkey";
                columns: ["comment_id"];
                isOneToOne: false;
                referencedRelation: "article_comments";
                referencedColumns: ["id"];
            }];
        };
        discord_members: {
            Row: {
                avatar_url: string | null;
                discord_id: string;
                display_name: string | null;
                is_bot: boolean | null;
                joined_at: string | null;
                nickname: string | null;
                premium_since: string | null;
                roles: string[] | null;
                updated_at: string | null;
                username: string;
            };
            Insert: {
                avatar_url?: string | null;
                discord_id: string;
                display_name?: string | null;
                is_bot?: boolean | null;
                joined_at?: string | null;
                nickname?: string | null;
                premium_since?: string | null;
                roles?: string[] | null;
                updated_at?: string | null;
                username: string;
            };
            Update: {
                avatar_url?: string | null;
                discord_id?: string;
                display_name?: string | null;
                is_bot?: boolean | null;
                joined_at?: string | null;
                nickname?: string | null;
                premium_since?: string | null;
                roles?: string[] | null;
                updated_at?: string | null;
                username?: string;
            };
            Relationships: [];
        };
        discord_roles: {
            Row: {
                color: number | null;
                guild_id: string;
                icon_url: string | null;
                is_hoisted: boolean | null;
                is_mentionable: boolean | null;
                name: string;
                permissions: string | null;
                position: number | null;
                role_id: string;
                updated_at: string | null;
            };
            Insert: {
                color?: number | null;
                guild_id: string;
                icon_url?: string | null;
                is_hoisted?: boolean | null;
                is_mentionable?: boolean | null;
                name: string;
                permissions?: string | null;
                position?: number | null;
                role_id: string;
                updated_at?: string | null;
            };
            Update: {
                color?: number | null;
                guild_id?: string;
                icon_url?: string | null;
                is_hoisted?: boolean | null;
                is_mentionable?: boolean | null;
                name?: string;
                permissions?: string | null;
                position?: number | null;
                role_id?: string;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        discord_sync_logs: {
            Row: {
                created_at: string | null;
                error_count: number | null;
                id: string;
                message: string | null;
                status: string;
                total_members: number | null;
                updated_count: number | null;
            };
            Insert: {
                created_at?: string | null;
                error_count?: number | null;
                id?: string;
                message?: string | null;
                status: string;
                total_members?: number | null;
                updated_count?: number | null;
            };
            Update: {
                created_at?: string | null;
                error_count?: number | null;
                id?: string;
                message?: string | null;
                status?: string;
                total_members?: number | null;
                updated_count?: number | null;
            };
            Relationships: [];
        };
        email_templates: {
            Row: {
                body_html: string;
                created_at: string;
                description: string | null;
                id: string;
                slug: string;
                subject: string;
                updated_at: string;
            };
            Insert: {
                body_html: string;
                created_at?: string;
                description?: string | null;
                id?: string;
                slug: string;
                subject: string;
                updated_at?: string;
            };
            Update: {
                body_html?: string;
                created_at?: string;
                description?: string | null;
                id?: string;
                slug?: string;
                subject?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        events: {
            Row: {
                created_at: string;
                description: string | null;
                end_time: string;
                id: string;
                image_url: string | null;
                location: string | null;
                start_time: string;
                title: string;
                updated_at: string;
            };
            Insert: {
                created_at?: string;
                description?: string | null;
                end_time: string;
                id?: string;
                image_url?: string | null;
                location?: string | null;
                start_time: string;
                title: string;
                updated_at?: string;
            };
            Update: {
                created_at?: string;
                description?: string | null;
                end_time?: string;
                id?: string;
                image_url?: string | null;
                location?: string | null;
                start_time?: string;
                title?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        inagle_activity_photos: {
            Row: {
                data: import("./types.gen").Json | null;
                id: string;
                image_path: string | null;
                reward: number | null;
                trophy_id_hex: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                id: string;
                image_path?: string | null;
                reward?: number | null;
                trophy_id_hex?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                id?: string;
                image_path?: string | null;
                reward?: number | null;
                trophy_id_hex?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_auras: {
            Row: {
                asset_code: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_awakenings: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_basara: {
            Row: {
                agility: number | null;
                alt_moveset: string | null;
                alt_position: string | null;
                character_id: string;
                control: number | null;
                element: string | null;
                gender: string | null;
                intelligence: number | null;
                kick: number | null;
                moveset: string | null;
                name_localised: string | null;
                name_romaji: string | null;
                passive: string | null;
                physical: number | null;
                position: string | null;
                pressure: number | null;
                technique: number | null;
            };
            Insert: {
                agility?: number | null;
                alt_moveset?: string | null;
                alt_position?: string | null;
                character_id: string;
                control?: number | null;
                element?: string | null;
                gender?: string | null;
                intelligence?: number | null;
                kick?: number | null;
                moveset?: string | null;
                name_localised?: string | null;
                name_romaji?: string | null;
                passive?: string | null;
                physical?: number | null;
                position?: string | null;
                pressure?: number | null;
                technique?: number | null;
            };
            Update: {
                agility?: number | null;
                alt_moveset?: string | null;
                alt_position?: string | null;
                character_id?: string;
                control?: number | null;
                element?: string | null;
                gender?: string | null;
                intelligence?: number | null;
                kick?: number | null;
                moveset?: string | null;
                name_localised?: string | null;
                name_romaji?: string | null;
                passive?: string | null;
                physical?: number | null;
                position?: string | null;
                pressure?: number | null;
                technique?: number | null;
            };
            Relationships: [];
        };
        inagle_capsules: {
            Row: {
                data: import("./types.gen").Json | null;
                id: string;
                prize_data: import("./types.gen").Json | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                id: string;
                prize_data?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                id?: string;
                prize_data?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_chara_menu_resource: {
            Row: {
                data: import("./types.gen").Json | null;
                id: string;
                is_template: boolean | null;
                paths: import("./types.gen").Json | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                id: string;
                is_template?: boolean | null;
                paths?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                id?: string;
                is_template?: boolean | null;
                paths?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_characters: {
            Row: {
                base_slug: string | null;
                chara_id: string | null;
                constellation: string | null;
                constellation_index: number | null;
                control_type: string | null;
                created_at: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element: string | null;
                element_id: number | null;
                game_appearances: string[] | null;
                gender: string | null;
                hero_type: string | null;
                id: string;
                image_url: string | null;
                internal_code: string | null;
                is_controllable: boolean | null;
                is_primary: boolean | null;
                model_id: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                position: string | null;
                position_id: number | null;
                rarity: string | null;
                rarity_code: number | null;
                rarity_label: string | null;
                series: string | null;
                sheet_data: import("./types.gen").Json | null;
                skills: import("./types.gen").Json | null;
                slug: string | null;
                stat_agilite: number | null;
                stat_controle: number | null;
                stat_frappe: number | null;
                stat_intelligence: number | null;
                stat_lv1_agilite: number | null;
                stat_lv1_controle: number | null;
                stat_lv1_frappe: number | null;
                stat_lv1_intelligence: number | null;
                stat_lv1_physique: number | null;
                stat_lv1_pression: number | null;
                stat_lv1_technique: number | null;
                stat_physique: number | null;
                stat_pression: number | null;
                stat_technique: number | null;
                stat_total: number | null;
                stats: import("./types.gen").Json | null;
                team_id: string | null;
                teams: import("./types.gen").Json | null;
                updated_at: string | null;
                zukan_hash: string | null;
                zukan_order: number | null;
            };
            Insert: {
                base_slug?: string | null;
                chara_id?: string | null;
                constellation?: string | null;
                constellation_index?: number | null;
                control_type?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element?: string | null;
                element_id?: number | null;
                game_appearances?: string[] | null;
                gender?: string | null;
                hero_type?: string | null;
                id: string;
                image_url?: string | null;
                internal_code?: string | null;
                is_controllable?: boolean | null;
                is_primary?: boolean | null;
                model_id?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                position?: string | null;
                position_id?: number | null;
                rarity?: string | null;
                rarity_code?: number | null;
                rarity_label?: string | null;
                series?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                skills?: import("./types.gen").Json | null;
                slug?: string | null;
                stat_agilite?: number | null;
                stat_controle?: number | null;
                stat_frappe?: number | null;
                stat_intelligence?: number | null;
                stat_lv1_agilite?: number | null;
                stat_lv1_controle?: number | null;
                stat_lv1_frappe?: number | null;
                stat_lv1_intelligence?: number | null;
                stat_lv1_physique?: number | null;
                stat_lv1_pression?: number | null;
                stat_lv1_technique?: number | null;
                stat_physique?: number | null;
                stat_pression?: number | null;
                stat_technique?: number | null;
                stat_total?: number | null;
                stats?: import("./types.gen").Json | null;
                team_id?: string | null;
                teams?: import("./types.gen").Json | null;
                updated_at?: string | null;
                zukan_hash?: string | null;
                zukan_order?: number | null;
            };
            Update: {
                base_slug?: string | null;
                chara_id?: string | null;
                constellation?: string | null;
                constellation_index?: number | null;
                control_type?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element?: string | null;
                element_id?: number | null;
                game_appearances?: string[] | null;
                gender?: string | null;
                hero_type?: string | null;
                id?: string;
                image_url?: string | null;
                internal_code?: string | null;
                is_controllable?: boolean | null;
                is_primary?: boolean | null;
                model_id?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                position?: string | null;
                position_id?: number | null;
                rarity?: string | null;
                rarity_code?: number | null;
                rarity_label?: string | null;
                series?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                skills?: import("./types.gen").Json | null;
                slug?: string | null;
                stat_agilite?: number | null;
                stat_controle?: number | null;
                stat_frappe?: number | null;
                stat_intelligence?: number | null;
                stat_lv1_agilite?: number | null;
                stat_lv1_controle?: number | null;
                stat_lv1_frappe?: number | null;
                stat_lv1_intelligence?: number | null;
                stat_lv1_physique?: number | null;
                stat_lv1_pression?: number | null;
                stat_lv1_technique?: number | null;
                stat_physique?: number | null;
                stat_pression?: number | null;
                stat_technique?: number | null;
                stat_total?: number | null;
                stats?: import("./types.gen").Json | null;
                team_id?: string | null;
                teams?: import("./types.gen").Json | null;
                updated_at?: string | null;
                zukan_hash?: string | null;
                zukan_order?: number | null;
            };
            Relationships: [];
        };
        inagle_chat_emotes: {
            Row: {
                data: import("./types.gen").Json | null;
                emote_id: string | null;
                flag_idx: number | null;
                id: string;
                sort_id: number | null;
                stamp_idx: number | null;
                text_id: string | null;
                type: number | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                emote_id?: string | null;
                flag_idx?: number | null;
                id: string;
                sort_id?: number | null;
                stamp_idx?: number | null;
                text_id?: string | null;
                type?: number | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                emote_id?: string | null;
                flag_idx?: number | null;
                id?: string;
                sort_id?: number | null;
                stamp_idx?: number | null;
                text_id?: string | null;
                type?: number | null;
                updated_at?: string | null;
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
        inagle_costumes: {
            Row: {
                costume_index: number | null;
                data: import("./types.gen").Json | null;
                flag1: number | null;
                flag2: number | null;
                id: string;
                model_ref: string | null;
                type: number | null;
                updated_at: string | null;
            };
            Insert: {
                costume_index?: number | null;
                data?: import("./types.gen").Json | null;
                flag1?: number | null;
                flag2?: number | null;
                id: string;
                model_ref?: string | null;
                type?: number | null;
                updated_at?: string | null;
            };
            Update: {
                costume_index?: number | null;
                data?: import("./types.gen").Json | null;
                flag1?: number | null;
                flag2?: number | null;
                id?: string;
                model_ref?: string | null;
                type?: number | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_custom_passives: {
            Row: {
                buff: string | null;
                id: number;
                requirements: string | null;
                stat: string | null;
            };
            Insert: {
                buff?: string | null;
                id: number;
                requirements?: string | null;
                stat?: string | null;
            };
            Update: {
                buff?: string | null;
                id?: number;
                requirements?: string | null;
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
        inagle_drops_battles: {
            Row: {
                battle_group_id: number;
                data: import("./types.gen").Json | null;
                item_table_id: number | null;
                updated_at: string | null;
            };
            Insert: {
                battle_group_id: number;
                data?: import("./types.gen").Json | null;
                item_table_id?: number | null;
                updated_at?: string | null;
            };
            Update: {
                battle_group_id?: number;
                data?: import("./types.gen").Json | null;
                item_table_id?: number | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_drops_tables: {
            Row: {
                entries: import("./types.gen").Json | null;
                table_id: string;
                updated_at: string | null;
            };
            Insert: {
                entries?: import("./types.gen").Json | null;
                table_id: string;
                updated_at?: string | null;
            };
            Update: {
                entries?: import("./types.gen").Json | null;
                table_id?: string;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_drops_treasures: {
            Row: {
                data: import("./types.gen").Json | null;
                id: string;
                items: import("./types.gen").Json | null;
                map_id: string | null;
                pos: import("./types.gen").Json | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                id?: string;
                items?: import("./types.gen").Json | null;
                map_id?: string | null;
                pos?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                id?: string;
                items?: import("./types.gen").Json | null;
                map_id?: string | null;
                pos?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_exp_table: {
            Row: {
                level: number;
                need_exp: number;
            };
            Insert: {
                level: number;
                need_exp: number;
            };
            Update: {
                level?: number;
                need_exp?: number;
            };
            Relationships: [];
        };
        inagle_formations: {
            Row: {
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                emblem_url: string | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                emblem_url?: string | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                emblem_url?: string | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_gallery: {
            Row: {
                data: import("./types.gen").Json | null;
                flg_no: number | null;
                id: string;
                img_path: string | null;
                need_token_num: number | null;
                thumb_path: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                flg_no?: number | null;
                id: string;
                img_path?: string | null;
                need_token_num?: number | null;
                thumb_path?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                flg_no?: number | null;
                id?: string;
                img_path?: string | null;
                need_token_num?: number | null;
                thumb_path?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_growth_tables: {
            Row: {
                chara_rank: number | null;
                data: import("./types.gen").Json;
                growth_pattern: number | null;
                id: number;
                main_position: number | null;
                play_style: number | null;
                section: string;
                sub_position: number | null;
            };
            Insert: {
                chara_rank?: number | null;
                data: import("./types.gen").Json;
                growth_pattern?: number | null;
                id?: number;
                main_position?: number | null;
                play_style?: number | null;
                section: string;
                sub_position?: number | null;
            };
            Update: {
                chara_rank?: number | null;
                data?: import("./types.gen").Json;
                growth_pattern?: number | null;
                id?: number;
                main_position?: number | null;
                play_style?: number | null;
                section?: string;
                sub_position?: number | null;
            };
            Relationships: [];
        };
        inagle_heroes: {
            Row: {
                agility: number | null;
                character_id: string;
                control: number | null;
                element: string | null;
                gender: string | null;
                intelligence: number | null;
                kick: number | null;
                moveset: string | null;
                name_localised: string | null;
                name_romaji: string | null;
                physical: number | null;
                playstyle: string;
                position: string | null;
                pressure: number | null;
                technique: number | null;
            };
            Insert: {
                agility?: number | null;
                character_id: string;
                control?: number | null;
                element?: string | null;
                gender?: string | null;
                intelligence?: number | null;
                kick?: number | null;
                moveset?: string | null;
                name_localised?: string | null;
                name_romaji?: string | null;
                physical?: number | null;
                playstyle: string;
                position?: string | null;
                pressure?: number | null;
                technique?: number | null;
            };
            Update: {
                agility?: number | null;
                character_id?: string;
                control?: number | null;
                element?: string | null;
                gender?: string | null;
                intelligence?: number | null;
                kick?: number | null;
                moveset?: string | null;
                name_localised?: string | null;
                name_romaji?: string | null;
                physical?: number | null;
                playstyle?: string;
                position?: string | null;
                pressure?: number | null;
                technique?: number | null;
            };
            Relationships: [];
        };
        inagle_icon_inventory: {
            Row: {
                filename: string;
                folder: string;
                id: string;
                mime: string | null;
                path: string;
                size: number | null;
                subfolder: string | null;
                updated_at: string | null;
            };
            Insert: {
                filename: string;
                folder: string;
                id: string;
                mime?: string | null;
                path: string;
                size?: number | null;
                subfolder?: string | null;
                updated_at?: string | null;
            };
            Update: {
                filename?: string;
                folder?: string;
                id?: string;
                mime?: string | null;
                path?: string;
                size?: number | null;
                subfolder?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_img_inventory: {
            Row: {
                filename: string;
                folder: string;
                id: string;
                mime: string | null;
                path: string;
                size: number | null;
                subfolder: string | null;
                updated_at: string | null;
            };
            Insert: {
                filename: string;
                folder: string;
                id: string;
                mime?: string | null;
                path: string;
                size?: number | null;
                subfolder?: string | null;
                updated_at?: string | null;
            };
            Update: {
                filename?: string;
                folder?: string;
                id?: string;
                mime?: string | null;
                path?: string;
                size?: number | null;
                subfolder?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_items: {
            Row: {
                boost_type: string | null;
                buy_price: number | null;
                category: string | null;
                created_at: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                effect_value: number | null;
                id: string;
                image_url: string | null;
                internal_code: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                price: number | null;
                rarity: number | null;
                sell_price: number | null;
                sheet_data: import("./types.gen").Json | null;
                shop_names: string[] | null;
                shops: import("./types.gen").Json | null;
                stat_boost_1: string | null;
                stat_boost_2: string | null;
                updated_at: string | null;
            };
            Insert: {
                boost_type?: string | null;
                buy_price?: number | null;
                category?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                effect_value?: number | null;
                id: string;
                image_url?: string | null;
                internal_code?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                price?: number | null;
                rarity?: number | null;
                sell_price?: number | null;
                sheet_data?: import("./types.gen").Json | null;
                shop_names?: string[] | null;
                shops?: import("./types.gen").Json | null;
                stat_boost_1?: string | null;
                stat_boost_2?: string | null;
                updated_at?: string | null;
            };
            Update: {
                boost_type?: string | null;
                buy_price?: number | null;
                category?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                effect_value?: number | null;
                id?: string;
                image_url?: string | null;
                internal_code?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                price?: number | null;
                rarity?: number | null;
                sell_price?: number | null;
                sheet_data?: import("./types.gen").Json | null;
                shop_names?: string[] | null;
                shops?: import("./types.gen").Json | null;
                stat_boost_1?: string | null;
                stat_boost_2?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_keshins: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
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
        inagle_manager_passives: {
            Row: {
                coord_common: string | null;
                coord_legendary: string | null;
                id: number;
                manager_common: string | null;
                manager_legendary: string | null;
                playstyle: string | null;
                requirements: string | null;
                stat: string | null;
            };
            Insert: {
                coord_common?: string | null;
                coord_legendary?: string | null;
                id: number;
                manager_common?: string | null;
                manager_legendary?: string | null;
                playstyle?: string | null;
                requirements?: string | null;
                stat?: string | null;
            };
            Update: {
                coord_common?: string | null;
                coord_legendary?: string | null;
                id?: number;
                manager_common?: string | null;
                manager_legendary?: string | null;
                playstyle?: string | null;
                requirements?: string | null;
                stat?: string | null;
            };
            Relationships: [];
        };
        inagle_media_assets: {
            Row: {
                category: string;
                context: import("./types.gen").Json | null;
                data: import("./types.gen").Json | null;
                folder: string;
                id: string;
                is_template: boolean | null;
                path: string;
                sources: import("./types.gen").Json | null;
                updated_at: string | null;
            };
            Insert: {
                category: string;
                context?: import("./types.gen").Json | null;
                data?: import("./types.gen").Json | null;
                folder: string;
                id: string;
                is_template?: boolean | null;
                path: string;
                sources?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Update: {
                category?: string;
                context?: import("./types.gen").Json | null;
                data?: import("./types.gen").Json | null;
                folder?: string;
                id?: string;
                is_template?: boolean | null;
                path?: string;
                sources?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_miximax: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                icon_code: string | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                icon_code?: string | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                icon_code?: string | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_mode_changes: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_nameplates: {
            Row: {
                data: import("./types.gen").Json | null;
                font_style: string | null;
                id: string;
                image_path: string | null;
                name_text_id: string | null;
                sort_no: number | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                font_style?: string | null;
                id: string;
                image_path?: string | null;
                name_text_id?: string | null;
                sort_no?: number | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                font_style?: string | null;
                id?: string;
                image_path?: string | null;
                name_text_id?: string | null;
                sort_no?: number | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_opponent_teams: {
            Row: {
                bg_texture: string | null;
                data: import("./types.gen").Json | null;
                difficulty_type: number | null;
                game_id: string | null;
                id: string;
                team_id: string | null;
                type: number | null;
                updated_at: string | null;
            };
            Insert: {
                bg_texture?: string | null;
                data?: import("./types.gen").Json | null;
                difficulty_type?: number | null;
                game_id?: string | null;
                id: string;
                team_id?: string | null;
                type?: number | null;
                updated_at?: string | null;
            };
            Update: {
                bg_texture?: string | null;
                data?: import("./types.gen").Json | null;
                difficulty_type?: number | null;
                game_id?: string | null;
                id?: string;
                team_id?: string | null;
                type?: number | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_override_skills: {
            Row: {
                category_id: number | null;
                conditions: import("./types.gen").Json | null;
                created_at: string | null;
                element_id: number | null;
                id: string;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                power_max: number | null;
                power_min: number | null;
            };
            Insert: {
                category_id?: number | null;
                conditions?: import("./types.gen").Json | null;
                created_at?: string | null;
                element_id?: number | null;
                id: string;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                power_max?: number | null;
                power_min?: number | null;
            };
            Update: {
                category_id?: number | null;
                conditions?: import("./types.gen").Json | null;
                created_at?: string | null;
                element_id?: number | null;
                id?: string;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                power_max?: number | null;
                power_min?: number | null;
            };
            Relationships: [];
        };
        inagle_passive_generation: {
            Row: {
                no: number;
                passive_id: string;
                requirement: string | null;
                stat: string | null;
            };
            Insert: {
                no: number;
                passive_id: string;
                requirement?: string | null;
                stat?: string | null;
            };
            Update: {
                no?: number;
                passive_id?: string;
                requirement?: string | null;
                stat?: string | null;
            };
            Relationships: [];
        };
        inagle_passive_scaling: {
            Row: {
                advanced_high: string | null;
                advanced_low: string | null;
                common_high: string | null;
                common_low: string | null;
                growing_high: string | null;
                growing_low: string | null;
                id: number;
                legendary_high: string | null;
                legendary_low: string | null;
                requirement: string | null;
                stat_affected: string | null;
                top_high: string | null;
                top_low: string | null;
            };
            Insert: {
                advanced_high?: string | null;
                advanced_low?: string | null;
                common_high?: string | null;
                common_low?: string | null;
                growing_high?: string | null;
                growing_low?: string | null;
                id: number;
                legendary_high?: string | null;
                legendary_low?: string | null;
                requirement?: string | null;
                stat_affected?: string | null;
                top_high?: string | null;
                top_low?: string | null;
            };
            Update: {
                advanced_high?: string | null;
                advanced_low?: string | null;
                common_high?: string | null;
                common_low?: string | null;
                growing_high?: string | null;
                growing_low?: string | null;
                id?: number;
                legendary_high?: string | null;
                legendary_low?: string | null;
                requirement?: string | null;
                stat_affected?: string | null;
                top_high?: string | null;
                top_low?: string | null;
            };
            Relationships: [];
        };
        inagle_passives: {
            Row: {
                boost_type: string | null;
                category: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                effect_value: string | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                stat_boost: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                boost_type?: string | null;
                category?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                effect_value?: string | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                stat_boost?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                boost_type?: string | null;
                category?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                effect_value?: string | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                stat_boost?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_performances: {
            Row: {
                data: import("./types.gen").Json | null;
                event_id: string | null;
                event_name_text_id: string | null;
                id: string;
                image_path: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                event_id?: string | null;
                event_name_text_id?: string | null;
                id: string;
                image_path?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                event_id?: string | null;
                event_name_text_id?: string | null;
                id?: string;
                image_path?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_phase_titles: {
            Row: {
                data: import("./types.gen").Json | null;
                id: string;
                image_path: string | null;
                texture_id: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                id: string;
                image_path?: string | null;
                texture_id?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                id?: string;
                image_path?: string | null;
                texture_id?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_quests: {
            Row: {
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                display_text: string | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                phase: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                display_text?: string | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                phase?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                display_text?: string | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                phase?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_scene_archives: {
            Row: {
                category: number | null;
                chapter_no: number | null;
                data: import("./types.gen").Json | null;
                event_id: string | null;
                id: string;
                image_path: string | null;
                title_text_id: string | null;
                updated_at: string | null;
            };
            Insert: {
                category?: number | null;
                chapter_no?: number | null;
                data?: import("./types.gen").Json | null;
                event_id?: string | null;
                id: string;
                image_path?: string | null;
                title_text_id?: string | null;
                updated_at?: string | null;
            };
            Update: {
                category?: number | null;
                chapter_no?: number | null;
                data?: import("./types.gen").Json | null;
                event_id?: string | null;
                id?: string;
                image_path?: string | null;
                title_text_id?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_skills: {
            Row: {
                category: string | null;
                category_id: number | null;
                created_at: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element: string | null;
                element_id: number | null;
                evolution_type: string | null;
                foul_rate: number | null;
                growth_type: string | null;
                hash_id: string | null;
                id: string;
                image_url: string | null;
                internal_code: string | null;
                is_eldorado: boolean | null;
                is_hyper: boolean | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                partner_count: number | null;
                poster_url: string | null;
                power_max: number | null;
                power_min: number | null;
                recast_time: number | null;
                sheet_data: import("./types.gen").Json | null;
                skill_effect_bit_flag: number | null;
                tags: string[] | null;
                tension_cost: number | null;
                tp_cost: number | null;
                updated_at: string | null;
                video_url: string | null;
            };
            Insert: {
                category?: string | null;
                category_id?: number | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element?: string | null;
                element_id?: number | null;
                evolution_type?: string | null;
                foul_rate?: number | null;
                growth_type?: string | null;
                hash_id?: string | null;
                id: string;
                image_url?: string | null;
                internal_code?: string | null;
                is_eldorado?: boolean | null;
                is_hyper?: boolean | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                partner_count?: number | null;
                poster_url?: string | null;
                power_max?: number | null;
                power_min?: number | null;
                recast_time?: number | null;
                sheet_data?: import("./types.gen").Json | null;
                skill_effect_bit_flag?: number | null;
                tags?: string[] | null;
                tension_cost?: number | null;
                tp_cost?: number | null;
                updated_at?: string | null;
                video_url?: string | null;
            };
            Update: {
                category?: string | null;
                category_id?: number | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element?: string | null;
                element_id?: number | null;
                evolution_type?: string | null;
                foul_rate?: number | null;
                growth_type?: string | null;
                hash_id?: string | null;
                id?: string;
                image_url?: string | null;
                internal_code?: string | null;
                is_eldorado?: boolean | null;
                is_hyper?: boolean | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                partner_count?: number | null;
                poster_url?: string | null;
                power_max?: number | null;
                power_min?: number | null;
                recast_time?: number | null;
                sheet_data?: import("./types.gen").Json | null;
                skill_effect_bit_flag?: number | null;
                tags?: string[] | null;
                tension_cost?: number | null;
                tp_cost?: number | null;
                updated_at?: string | null;
                video_url?: string | null;
            };
            Relationships: [];
        };
        inagle_souls: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Insert: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Update: {
                asset_code?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                element_id?: number | null;
                id?: string;
                image_url?: string | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                sub_type?: string | null;
                type?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_stadiums: {
            Row: {
                condition: string | null;
                data: import("./types.gen").Json | null;
                field_index: number | null;
                id: string;
                image_path: string | null;
                updated_at: string | null;
            };
            Insert: {
                condition?: string | null;
                data?: import("./types.gen").Json | null;
                field_index?: number | null;
                id: string;
                image_path?: string | null;
                updated_at?: string | null;
            };
            Update: {
                condition?: string | null;
                data?: import("./types.gen").Json | null;
                field_index?: number | null;
                id?: string;
                image_path?: string | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        inagle_tactics: {
            Row: {
                cooldown: number | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                duration: number | null;
                effect1: string | null;
                effect2: string | null;
                effect3: string | null;
                element: string | null;
                element_id: number | null;
                id: string | null;
                image_url: string | null;
                internal_code: string | null;
                name: string;
                name_fr: string | null;
                name_ja: string | null;
                partner_count: number | null;
                partner_ids: import("./types.gen").Json | null;
                power: number | null;
                recast_time: number | null;
                shop: string | null;
            };
            Insert: {
                cooldown?: number | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                duration?: number | null;
                effect1?: string | null;
                effect2?: string | null;
                effect3?: string | null;
                element?: string | null;
                element_id?: number | null;
                id?: string | null;
                image_url?: string | null;
                internal_code?: string | null;
                name: string;
                name_fr?: string | null;
                name_ja?: string | null;
                partner_count?: number | null;
                partner_ids?: import("./types.gen").Json | null;
                power?: number | null;
                recast_time?: number | null;
                shop?: string | null;
            };
            Update: {
                cooldown?: number | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                duration?: number | null;
                effect1?: string | null;
                effect2?: string | null;
                effect3?: string | null;
                element?: string | null;
                element_id?: number | null;
                id?: string | null;
                image_url?: string | null;
                internal_code?: string | null;
                name?: string;
                name_fr?: string | null;
                name_ja?: string | null;
                partner_count?: number | null;
                partner_ids?: import("./types.gen").Json | null;
                power?: number | null;
                recast_time?: number | null;
                shop?: string | null;
            };
            Relationships: [];
        };
        inagle_teams: {
            Row: {
                country_code: string | null;
                created_at: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                emblem_url: string | null;
                emblems: import("./types.gen").Json | null;
                id: string;
                internal_code: string | null;
                kits: import("./types.gen").Json | null;
                members: import("./types.gen").Json | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                region: string | null;
                series: string | null;
                sheet_data: import("./types.gen").Json | null;
                updated_at: string | null;
            };
            Insert: {
                country_code?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                emblem_url?: string | null;
                emblems?: import("./types.gen").Json | null;
                id: string;
                internal_code?: string | null;
                kits?: import("./types.gen").Json | null;
                members?: import("./types.gen").Json | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                region?: string | null;
                series?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Update: {
                country_code?: string | null;
                created_at?: string | null;
                data?: import("./types.gen").Json | null;
                description_en?: string | null;
                description_fr?: string | null;
                description_ja?: string | null;
                emblem_url?: string | null;
                emblems?: import("./types.gen").Json | null;
                id?: string;
                internal_code?: string | null;
                kits?: import("./types.gen").Json | null;
                members?: import("./types.gen").Json | null;
                name_en?: string | null;
                name_fr?: string | null;
                name_ja?: string | null;
                region?: string | null;
                series?: string | null;
                sheet_data?: import("./types.gen").Json | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        merch_products: {
            Row: {
                created_at: string | null;
                description: string | null;
                id: string;
                image_url: string | null;
                is_active: boolean | null;
                name: string;
                price: number;
                stock: number | null;
            };
            Insert: {
                created_at?: string | null;
                description?: string | null;
                id?: string;
                image_url?: string | null;
                is_active?: boolean | null;
                name: string;
                price: number;
                stock?: number | null;
            };
            Update: {
                created_at?: string | null;
                description?: string | null;
                id?: string;
                image_url?: string | null;
                is_active?: boolean | null;
                name?: string;
                price?: number;
                stock?: number | null;
            };
            Relationships: [];
        };
        newsletter_subscriptions: {
            Row: {
                categories: string[] | null;
                created_at: string;
                email: string;
                frequency: string;
                id: string;
                is_active: boolean;
                unsubscribe_token: string;
                user_id: string | null;
            };
            Insert: {
                categories?: string[] | null;
                created_at?: string;
                email: string;
                frequency?: string;
                id?: string;
                is_active?: boolean;
                unsubscribe_token?: string;
                user_id?: string | null;
            };
            Update: {
                categories?: string[] | null;
                created_at?: string;
                email?: string;
                frequency?: string;
                id?: string;
                is_active?: boolean;
                unsubscribe_token?: string;
                user_id?: string | null;
            };
            Relationships: [];
        };
        orders: {
            Row: {
                amount_discount_cents: number;
                amount_shipping_cents: number;
                amount_subtotal_cents: number;
                amount_tax_cents: number;
                amount_total_cents: number;
                created_at: string;
                delivered_at: string | null;
                id: string;
                items: import("./types.gen").Json;
                paid_at: string | null;
                patron_discount_applied: boolean;
                promotion_code: string | null;
                refunded_at: string | null;
                shipped_at: string | null;
                shipping_address: import("./types.gen").Json | null;
                shipping_email: string | null;
                shipping_name: string | null;
                shipping_phone: string | null;
                status: string;
                stripe_customer_id: string | null;
                stripe_payment_intent_id: string | null;
                stripe_session_id: string;
                tracking_carrier: string | null;
                tracking_number: string | null;
                updated_at: string;
                user_id: string | null;
            };
            Insert: {
                amount_discount_cents?: number;
                amount_shipping_cents?: number;
                amount_subtotal_cents?: number;
                amount_tax_cents?: number;
                amount_total_cents: number;
                created_at?: string;
                delivered_at?: string | null;
                id?: string;
                items?: import("./types.gen").Json;
                paid_at?: string | null;
                patron_discount_applied?: boolean;
                promotion_code?: string | null;
                refunded_at?: string | null;
                shipped_at?: string | null;
                shipping_address?: import("./types.gen").Json | null;
                shipping_email?: string | null;
                shipping_name?: string | null;
                shipping_phone?: string | null;
                status?: string;
                stripe_customer_id?: string | null;
                stripe_payment_intent_id?: string | null;
                stripe_session_id: string;
                tracking_carrier?: string | null;
                tracking_number?: string | null;
                updated_at?: string;
                user_id?: string | null;
            };
            Update: {
                amount_discount_cents?: number;
                amount_shipping_cents?: number;
                amount_subtotal_cents?: number;
                amount_tax_cents?: number;
                amount_total_cents?: number;
                created_at?: string;
                delivered_at?: string | null;
                id?: string;
                items?: import("./types.gen").Json;
                paid_at?: string | null;
                patron_discount_applied?: boolean;
                promotion_code?: string | null;
                refunded_at?: string | null;
                shipped_at?: string | null;
                shipping_address?: import("./types.gen").Json | null;
                shipping_email?: string | null;
                shipping_name?: string | null;
                shipping_phone?: string | null;
                status?: string;
                stripe_customer_id?: string | null;
                stripe_payment_intent_id?: string | null;
                stripe_session_id?: string;
                tracking_carrier?: string | null;
                tracking_number?: string | null;
                updated_at?: string;
                user_id?: string | null;
            };
            Relationships: [{
                foreignKeyName: "orders_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        patch_notes: {
            Row: {
                content_html: string | null;
                content_html_fr: string | null;
                created_at: string | null;
                date: string;
                featured_image: string | null;
                id: string;
                platform: import("./types.gen").Json;
                title: string;
                title_fr: string | null;
                updated_at: string | null;
                url: string;
            };
            Insert: {
                content_html?: string | null;
                content_html_fr?: string | null;
                created_at?: string | null;
                date: string;
                featured_image?: string | null;
                id: string;
                platform?: import("./types.gen").Json;
                title: string;
                title_fr?: string | null;
                updated_at?: string | null;
                url: string;
            };
            Update: {
                content_html?: string | null;
                content_html_fr?: string | null;
                created_at?: string | null;
                date?: string;
                featured_image?: string | null;
                id?: string;
                platform?: import("./types.gen").Json;
                title?: string;
                title_fr?: string | null;
                updated_at?: string | null;
                url?: string;
            };
            Relationships: [];
        };
        patreon_admin_owners: {
            Row: {
                created_at: string;
                note: string | null;
                patreon_user_id: string;
            };
            Insert: {
                created_at?: string;
                note?: string | null;
                patreon_user_id: string;
            };
            Update: {
                created_at?: string;
                note?: string | null;
                patreon_user_id?: string;
            };
            Relationships: [];
        };
        patreon_legacy_members: {
            Row: {
                currently_entitled_cents: number | null;
                discord_user_id: string | null;
                email: string | null;
                full_name: string | null;
                id: string;
                imported_at: string;
                last_charge_date: string | null;
                last_charge_status: string | null;
                lifetime_support_cents: number | null;
                notification_count: number;
                notified_at: string | null;
                patreon_member_id: string;
                patreon_user_id: string;
                patron_status: string;
                pledge_cadence: number | null;
                pledge_start: string | null;
                raw_payload: import("./types.gen").Json;
                reactivated_at: string | null;
                resolution_method: string | null;
                resolved_at: string | null;
                resolved_user_id: string | null;
                rg_subscription_ref: string | null;
                rg_subscription_status: string;
                shipping_address: import("./types.gen").Json | null;
                tier_ids: string[] | null;
                tier_titles: string[] | null;
            };
            Insert: {
                currently_entitled_cents?: number | null;
                discord_user_id?: string | null;
                email?: string | null;
                full_name?: string | null;
                id?: string;
                imported_at?: string;
                last_charge_date?: string | null;
                last_charge_status?: string | null;
                lifetime_support_cents?: number | null;
                notification_count?: number;
                notified_at?: string | null;
                patreon_member_id: string;
                patreon_user_id: string;
                patron_status: string;
                pledge_cadence?: number | null;
                pledge_start?: string | null;
                raw_payload: import("./types.gen").Json;
                reactivated_at?: string | null;
                resolution_method?: string | null;
                resolved_at?: string | null;
                resolved_user_id?: string | null;
                rg_subscription_ref?: string | null;
                rg_subscription_status?: string;
                shipping_address?: import("./types.gen").Json | null;
                tier_ids?: string[] | null;
                tier_titles?: string[] | null;
            };
            Update: {
                currently_entitled_cents?: number | null;
                discord_user_id?: string | null;
                email?: string | null;
                full_name?: string | null;
                id?: string;
                imported_at?: string;
                last_charge_date?: string | null;
                last_charge_status?: string | null;
                lifetime_support_cents?: number | null;
                notification_count?: number;
                notified_at?: string | null;
                patreon_member_id?: string;
                patreon_user_id?: string;
                patron_status?: string;
                pledge_cadence?: number | null;
                pledge_start?: string | null;
                raw_payload?: import("./types.gen").Json;
                reactivated_at?: string | null;
                resolution_method?: string | null;
                resolved_at?: string | null;
                resolved_user_id?: string | null;
                rg_subscription_ref?: string | null;
                rg_subscription_status?: string;
                shipping_address?: import("./types.gen").Json | null;
                tier_ids?: string[] | null;
                tier_titles?: string[] | null;
            };
            Relationships: [];
        };
        patreon_legacy_tiers: {
            Row: {
                amount_cents: number;
                description: string | null;
                discord_role_ids: string[] | null;
                imported_at: string;
                patreon_tier_id: string;
                patron_count: number | null;
                published: boolean | null;
                rg_plan_name: string | null;
                rg_price_id: string | null;
                title: string;
                updated_at: string;
            };
            Insert: {
                amount_cents: number;
                description?: string | null;
                discord_role_ids?: string[] | null;
                imported_at?: string;
                patreon_tier_id: string;
                patron_count?: number | null;
                published?: boolean | null;
                rg_plan_name?: string | null;
                rg_price_id?: string | null;
                title: string;
                updated_at?: string;
            };
            Update: {
                amount_cents?: number;
                description?: string | null;
                discord_role_ids?: string[] | null;
                imported_at?: string;
                patreon_tier_id?: string;
                patron_count?: number | null;
                published?: boolean | null;
                rg_plan_name?: string | null;
                rg_price_id?: string | null;
                title?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        patreon_memberships: {
            Row: {
                address: import("./types.gen").Json | null;
                campaign_id: string | null;
                created_at: string;
                currently_entitled_cents: number | null;
                discord_role_ids: string[];
                discord_user_id: string | null;
                fetched_at: string;
                id: string;
                is_free_trial: boolean | null;
                is_gifted: boolean | null;
                last_charge_date: string | null;
                last_charge_status: string | null;
                lifetime_support_cents: number | null;
                member_email: string | null;
                next_charge_date: string | null;
                note: string | null;
                patreon_email: string | null;
                patreon_full_name: string | null;
                patreon_member_id: string | null;
                patreon_thumb_url: string | null;
                patreon_url: string | null;
                patreon_user_id: string;
                patron_status: string | null;
                pledge_cadence: number | null;
                pledge_start: string | null;
                raw_identity: import("./types.gen").Json | null;
                scope: string | null;
                tier_amounts_cents: number[];
                tier_ids: string[];
                tier_requires_shipping: boolean[];
                tier_titles: string[];
                updated_at: string;
                user_id: string;
                will_pay_amount_cents: number | null;
            };
            Insert: {
                address?: import("./types.gen").Json | null;
                campaign_id?: string | null;
                created_at?: string;
                currently_entitled_cents?: number | null;
                discord_role_ids?: string[];
                discord_user_id?: string | null;
                fetched_at?: string;
                id?: string;
                is_free_trial?: boolean | null;
                is_gifted?: boolean | null;
                last_charge_date?: string | null;
                last_charge_status?: string | null;
                lifetime_support_cents?: number | null;
                member_email?: string | null;
                next_charge_date?: string | null;
                note?: string | null;
                patreon_email?: string | null;
                patreon_full_name?: string | null;
                patreon_member_id?: string | null;
                patreon_thumb_url?: string | null;
                patreon_url?: string | null;
                patreon_user_id: string;
                patron_status?: string | null;
                pledge_cadence?: number | null;
                pledge_start?: string | null;
                raw_identity?: import("./types.gen").Json | null;
                scope?: string | null;
                tier_amounts_cents?: number[];
                tier_ids?: string[];
                tier_requires_shipping?: boolean[];
                tier_titles?: string[];
                updated_at?: string;
                user_id: string;
                will_pay_amount_cents?: number | null;
            };
            Update: {
                address?: import("./types.gen").Json | null;
                campaign_id?: string | null;
                created_at?: string;
                currently_entitled_cents?: number | null;
                discord_role_ids?: string[];
                discord_user_id?: string | null;
                fetched_at?: string;
                id?: string;
                is_free_trial?: boolean | null;
                is_gifted?: boolean | null;
                last_charge_date?: string | null;
                last_charge_status?: string | null;
                lifetime_support_cents?: number | null;
                member_email?: string | null;
                next_charge_date?: string | null;
                note?: string | null;
                patreon_email?: string | null;
                patreon_full_name?: string | null;
                patreon_member_id?: string | null;
                patreon_thumb_url?: string | null;
                patreon_url?: string | null;
                patreon_user_id?: string;
                patron_status?: string | null;
                pledge_cadence?: number | null;
                pledge_start?: string | null;
                raw_identity?: import("./types.gen").Json | null;
                scope?: string | null;
                tier_amounts_cents?: number[];
                tier_ids?: string[];
                tier_requires_shipping?: boolean[];
                tier_titles?: string[];
                updated_at?: string;
                user_id?: string;
                will_pay_amount_cents?: number | null;
            };
            Relationships: [];
        };
        patreon_oauth_tokens: {
            Row: {
                access_token_enc: string;
                created_at: string;
                expires_at: string;
                id: string;
                is_creator: boolean;
                patreon_user_id: string;
                refresh_token_enc: string;
                scope: string;
                updated_at: string;
                user_id: string | null;
            };
            Insert: {
                access_token_enc: string;
                created_at?: string;
                expires_at: string;
                id?: string;
                is_creator?: boolean;
                patreon_user_id: string;
                refresh_token_enc: string;
                scope: string;
                updated_at?: string;
                user_id?: string | null;
            };
            Update: {
                access_token_enc?: string;
                created_at?: string;
                expires_at?: string;
                id?: string;
                is_creator?: boolean;
                patreon_user_id?: string;
                refresh_token_enc?: string;
                scope?: string;
                updated_at?: string;
                user_id?: string | null;
            };
            Relationships: [];
        };
        patreon_post_events: {
            Row: {
                campaign_id: string | null;
                content_excerpt: string | null;
                created_at: string;
                embed_data: import("./types.gen").Json | null;
                embed_url: string | null;
                is_paid: boolean | null;
                is_public: boolean | null;
                patreon_post_id: string;
                published_at: string | null;
                raw_payload: import("./types.gen").Json;
                title: string | null;
                trigger: string;
                updated_at: string;
                url: string | null;
            };
            Insert: {
                campaign_id?: string | null;
                content_excerpt?: string | null;
                created_at?: string;
                embed_data?: import("./types.gen").Json | null;
                embed_url?: string | null;
                is_paid?: boolean | null;
                is_public?: boolean | null;
                patreon_post_id: string;
                published_at?: string | null;
                raw_payload: import("./types.gen").Json;
                title?: string | null;
                trigger: string;
                updated_at?: string;
                url?: string | null;
            };
            Update: {
                campaign_id?: string | null;
                content_excerpt?: string | null;
                created_at?: string;
                embed_data?: import("./types.gen").Json | null;
                embed_url?: string | null;
                is_paid?: boolean | null;
                is_public?: boolean | null;
                patreon_post_id?: string;
                published_at?: string | null;
                raw_payload?: import("./types.gen").Json;
                title?: string | null;
                trigger?: string;
                updated_at?: string;
                url?: string | null;
            };
            Relationships: [];
        };
        patreon_post_images: {
            Row: {
                content_type: string | null;
                created_at: string;
                id: number;
                original_url: string;
                patreon_post_id: string;
                position: number;
                sha256: string;
                size_bytes: number | null;
                storage_path: string;
            };
            Insert: {
                content_type?: string | null;
                created_at?: string;
                id?: never;
                original_url: string;
                patreon_post_id: string;
                position?: number;
                sha256: string;
                size_bytes?: number | null;
                storage_path: string;
            };
            Update: {
                content_type?: string | null;
                created_at?: string;
                id?: never;
                original_url?: string;
                patreon_post_id?: string;
                position?: number;
                sha256?: string;
                size_bytes?: number | null;
                storage_path?: string;
            };
            Relationships: [{
                foreignKeyName: "patreon_post_images_patreon_post_id_fkey";
                columns: ["patreon_post_id"];
                isOneToOne: false;
                referencedRelation: "patreon_post_events";
                referencedColumns: ["patreon_post_id"];
            }];
        };
        patreon_webhook_events: {
            Row: {
                error: string | null;
                id: string;
                payload: import("./types.gen").Json;
                processed_at: string | null;
                received_at: string;
                signature_valid: boolean;
                status: string;
                trigger: string;
            };
            Insert: {
                error?: string | null;
                id: string;
                payload: import("./types.gen").Json;
                processed_at?: string | null;
                received_at?: string;
                signature_valid: boolean;
                status?: string;
                trigger: string;
            };
            Update: {
                error?: string | null;
                id?: string;
                payload?: import("./types.gen").Json;
                processed_at?: string | null;
                received_at?: string;
                signature_valid?: boolean;
                status?: string;
                trigger?: string;
            };
            Relationships: [];
        };
        patreon_webhook_state: {
            Row: {
                id: number;
                last_attempted_at: string | null;
                last_event_id: string | null;
                last_received_at: string | null;
                last_trigger: string | null;
                num_consecutive_times_failed: number | null;
                patreon_webhook_id: string | null;
                paused: boolean | null;
                total_failed: number;
                total_received: number;
                triggers: string[];
                updated_at: string;
                uri: string;
            };
            Insert: {
                id?: number;
                last_attempted_at?: string | null;
                last_event_id?: string | null;
                last_received_at?: string | null;
                last_trigger?: string | null;
                num_consecutive_times_failed?: number | null;
                patreon_webhook_id?: string | null;
                paused?: boolean | null;
                total_failed?: number;
                total_received?: number;
                triggers?: string[];
                updated_at?: string;
                uri?: string;
            };
            Update: {
                id?: number;
                last_attempted_at?: string | null;
                last_event_id?: string | null;
                last_received_at?: string | null;
                last_trigger?: string | null;
                num_consecutive_times_failed?: number | null;
                patreon_webhook_id?: string | null;
                paused?: boolean | null;
                total_failed?: number;
                total_received?: number;
                triggers?: string[];
                updated_at?: string;
                uri?: string;
            };
            Relationships: [];
        };
        profiles: {
            Row: {
                address_line1: string | null;
                address_line2: string | null;
                avatar_url: string | null;
                badges: string[] | null;
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
                badges?: string[] | null;
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
                badges?: string[] | null;
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
        rate_limits: {
            Row: {
                count: number | null;
                key: string;
                last_request: string;
            };
            Insert: {
                count?: number | null;
                key: string;
                last_request?: string;
            };
            Update: {
                count?: number | null;
                key?: string;
                last_request?: string;
            };
            Relationships: [];
        };
        reading_history: {
            Row: {
                article_id: string;
                id: string;
                last_read_at: string;
                progress: number;
                read_count: number;
                user_id: string;
            };
            Insert: {
                article_id: string;
                id?: string;
                last_read_at?: string;
                progress?: number;
                read_count?: number;
                user_id: string;
            };
            Update: {
                article_id?: string;
                id?: string;
                last_read_at?: string;
                progress?: number;
                read_count?: number;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "reading_history_article_id_fkey";
                columns: ["article_id"];
                isOneToOne: false;
                referencedRelation: "articles";
                referencedColumns: ["id"];
            }];
        };
        session: {
            Row: {
                created_at: string;
                expires_at: string;
                id: string;
                ip_address: string | null;
                token: string;
                updated_at: string;
                user_agent: string | null;
                user_id: string;
            };
            Insert: {
                created_at?: string;
                expires_at: string;
                id: string;
                ip_address?: string | null;
                token: string;
                updated_at?: string;
                user_agent?: string | null;
                user_id: string;
            };
            Update: {
                created_at?: string;
                expires_at?: string;
                id?: string;
                ip_address?: string | null;
                token?: string;
                updated_at?: string;
                user_agent?: string | null;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "session_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "user";
                referencedColumns: ["id"];
            }];
        };
        settings: {
            Row: {
                description: string | null;
                key: string;
                updated_at: string;
                value: import("./types.gen").Json;
            };
            Insert: {
                description?: string | null;
                key: string;
                updated_at?: string;
                value: import("./types.gen").Json;
            };
            Update: {
                description?: string | null;
                key?: string;
                updated_at?: string;
                value?: import("./types.gen").Json;
            };
            Relationships: [];
        };
        share_tracking: {
            Row: {
                article_id: string;
                created_at: string;
                id: string;
                platform: string;
                user_id: string | null;
            };
            Insert: {
                article_id: string;
                created_at?: string;
                id?: string;
                platform: string;
                user_id?: string | null;
            };
            Update: {
                article_id?: string;
                created_at?: string;
                id?: string;
                platform?: string;
                user_id?: string | null;
            };
            Relationships: [{
                foreignKeyName: "share_tracking_article_id_fkey";
                columns: ["article_id"];
                isOneToOne: false;
                referencedRelation: "articles";
                referencedColumns: ["id"];
            }];
        };
        stream_schedules: {
            Row: {
                category: string | null;
                created_at: string;
                day_of_week: number;
                end_time: string | null;
                id: string;
                notes: string | null;
                start_time: string | null;
                status: string | null;
                streamer_name: string;
                updated_at: string;
            };
            Insert: {
                category?: string | null;
                created_at?: string;
                day_of_week: number;
                end_time?: string | null;
                id?: string;
                notes?: string | null;
                start_time?: string | null;
                status?: string | null;
                streamer_name: string;
                updated_at?: string;
            };
            Update: {
                category?: string | null;
                created_at?: string;
                day_of_week?: number;
                end_time?: string | null;
                id?: string;
                notes?: string | null;
                start_time?: string | null;
                status?: string | null;
                streamer_name?: string;
                updated_at?: string;
            };
            Relationships: [];
        };
        team_members: {
            Row: {
                created_at: string;
                discord_user_id: string | null;
                display_index: number | null;
                id: string;
                image_url: string | null;
                is_active: boolean | null;
                member_link: string | null;
                name: string;
                order_index: number | null;
                role: string;
                source: string | null;
                team_id: string;
                team_name: string | null;
                updated_at: string;
            };
            Insert: {
                created_at?: string;
                discord_user_id?: string | null;
                display_index?: number | null;
                id?: string;
                image_url?: string | null;
                is_active?: boolean | null;
                member_link?: string | null;
                name: string;
                order_index?: number | null;
                role: string;
                source?: string | null;
                team_id: string;
                team_name?: string | null;
                updated_at?: string;
            };
            Update: {
                created_at?: string;
                discord_user_id?: string | null;
                display_index?: number | null;
                id?: string;
                image_url?: string | null;
                is_active?: boolean | null;
                member_link?: string | null;
                name?: string;
                order_index?: number | null;
                role?: string;
                source?: string | null;
                team_id?: string;
                team_name?: string | null;
                updated_at?: string;
            };
            Relationships: [];
        };
        topics: {
            Row: {
                category: string | null;
                content_html: string | null;
                created_at: string | null;
                date: string;
                id: string;
                images: import("./types.gen").Json | null;
                thumbnail: string | null;
                title: string;
                updated_at: string | null;
                url: string;
            };
            Insert: {
                category?: string | null;
                content_html?: string | null;
                created_at?: string | null;
                date: string;
                id: string;
                images?: import("./types.gen").Json | null;
                thumbnail?: string | null;
                title: string;
                updated_at?: string | null;
                url: string;
            };
            Update: {
                category?: string | null;
                content_html?: string | null;
                created_at?: string | null;
                date?: string;
                id?: string;
                images?: import("./types.gen").Json | null;
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
                category: string | null;
                created_at: string | null;
                id: string;
                is_thread: boolean | null;
                media: import("./types.gen").Json | null;
                metrics: import("./types.gen").Json | null;
                quoted_tweets: import("./types.gen").Json | null;
                raw_tweets: import("./types.gen").Json | null;
                text: string | null;
                translation: string | null;
                tweet_count: number | null;
                updated_at: string | null;
            };
            Insert: {
                author_id?: string | null;
                author_name?: string | null;
                author_username?: string | null;
                category?: string | null;
                created_at?: string | null;
                id: string;
                is_thread?: boolean | null;
                media?: import("./types.gen").Json | null;
                metrics?: import("./types.gen").Json | null;
                quoted_tweets?: import("./types.gen").Json | null;
                raw_tweets?: import("./types.gen").Json | null;
                text?: string | null;
                translation?: string | null;
                tweet_count?: number | null;
                updated_at?: string | null;
            };
            Update: {
                author_id?: string | null;
                author_name?: string | null;
                author_username?: string | null;
                category?: string | null;
                created_at?: string | null;
                id?: string;
                is_thread?: boolean | null;
                media?: import("./types.gen").Json | null;
                metrics?: import("./types.gen").Json | null;
                quoted_tweets?: import("./types.gen").Json | null;
                raw_tweets?: import("./types.gen").Json | null;
                text?: string | null;
                translation?: string | null;
                tweet_count?: number | null;
                updated_at?: string | null;
            };
            Relationships: [];
        };
        user: {
            Row: {
                created_at: string;
                email: string;
                email_verified: boolean;
                id: string;
                image: string | null;
                name: string;
                two_factor_backup_codes: string | null;
                two_factor_enabled: boolean;
                two_factor_secret: string | null;
                updated_at: string;
            };
            Insert: {
                created_at?: string;
                email: string;
                email_verified?: boolean;
                id: string;
                image?: string | null;
                name: string;
                two_factor_backup_codes?: string | null;
                two_factor_enabled?: boolean;
                two_factor_secret?: string | null;
                updated_at?: string;
            };
            Update: {
                created_at?: string;
                email?: string;
                email_verified?: boolean;
                id?: string;
                image?: string | null;
                name?: string;
                two_factor_backup_codes?: string | null;
                two_factor_enabled?: boolean;
                two_factor_secret?: string | null;
                updated_at?: string;
            };
            Relationships: [];
        };
        user_preferences: {
            Row: {
                email_notifications: boolean;
                font_size: string;
                preferred_categories: string[] | null;
                push_notifications: boolean;
                reading_mode: boolean;
                reduced_motion: boolean;
                updated_at: string;
                user_id: string;
            };
            Insert: {
                email_notifications?: boolean;
                font_size?: string;
                preferred_categories?: string[] | null;
                push_notifications?: boolean;
                reading_mode?: boolean;
                reduced_motion?: boolean;
                updated_at?: string;
                user_id: string;
            };
            Update: {
                email_notifications?: boolean;
                font_size?: string;
                preferred_categories?: string[] | null;
                push_notifications?: boolean;
                reading_mode?: boolean;
                reduced_motion?: boolean;
                updated_at?: string;
                user_id?: string;
            };
            Relationships: [];
        };
        user_teams: {
            Row: {
                created_at: string;
                formation_data: import("./types.gen").Json;
                formation_id: string;
                id: string;
                is_public: boolean | null;
                name: string;
                updated_at: string;
                user_id: string;
            };
            Insert: {
                created_at?: string;
                formation_data?: import("./types.gen").Json;
                formation_id: string;
                id?: string;
                is_public?: boolean | null;
                name: string;
                updated_at?: string;
                user_id: string;
            };
            Update: {
                created_at?: string;
                formation_data?: import("./types.gen").Json;
                formation_id?: string;
                id?: string;
                is_public?: boolean | null;
                name?: string;
                updated_at?: string;
                user_id?: string;
            };
            Relationships: [{
                foreignKeyName: "user_teams_user_id_fkey";
                columns: ["user_id"];
                isOneToOne: false;
                referencedRelation: "profiles";
                referencedColumns: ["id"];
            }];
        };
        verification: {
            Row: {
                created_at: string | null;
                expires_at: string;
                id: string;
                identifier: string;
                updated_at: string | null;
                value: string;
            };
            Insert: {
                created_at?: string | null;
                expires_at: string;
                id: string;
                identifier: string;
                updated_at?: string | null;
                value: string;
            };
            Update: {
                created_at?: string | null;
                expires_at?: string;
                id?: string;
                identifier?: string;
                updated_at?: string | null;
                value?: string;
            };
            Relationships: [];
        };
        wiki_overrides: {
            Row: {
                created_at: string | null;
                entity_id: string;
                entity_type: string;
                field_path: string;
                id: string;
                value: import("./types.gen").Json;
            };
            Insert: {
                created_at?: string | null;
                entity_id: string;
                entity_type: string;
                field_path: string;
                id?: string;
                value: import("./types.gen").Json;
            };
            Update: {
                created_at?: string | null;
                entity_id?: string;
                entity_type?: string;
                field_path?: string;
                id?: string;
                value?: import("./types.gen").Json;
            };
            Relationships: [];
        };
    };
    Views: {
        content_feed: {
            Row: {
                author_id: string | null;
                category: string | null;
                created_at: string | null;
                date: string | null;
                excerpt: string | null;
                id: string | null;
                image: string | null;
                slug: string | null;
                title: string | null;
                type: string | null;
            };
            Relationships: [];
        };
        inagle_awakenings_clean: {
            Row: {
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                id: string | null;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                type: string | null;
                updated_at: string | null;
            };
            Relationships: [];
        };
        inagle_keshins_clean: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                id: string | null;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Relationships: [];
        };
        inagle_miximax_clean: {
            Row: {
                asset_code: string | null;
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                element_id: number | null;
                icon_code: string | null;
                id: string | null;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                sub_type: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Relationships: [];
        };
        inagle_mode_changes_clean: {
            Row: {
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                id: string | null;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                type: string | null;
                updated_at: string | null;
            };
            Relationships: [];
        };
        inagle_souls_clean: {
            Row: {
                data: import("./types.gen").Json | null;
                description_en: string | null;
                description_fr: string | null;
                description_ja: string | null;
                id: string | null;
                image_url: string | null;
                name_en: string | null;
                name_fr: string | null;
                name_ja: string | null;
                sheet_data: import("./types.gen").Json | null;
                type: string | null;
                updated_at: string | null;
            };
            Relationships: [];
        };
    };
    Functions: {
        check_rate_limit: {
            Args: {
                p_action: string;
                p_max_count?: number;
                p_user_id: string;
                p_window_minutes?: number;
            };
            Returns: boolean;
        };
        generate_article_slug: {
            Args: {
                title: string;
            };
            Returns: string;
        };
        get_comment_counts: {
            Args: {
                article_ids: string[];
            };
            Returns: {
                article_id: string;
                count: number;
            }[];
        };
        get_my_patreon_status: {
            Args: never;
            Returns: {
                currently_entitled_cents: number;
                discount_percent: number;
                is_active: boolean;
                is_free_trial: boolean;
                is_gifted: boolean;
                next_charge_date: string;
                status: string;
                tier_titles: string[];
            }[];
        };
        get_share_counts: {
            Args: {
                p_article_ids: string[];
            };
            Returns: {
                article_id: string;
                by_platform: import("./types.gen").Json;
                total: number;
            }[];
        };
        get_trending_articles: {
            Args: {
                days_window?: number;
                result_limit?: number;
            };
            Returns: {
                category: string;
                excerpt: string;
                featured_image_url: string;
                id: string;
                published_at: string;
                slug: string;
                title: string;
                trending_score: number;
                view_count: number;
            }[];
        };
        increment_article_views: {
            Args: {
                article_id: string;
            };
            Returns: undefined;
        };
        increment_share_count: {
            Args: {
                p_article_id: string;
                p_platform: string;
            };
            Returns: undefined;
        };
        is_active_patron: {
            Args: {
                uid: string;
            };
            Returns: boolean;
        };
        is_admin: {
            Args: never;
            Returns: boolean;
        };
        patreon_heartbeat: {
            Args: {
                p_event_id: string;
                p_success: boolean;
                p_trigger: string;
            };
            Returns: undefined;
        };
        show_limit: {
            Args: never;
            Returns: number;
        };
        show_trgm: {
            Args: {
                "": string;
            };
            Returns: string[];
        };
        upsert_reading_progress: {
            Args: {
                p_article_id: string;
                p_progress: number;
                p_user_id: string;
            };
            Returns: undefined;
        };
    };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
}, {
    PostgrestVersion: "14.5";
}>;
