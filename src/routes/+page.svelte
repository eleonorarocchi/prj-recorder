<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Projects · Recorder</title>
	<meta name="description" content="Manage your projects." />
</svelte:head>

<main>
	<header>
		<h1>Recorder</h1>
		<form method="POST" action="/login?/logout"><button>Logout</button></form>
	</header>
	<p>Signed in as {data.user?.name ?? data.user?.id ?? 'GitHub user'}</p>
	<form method="GET" role="search" class="search-form">
		<label>Search client or project <input name="q" value={data.query} maxlength="200" /></label>
		<button>Search</button>
		{#if data.query}<a href="/">Clear</a>{/if}
	</form>
	<h2>Projects</h2>
	{#if data.projects.length}
		<ul>
			{#each data.projects as project (project.id)}
				<li>
					<a href={`/projects/${project.id}`}>{project.client_name} — {project.project_name}</a>
					<span class="status">{project.status}</span>
					<time datetime={project.updated_at}>Updated {new Date(project.updated_at).toLocaleString()}</time>
					{#if project.tags.length}<p class="tags">{project.tags.join(', ')}</p>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p>{data.query ? 'No matching projects.' : 'No projects yet.'}</p>
	{/if}
	<section>
		<h2>New project</h2>
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
		<form method="POST" action="?/create">
			<label>Client <input name="clientName" required maxlength="200" /></label>
			<label>Project <input name="projectName" required maxlength="200" /></label>
			<label>Status <select name="status"><option value="open">Open</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></label>
			<label>Contacts <textarea name="contacts" maxlength="4000"></textarea></label>
			<label>Tags (comma separated) <input name="tags" list="tag-suggestions" /></label>
			<datalist id="tag-suggestions">{#each data.suggestions as tag}<option value={tag}></option>{/each}</datalist>
			<button>Create project</button>
		</form>
	</section>
</main>

<style>
	:global(*) { box-sizing: border-box; }
	main { width: min(100% - 2rem, 56rem); margin: 1.5rem auto; font: 1rem/1.5 system-ui, sans-serif; }
	h1, h2, li, p { overflow-wrap: anywhere; }
	header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; }
	header h1 { margin-block: .5rem; }
	header form { margin: 0 0 .5rem; }
	form { display: grid; gap: .75rem; margin-block: 1rem 2rem; min-width: 0; }
	.search-form { grid-template-columns: minmax(0, 1fr) auto auto; align-items: end; }
	label { display: grid; gap: .25rem; }
	input, select, textarea, button { max-width: 100%; font: inherit; }
	input, select, textarea { width: 100%; min-width: 0; padding: .5rem .6rem; }
	button { min-height: 2.75rem; padding: .4rem .75rem; }
	ul { list-style: none; padding: 0; }
	li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .25rem .8rem; border-bottom: 1px solid #ddd; padding: .75rem 0; }
	li > a { min-width: 0; }
	li > time { color: #4b5563; font-size: .92rem; }
	li > .tags { grid-column: 1 / -1; margin: 0; color: #4b5563; font-size: .92rem; }
	@media (max-width: 36rem) {
		main { width: min(100% - 1rem, 56rem); margin-top: .75rem; }
		.search-form { grid-template-columns: minmax(0, 1fr) auto; }
		.search-form label { grid-column: 1 / -1; }
		li { grid-template-columns: minmax(0, 1fr); align-items: start; }
		li > .tags { grid-column: 1; }
	}
</style>
