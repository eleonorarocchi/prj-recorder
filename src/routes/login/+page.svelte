<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Login · Recorder</title></svelte:head>
<main>
	<h1>Recorder</h1>
	<p>Accedi con il tuo account GitHub autorizzato.</p>
	{#if data.denied}<p role="alert">Accesso non riuscito. Verifica l’account autorizzato e riprova.</p>{/if}
	<form method="POST" action="?/signin">
		<input type="hidden" name="providerId" value="github" />
		<input type="hidden" name="redirectTo" value={data.returnTo} />
		<button type="submit">Accedi con GitHub</button>
	</form>
</main>

<style>
	:global(*) { box-sizing: border-box; }
	main { width: min(100% - 2rem, 32rem); margin: clamp(1rem, 8vh, 5rem) auto; padding: clamp(1rem, 5vw, 2rem); border: 1px solid #d1d5db; border-radius: .65rem; font: 1rem/1.5 system-ui, sans-serif; }
	h1, p { overflow-wrap: anywhere; }
	button { width: 100%; min-height: 2.75rem; padding: .5rem .75rem; font: inherit; }
	:global(a:focus-visible), :global(button:focus-visible) { outline: 3px solid #2563eb; outline-offset: 2px; }
	@media (max-width: 36rem) { main { width: min(100% - 1rem, 32rem); } }
</style>
