<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';
	type Props = Omit<HTMLButtonAttributes, 'class'> & {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	};

	let { variant = 'primary', size = 'md', class: className = '', type = 'button', children, ...rest }: Props = $props();
</script>

<button class={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()} {type} {...rest}>{@render children?.()}</button>
