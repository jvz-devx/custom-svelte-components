<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		value: unknown;
		type?: 'text' | 'number' | 'select' | 'date';
		options?: string[];
		editable?: boolean;
		oncommit?: (value: unknown) => void;
		class?: string;
	};

	let { value, type = 'text', options, editable = false, oncommit, class: className }: Props =
		$props();

	let editing = $state(false);
	let editValue = $state('');
	let inputEl = $state<HTMLInputElement | HTMLSelectElement | null>(null);

	function startEdit() {
		if (!editable) return;
		editValue = String(value ?? '');
		editing = true;
		// Focus after mount
		requestAnimationFrame(() => inputEl?.focus());
	}

	function commit() {
		editing = false;
		let parsed: unknown = editValue;
		if (type === 'number') parsed = Number(editValue);
		if (parsed !== value) {
			oncommit?.(parsed);
		}
	}

	function cancel() {
		editing = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commit();
		else if (e.key === 'Escape') cancel();
	}
</script>

{#if editing}
	{#if type === 'select' && options}
		<select
			bind:this={inputEl}
			bind:value={editValue}
			onblur={commit}
			{onkeydown}
			class={cn(
				'h-8 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
				className
			)}
		>
			{#each options as opt}
				<option value={opt}>{opt}</option>
			{/each}
		</select>
	{:else}
		<input
			bind:this={inputEl}
			bind:value={editValue}
			type={type === 'number' ? 'number' : 'text'}
			onblur={commit}
			{onkeydown}
			class={cn(
				'h-8 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
				className
			)}
		/>
	{/if}
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span
		class={cn(editable && 'cursor-pointer rounded px-1 hover:bg-muted', className)}
		ondblclick={startEdit}
	>
		{value ?? ''}
	</span>
{/if}
