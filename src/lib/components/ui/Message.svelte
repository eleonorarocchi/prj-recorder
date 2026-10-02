<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'role'> & {
		variant?: 'info' | 'success' | 'warning' | 'error';
		role?: 'status' | 'alert';
		class?: string;
		children?: Snippet;
	};
	let { variant = 'info', role = 'status', class: className = '', children, ...rest }: Props = $props();
</script>

<div class={`ui-message ui-message--${variant} ${className}`.trim()} {role} {...rest}>{@render children?.()}</div>
