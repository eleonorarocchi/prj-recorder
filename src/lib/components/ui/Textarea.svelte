<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	type Props = Omit<HTMLTextareaAttributes, 'value' | 'class'> & { value?: string | undefined; class?: string };
	let { value = $bindable(''), class: className = '', ...rest }: Props = $props();
</script>

<textarea class={`ui-control ${className}`.trim()} bind:value {...rest}></textarea>
