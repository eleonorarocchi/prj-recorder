<script lang="ts">let { data, form } = $props();</script>
<svelte:head><title>New project · Recorder</title></svelte:head>
<main><a href="/">← Projects</a><h1>New project</h1>{#if form?.message}<p role="alert">{form.message}</p>{/if}<form method="POST"><label>Client <input name="clientName" required maxlength="200" /></label><label>Project <input name="projectName" required maxlength="200" /></label><label>Status <select name="status"><option value="open">Open</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></label><label>Contacts <textarea name="contacts" maxlength="4000"></textarea></label><label>Tags (comma separated) <input name="tags" list="tag-suggestions" /></label><datalist id="tag-suggestions">{#each data.suggestions as tag}<option value={tag}></option>{/each}</datalist><button>Create project</button></form></main>
<style>
	:global(*) { box-sizing: border-box; }
	main { width: min(100% - 2rem, 48rem); margin: 1.5rem auto; font: 1rem/1.5 system-ui, sans-serif; }
	h1, p { overflow-wrap: anywhere; }
	form { display: grid; gap: .75rem; margin-block: 1rem; min-width: 0; }
	label { display: grid; gap: .25rem; }
	input, select, textarea, button { max-width: 100%; font: inherit; }
	input, select, textarea { width: 100%; min-width: 0; padding: .5rem .6rem; }
	textarea { min-height: 5rem; resize: vertical; }
	button { min-height: 2.75rem; padding: .4rem .75rem; }
	:global(a:focus-visible), :global(button:focus-visible), input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
	@media (max-width: 36rem) { main { width: min(100% - 1rem, 48rem); margin-top: .75rem; } }
</style>
