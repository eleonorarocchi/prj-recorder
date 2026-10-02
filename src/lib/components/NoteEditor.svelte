<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Button from '$lib/components/ui/Button.svelte';

	let { initialHtml = '', fieldName = 'body', label = 'Note content' } = $props<{
		initialHtml?: string;
		fieldName?: string;
		label?: string;
	}>();
	let host: HTMLDivElement;
	let editor: Editor | null = $state(null);
	let html = $state('');
	let ready = $state(false);
	let revision = $state(0);

	onMount(() => {
		let mountedEditor: Editor;
		html = initialHtml;
		if (!host.isConnected) return;
		mountedEditor = new Editor({
			element: host,
			content: initialHtml,
			extensions: [
					StarterKit.configure({
						blockquote: false,
						code: false,
						codeBlock: false,
						heading: false,
						horizontalRule: false,
						strike: false,
						underline: false,
						link: { openOnClick: false, autolink: false, linkOnPaste: false }
					})
			],
			editorProps: {
					attributes: {
						'aria-label': label,
						'aria-multiline': 'true',
						role: 'textbox'
					}
			},
			onUpdate: ({ editor: current }) => {
				html = current.getHTML();
				revision += 1;
			},
			onSelectionUpdate: () => {
				revision += 1;
			}
		});
		editor = mountedEditor;
		ready = true;

		return () => {
			mountedEditor?.destroy();
		};
	});

	function active(mark: string): boolean {
		revision;
		return editor?.isActive(mark) ?? false;
	}

	function toggle(mark: 'bold' | 'italic' | 'bulletList' | 'orderedList') {
		const chain = editor?.chain().focus();
		if (!chain) return;
		if (mark === 'bold') chain.toggleBold().run();
		else if (mark === 'italic') chain.toggleItalic().run();
		else if (mark === 'bulletList') chain.toggleBulletList().run();
		else chain.toggleOrderedList().run();
		revision += 1;
	}

	function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().unsetLink().run();
		} else {
			const href = window.prompt('Link URL');
			if (href) editor.chain().focus().setLink({ href }).run();
		}
		revision += 1;
	}
</script>

<div class="note-editor">
	<div class="toolbar" role="toolbar" aria-label="Text formatting">
		<Button variant="secondary" class="toolbar-button" aria-label="Bold" aria-pressed={active('bold')} disabled={!ready} onclick={() => toggle('bold')}><strong>B</strong></Button>
		<Button variant="secondary" class="toolbar-button" aria-label="Italic" aria-pressed={active('italic')} disabled={!ready} onclick={() => toggle('italic')}><em>I</em></Button>
		<Button variant="secondary" class="toolbar-button" aria-label="Bulleted list" aria-pressed={active('bulletList')} disabled={!ready} onclick={() => toggle('bulletList')}>• List</Button>
		<Button variant="secondary" class="toolbar-button" aria-label="Numbered list" aria-pressed={active('orderedList')} disabled={!ready} onclick={() => toggle('orderedList')}>1. List</Button>
		<Button variant="secondary" class="toolbar-button" aria-label="Add or remove link" aria-pressed={active('link')} disabled={!ready} onclick={toggleLink}>Link</Button>
	</div>
	<div class="editor-surface" bind:this={host} hidden={!ready}></div>
	<textarea class="fallback" aria-label={label} name={fieldName} bind:value={html} hidden={ready} required={!ready}></textarea>
</div>

<style>
	.note-editor { min-width: 0; }
	.toolbar { display: flex; flex-wrap: wrap; gap: .4rem; margin-block: .35rem; }
	.toolbar :global(.toolbar-button) { min-width: var(--control-height); }
	.editor-surface, .fallback { min-height: 9rem; width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); background: var(--color-surface); color: var(--color-text); font: inherit; }
	.fallback { resize: vertical; }
	.editor-surface :global(.tiptap) { min-height: 7.5rem; outline: none; }
	.editor-surface:focus-within, .fallback:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 3px; }
	.editor-surface :global(.tiptap p:first-child) { margin-top: 0; }
	.editor-surface :global(.tiptap p:last-child) { margin-bottom: 0; }
	.editor-surface :global(.tiptap ul), .editor-surface :global(.tiptap ol) { padding-inline-start: 1.5rem; }
	.editor-surface :global(.tiptap a) { color: var(--color-primary); text-underline-offset: 0.15em; }
</style>
