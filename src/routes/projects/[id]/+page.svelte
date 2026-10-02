<script lang="ts">
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	let { data, form } = $props();
	let localEditingNoteId = $state<number | null | undefined>(undefined);
	let editingNoteId = $derived(localEditingNoteId ?? (form?.noteId ? Number(form.noteId) : null));
</script>

<svelte:head>
	<title>{data.project.project_name} - Recorder</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main>
	<a href="/">← Back to projects</a>
	<header class="project-heading">
		<div>
			<h1>{data.project.client_name} — {data.project.project_name}</h1>
			<p class="metadata">
				Created <time datetime={data.project.created_at}>{new Date(data.project.created_at).toLocaleString()}</time>
				<span aria-hidden="true"> · </span>
				Updated <time datetime={data.project.updated_at}>{new Date(data.project.updated_at).toLocaleString()}</time>
			</p>
		</div>
	</header>

	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	<section class="project-section" aria-labelledby="project-details-heading">
		<h2 id="project-details-heading">Project details</h2>
		<form method="POST" action="?/update">
			<label>Client <input name="clientName" required maxlength="200" value={data.project.client_name} /></label>
			<label>Project <input name="projectName" required maxlength="200" value={data.project.project_name} /></label>
			<label>Status
				<select name="status" value={data.project.status}>
					<option value="open">Open</option><option value="suspended">Suspended</option><option value="closed">Closed</option>
				</select>
			</label>
			<label>Contacts <textarea name="contacts" maxlength="4000">{data.project.contacts ?? ''}</textarea></label>
			<label>Tags (comma separated) <input name="tags" list="tag-suggestions" value={data.project.tags.join(', ')} /></label>
			<datalist id="tag-suggestions">{#each data.suggestions as tag}<option value={tag}></option>{/each}</datalist>
			<button>Save changes</button>
		</form>
		<form method="POST" action="?/delete" onsubmit={(event) => { if (!confirm('Delete this project and its notes?')) event.preventDefault(); }}>
			<button class="danger">Delete project</button>
		</form>
	</section>

	<section id="notes" class="notes-section" aria-labelledby="notes-heading">
		<div class="section-heading">
			<h2 id="notes-heading">Notes</h2>
			{#if data.notes.length}<span>{data.notes.length} {data.notes.length === 1 ? 'note' : 'notes'}</span>{/if}
		</div>
		{#if data.noteStatus === 'created'}<p class="success" role="status">Note saved.</p>
		{:else if data.noteStatus === 'updated'}<p class="success" role="status">Note updated.</p>
		{:else if data.noteStatus === 'deleted'}<p class="success" role="status">Note deleted.</p>{/if}
		{#if form?.noteMessage}<p class="error" role="alert">{form.noteMessage}</p>{/if}

		{#if data.notes.length === 0}<p class="empty-state">No notes yet. Add the first update for this project.</p>{/if}
		{#each data.notes as note (note.id)}
			<article class="note-card" id={`note-${note.id}`}>
				<header class="note-header">
					<p class="note-date">
						<time datetime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time>
						{#if note.updated_at !== note.created_at}<span> · edited {new Date(note.updated_at).toLocaleString()}</span>{/if}
					</p>
					{#if editingNoteId !== note.id}
						<button type="button" class="quiet" onclick={() => localEditingNoteId = note.id}>Edit note</button>
					{/if}
				</header>
				{#if editingNoteId === note.id}
					<form method="POST" action="?/noteUpdate" class="note-form">
						<input type="hidden" name="noteId" value={note.id} />
						<NoteEditor initialHtml={form?.noteId && Number(form.noteId) === note.id ? form.noteBody ?? '' : note.body} label="Edit note content" />
						<div class="actions">
							<button>Save note</button>
							<button type="button" class="quiet" onclick={() => localEditingNoteId = null}>Cancel</button>
						</div>
					</form>
				{:else}
					<div class="note-body">{@html note.body}</div>
					<form method="POST" action="?/noteDelete" onsubmit={(event) => { if (!confirm('Delete this note?')) event.preventDefault(); }}>
						<input type="hidden" name="noteId" value={note.id} />
						<button class="quiet danger-text">Delete note</button>
					</form>
				{/if}
			</article>
		{/each}

		<form method="POST" action="?/noteCreate" class="note-form new-note-form">
			<h3>Add a note</h3>
			<NoteEditor initialHtml={form?.noteId ? '' : form?.noteBody ?? ''} label="New note content" />
			<button>Save note</button>
		</form>
	</section>
</main>

<style>
	:global(*) { box-sizing: border-box; }
	main { width: min(100% - 2rem, 58rem); margin: 1.5rem auto 4rem; font: 1rem/1.55 system-ui, sans-serif; color: #17212b; }
	h1, h2, h3, p { overflow-wrap: anywhere; }
	h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); line-height: 1.2; margin-block: .8rem; }
	h2 { font-size: 1.3rem; margin-block: 0 .8rem; }
	h3 { margin: 0; font-size: 1.1rem; }
	.project-heading { margin-block: .5rem 1.25rem; }
	.metadata, .note-date { color: #4b5563; font-size: .92rem; }
	.project-section, .notes-section { border: 1px solid #d1d5db; border-radius: .65rem; padding: clamp(.9rem, 3vw, 1.4rem); margin-block: 1rem; min-width: 0; }
	form { display: grid; gap: .8rem; margin-block: 1rem; min-width: 0; }
	label { display: grid; gap: .25rem; font-weight: 600; }
	input, select, textarea, button { max-width: 100%; font: inherit; }
	input, select, textarea { min-width: 0; width: 100%; padding: .55rem .65rem; border: 1px solid #737b84; border-radius: .25rem; }
	textarea { min-height: 5rem; resize: vertical; }
	button { min-height: 2.75rem; padding: .45rem .85rem; border: 1px solid #46515e; border-radius: .3rem; color: #142235; background: #f8fafc; cursor: pointer; }
	button:hover { background: #eaf0f6; }
	:global(button:focus-visible), :global(a:focus-visible), input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
	.section-heading, .note-header, .actions { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
	.section-heading > span { color: #4b5563; font-size: .92rem; }
	.note-card { min-width: 0; border-top: 1px solid #d1d5db; padding-block: 1rem; }
	.note-header { align-items: flex-start; }
	.note-date { margin: 0; }
	.note-body { min-width: 0; overflow-wrap: anywhere; }
	.note-body :global(p:first-child) { margin-top: .5rem; }
	.note-body :global(p:last-child) { margin-bottom: .5rem; }
	.note-body :global(ul), .note-body :global(ol) { padding-inline-start: 1.5rem; }
	.note-form { border-top: 1px solid #d1d5db; padding-top: 1rem; }
	.new-note-form { margin-top: 1.5rem; }
	.empty-state { color: #4b5563; padding-block: .6rem; }
	.error { color: #9b1c1c; background: #fff5f5; border-left: .25rem solid #b91c1c; padding: .65rem .8rem; }
	.success { color: #14532d; background: #f0fdf4; border-left: .25rem solid #15803d; padding: .65rem .8rem; }
	.quiet { background: white; }
	.danger, .danger-text { color: #9b1c1c; }
	@media (max-width: 36rem) {
		main { width: min(100% - 1rem, 58rem); margin-top: .75rem; }
		.note-header { align-items: stretch; }
		.note-header > button, .actions > button { flex: 1 1 auto; }
	}
</style>
