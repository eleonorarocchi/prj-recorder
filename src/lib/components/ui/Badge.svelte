<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & { variant?: 'muted' | 'primary' | 'success' | 'danger'; class?: string; children?: Snippet };
	let { variant = 'muted', class: className = '', children, ...rest }: Props = $props();
</script>

<span class={`ui-badge ui-badge--${variant} ${className}`.trim()} {...rest}>{@render children?.()}</span>
