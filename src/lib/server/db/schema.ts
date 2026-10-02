import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable(
	'projects',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		clientName: text('client_name').notNull(),
		projectName: text('project_name').notNull(),
		status: text('status', { enum: ['open', 'suspended', 'closed'] }).notNull().default('open'),
		contacts: text('contacts'),
		createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
		updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
	},
	(table) => [
		unique('projects_client_project_unique').on(table.clientName, table.projectName),
		check('projects_status_check', sql`${table.status} in ('open', 'suspended', 'closed')`)
	]
);
export const notes = sqliteTable(
	'notes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
		updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
	},
	(table) => [index('notes_project_created_idx').on(table.projectId, table.createdAt)]
);

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique()
});

export const projectTags = sqliteTable(
	'project_tags',
	{
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' })
	},
	(table) => [unique('project_tags_project_tag_unique').on(table.projectId, table.tagId)]
);
