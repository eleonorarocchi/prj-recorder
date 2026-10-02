<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	type Value = string | number | string[] | undefined;
	type Props = Omit<HTMLInputAttributes, 'value' | 'class'> & { value?: Value; class?: string };
	let { value = $bindable<Value>(), class: className = '', ...rest }: Props = $props();
</script>

<input class={`ui-control ${className}`.trim()} bind:value {...rest} />
