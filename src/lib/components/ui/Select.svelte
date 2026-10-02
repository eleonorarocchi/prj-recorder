<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	type Props = Omit<HTMLSelectAttributes, 'value' | 'class'> & { value?: string | number | undefined; class?: string; children?: Snippet };
	let { value = $bindable(), class: className = '', children, ...rest }: Props = $props();
</script>

<select class={`ui-control ${className}`.trim()} bind:value {...rest}>{@render children?.()}</select>
