import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EditableCell from './editable-cell.svelte';

describe('EditableCell', () => {
	describe('display mode', () => {
		it('renders the value as text', () => {
			render(EditableCell, { props: { value: 'Hello' } });
			expect(screen.getByText('Hello')).toBeInTheDocument();
		});

		it('renders empty string for null/undefined', () => {
			render(EditableCell, { props: { value: null } });
			const span = document.querySelector('span');
			expect(span).toBeInTheDocument();
		});

		it('renders number values', () => {
			render(EditableCell, { props: { value: 42 } });
			expect(screen.getByText('42')).toBeInTheDocument();
		});

		it('does not show input when not editing', () => {
			render(EditableCell, { props: { value: 'Test', editable: true } });
			expect(document.querySelector('input')).not.toBeInTheDocument();
		});

		it('applies hover class when editable', () => {
			render(EditableCell, { props: { value: 'Test', editable: true } });
			const span = screen.getByText('Test');
			expect(span.className).toContain('cursor-pointer');
		});

		it('does not apply hover class when not editable', () => {
			render(EditableCell, { props: { value: 'Test', editable: false } });
			const span = screen.getByText('Test');
			expect(span.className).not.toContain('cursor-pointer');
		});
	});

	describe('entering edit mode', () => {
		it('shows input on double-click when editable', async () => {
			render(EditableCell, { props: { value: 'Test', editable: true } });
			const span = screen.getByText('Test');
			await fireEvent.dblClick(span);
			expect(document.querySelector('input')).toBeInTheDocument();
		});

		it('does not enter edit mode on double-click when not editable', async () => {
			render(EditableCell, { props: { value: 'Test', editable: false } });
			const span = screen.getByText('Test');
			await fireEvent.dblClick(span);
			expect(document.querySelector('input')).not.toBeInTheDocument();
		});

		it('populates input with current value', async () => {
			render(EditableCell, { props: { value: 'Hello', editable: true } });
			await fireEvent.dblClick(screen.getByText('Hello'));
			const input = document.querySelector('input') as HTMLInputElement;
			expect(input.value).toBe('Hello');
		});
	});

	describe('committing edits', () => {
		it('calls oncommit with new value on Enter', async () => {
			const oncommit = vi.fn();
			render(EditableCell, { props: { value: 'Old', editable: true, oncommit } });
			await fireEvent.dblClick(screen.getByText('Old'));

			const input = document.querySelector('input') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'New' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(oncommit).toHaveBeenCalledWith('New');
		});

		it('calls oncommit with new value on blur', async () => {
			const oncommit = vi.fn();
			render(EditableCell, { props: { value: 'Old', editable: true, oncommit } });
			await fireEvent.dblClick(screen.getByText('Old'));

			const input = document.querySelector('input') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Blurred' } });
			await fireEvent.blur(input);

			expect(oncommit).toHaveBeenCalledWith('Blurred');
		});

		it('does not call oncommit if value unchanged', async () => {
			const oncommit = vi.fn();
			render(EditableCell, { props: { value: 'Same', editable: true, oncommit } });
			await fireEvent.dblClick(screen.getByText('Same'));

			const input = document.querySelector('input') as HTMLInputElement;
			// Value is already 'Same', just press Enter
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(oncommit).not.toHaveBeenCalled();
		});

		it('parses number type on commit', async () => {
			const oncommit = vi.fn();
			render(EditableCell, {
				props: { value: 42, editable: true, type: 'number', oncommit }
			});
			await fireEvent.dblClick(screen.getByText('42'));

			const input = document.querySelector('input') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: '99' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(oncommit).toHaveBeenCalledWith(99);
		});

		it('exits edit mode after commit', async () => {
			render(EditableCell, { props: { value: 'Test', editable: true } });
			await fireEvent.dblClick(screen.getByText('Test'));
			expect(document.querySelector('input')).toBeInTheDocument();

			const input = document.querySelector('input') as HTMLInputElement;
			await fireEvent.keyDown(input, { key: 'Enter' });
			expect(document.querySelector('input')).not.toBeInTheDocument();
		});
	});

	describe('cancelling edits', () => {
		it('exits edit mode on Escape without calling oncommit', async () => {
			const oncommit = vi.fn();
			render(EditableCell, { props: { value: 'Test', editable: true, oncommit } });
			await fireEvent.dblClick(screen.getByText('Test'));

			const input = document.querySelector('input') as HTMLInputElement;
			await fireEvent.input(input, { target: { value: 'Changed' } });
			await fireEvent.keyDown(input, { key: 'Escape' });

			expect(oncommit).not.toHaveBeenCalled();
			expect(document.querySelector('input')).not.toBeInTheDocument();
		});
	});

	describe('select type', () => {
		it('renders a select element when type is select', async () => {
			render(EditableCell, {
				props: {
					value: 'A',
					editable: true,
					type: 'select',
					options: ['A', 'B', 'C']
				}
			});
			await fireEvent.dblClick(screen.getByText('A'));
			expect(document.querySelector('select')).toBeInTheDocument();
			const opts = document.querySelectorAll('option');
			expect(opts).toHaveLength(3);
		});
	});

	describe('number input type', () => {
		it('renders input[type=number] for number columns', async () => {
			render(EditableCell, {
				props: { value: 100, editable: true, type: 'number' }
			});
			await fireEvent.dblClick(screen.getByText('100'));
			const input = document.querySelector('input') as HTMLInputElement;
			expect(input.type).toBe('number');
		});
	});
});
