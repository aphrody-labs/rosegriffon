-- Better Auth 1.7 oauth-provider: resources, client assertions, DPoP, rotation replay.
-- Colonnes héritées que le plugin n'écrit plus : rendues optionnelles.

alter table "oauthClient" add column if not exists "clientDiscoveryId" text;

alter table "oauthClient" add column if not exists "clientCredentialsScopes" jsonb;

alter table "oauthClient" add column if not exists "backchannelLogoutUri" text;

alter table "oauthClient" add column if not exists "backchannelLogoutSessionRequired" boolean;

alter table "oauthClient" add column if not exists "applicationType" text;

alter table "oauthClient" add column if not exists "jwks" text;

alter table "oauthClient" add column if not exists "jwksUri" text;

alter table "oauthClient" add column if not exists "dpopBoundAccessTokens" boolean default false;

alter table "oauthRefreshToken" add column if not exists "authorizationCodeId" text;

alter table "oauthRefreshToken" add column if not exists "resources" jsonb;

alter table "oauthRefreshToken" add column if not exists "requestedUserInfoClaims" jsonb;

alter table "oauthRefreshToken" add column if not exists "rotatedAt" timestamptz;

alter table "oauthRefreshToken" add column if not exists "rotationReplayResponse" text;

alter table "oauthRefreshToken" add column if not exists "rotationReplayExpiresAt" timestamptz;

alter table "oauthRefreshToken" add column if not exists "confirmation" jsonb;

alter table "oauthAccessToken" add column if not exists "authorizationCodeId" text;

alter table "oauthAccessToken" add column if not exists "resources" jsonb;

alter table "oauthAccessToken" add column if not exists "requestedUserInfoClaims" jsonb;

alter table "oauthAccessToken" add column if not exists "revoked" timestamptz;

alter table "oauthAccessToken" add column if not exists "confirmation" jsonb;

alter table "oauthConsent" add column if not exists "resources" jsonb;

alter table "oauthConsent" add column if not exists "requestedUserInfoClaims" jsonb;

create table if not exists "oauthResource" ("id" text not null primary key, "identifier" text not null unique, "name" text not null, "accessTokenTtl" integer, "refreshTokenTtl" integer, "signingAlgorithm" text, "signingKeyId" text, "allowedScopes" jsonb, "customClaims" jsonb, "dpopBoundAccessTokensRequired" boolean, "disabled" boolean, "createdAt" timestamptz, "updatedAt" timestamptz, "policyVersion" integer, "metadata" jsonb);

create table if not exists "oauthClientResource" ("id" text not null primary key, "clientId" text not null references "oauthClient" ("clientId") on delete cascade, "resourceId" text not null references "oauthResource" ("identifier") on delete cascade, "metadata" jsonb, "createdAt" timestamptz);

create table if not exists "oauthClientAssertion" ("id" text not null primary key, "expiresAt" timestamptz not null);

create index if not exists "oauthRefreshToken_authorizationCodeId_idx" on "oauthRefreshToken" ("authorizationCodeId");

create index if not exists "oauthAccessToken_authorizationCodeId_idx" on "oauthAccessToken" ("authorizationCodeId");

create index if not exists "oauthClientResource_clientId_idx" on "oauthClientResource" ("clientId");

create index if not exists "oauthClientResource_resourceId_idx" on "oauthClientResource" ("resourceId");

create unique index if not exists "oauthClientResource_clientId_resourceId_uidx" on "oauthClientResource" ("clientId", "resourceId");

alter table public."oauthAccessToken" alter column "accessToken" drop not null, alter column "refreshToken" drop not null, alter column "accessTokenExpiresAt" drop not null, alter column "refreshTokenExpiresAt" drop not null, alter column "updatedAt" drop not null;
alter table public."oauthConsent" alter column "consentGiven" drop not null;
