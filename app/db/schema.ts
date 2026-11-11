import {bigint, boolean, integer, serial, snakeCase, varchar} from "drizzle-orm/pg-core";

export const userTable = snakeCase.table("users", {
    id: serial().primaryKey(),
    pseudo: varchar().notNull().unique(),
    password: varchar().notNull(),
    ip: varchar().notNull().unique(),
    githubAppId: integer(),
    githubAccount: varchar(),
    sessionKey: varchar().notNull().unique(),
    sessionKeyCreation: bigint({ mode: 'number' }).notNull(),
    projects: integer().array().notNull().default([]),
    accountCreation: bigint({ mode: 'number' }).notNull()
});

export const projectTable = snakeCase.table("projects", {
    id: serial().primaryKey(),
    name: varchar().notNull(),
    description: varchar(),
    targetOwner: varchar().notNull(),
    targetRepo: varchar().notNull(),
    owner: integer().notNull(),
    admins: integer().array().notNull().default([]),
    contributors: integer().array().notNull().default([]),
    isPublic: boolean().notNull(),
    defaultLanguage: varchar().notNull().default("en"),
    locale: varchar().notNull().array().default([]),
    translationBranch: varchar(),
    draftBranch: varchar(),
    translationNames: varchar().array().notNull().default([]),
    translationSources: varchar().array().notNull().default([]),
    translationTargets: varchar().array().notNull().default([]),
    projectCreation: bigint({ mode: 'number' }).notNull()
});

export const inviteTokenTable = snakeCase.table("inviteTokens", {
    id: serial().primaryKey(),
    name: varchar().notNull().unique(),
    linksTo: integer().notNull(),
    admin: boolean().notNull(),
    expireDate: bigint({ mode: 'number' }).notNull(),
    leftUses: integer().notNull()
});