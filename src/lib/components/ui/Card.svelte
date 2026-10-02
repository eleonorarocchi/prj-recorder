<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	type Element = 'div' | 'section' | 'article';
	type Props = Omit<HTMLAttributes<HTMLElement>, 'class'> & { as?: Element; class?: string; children?: Snippet };
	let { as = 'div', class: className = '', children, ...rest }: Props = $props();
</script>

<svelte:element this={as} class={`ui-card ${className}`.trim()} {...rest}>{@render children?.()}</svelte:element>
