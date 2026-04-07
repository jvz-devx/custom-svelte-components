<script lang="ts">
	import { page } from '$app/state';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import TableIcon from '@lucide/svelte/icons/table-2';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';

	let { children } = $props();

	type NavItem = {
		label: string;
		href: string;
		icon: typeof TableIcon;
	};

	const components: NavItem[] = [
		{ label: 'Virtual Table', href: '/components/virtual-table', icon: TableIcon }
	];

	const tools: NavItem[] = [
		{ label: 'Benchmark', href: '/components/virtual-table/benchmark', icon: GaugeIcon }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}

	// Build breadcrumbs from current path
	let breadcrumbs = $derived(() => {
		const path = page.url.pathname;
		const segments = path.split('/').filter(Boolean);
		const crumbs: { label: string; href: string }[] = [];

		let href = '';
		for (const seg of segments) {
			href += `/${seg}`;
			const label = seg
				.split('-')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');
			crumbs.push({ label, href });
		}
		return crumbs;
	});
</script>

<Sidebar.Provider>
	<Sidebar.Root>
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg">
						<div
							class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
						>
							<LayoutGridIcon class="size-4" />
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">Custom Components</span>
							<span class="truncate text-xs text-muted-foreground">Svelte 5 + SvelteKit</span>
						</div>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>

		<Sidebar.Content>
			<!-- Components -->
			<Sidebar.Group>
				<Sidebar.GroupLabel>Components</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each components as item}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
									{#snippet child({ props })}
										<a href={item.href} {...props}>
											<item.icon />
											<span>{item.label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<!-- Tools -->
			<Sidebar.Group>
				<Sidebar.GroupLabel>Tools</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each tools as item}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
									{#snippet child({ props })}
										<a href={item.href} {...props}>
											<item.icon />
											<span>{item.label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="GitHub">
						{#snippet child({ props })}
							<a
								href="https://github.com/jvz-devx/custom-svelte-components"
								target="_blank"
								rel="noopener noreferrer"
								{...props}
							>
								<ExternalLinkIcon />
								<span>GitHub</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset>
		<!-- Top bar with trigger + breadcrumbs -->
		<header
			class="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<Sidebar.Trigger class="-ml-1">
				<PanelLeftIcon class="size-4" />
				<span class="sr-only">Toggle sidebar</span>
			</Sidebar.Trigger>
			<Separator orientation="vertical" class="mr-2 !h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each breadcrumbs() as crumb, i}
						{#if i > 0}
							<Breadcrumb.Separator />
						{/if}
						<Breadcrumb.Item>
							{#if i === breadcrumbs().length - 1}
								<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>

		<!-- Page content -->
		<div class="flex-1 overflow-auto">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
