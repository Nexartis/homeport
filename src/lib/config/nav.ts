/**
 * Shared navigation configuration — single source of truth.
 *
 * Used by: root layout, admin layout, command palette, mobile nav, footer.
 */
import {
	LayoutDashboard,
	Database,
	ShieldCheck,
	Scale,
	Eye,
	Coins,
	Network,
	ChartBar,
	TriangleAlert,
	Users,
	Shield,
	Webhook,
	Workflow,
	ArrowLeftRight,
	Wallet,
	KeyRound,
	Globe,
	Settings
} from 'lucide-svelte';
import type { AdminStats } from '../../routes/admin/+layout.server';

export interface AdminNavItem {
	id: string;
	href: string;
	label: string;
	icon: typeof LayoutDashboard;
	/** Description for command palette */
	description?: string;
	/** Function to extract badge count from stats (returns 0 to hide) */
	badge?: (stats: AdminStats) => number;
	/** Group this item belongs to */
	group: 'core' | 'operations' | 'lifecycle' | 'configuration';
	/** Show in the quick-access section of the user menu */
	quickAccess?: boolean;
}

// ─── Route Helpers ────────────────────────────────────────────────

/** Shared active-route detection. Use across header, sidebar, and menus. */
export function isActiveRoute(pathname: string, href: string): boolean {
	if (href === '/' || href === '/admin') return pathname === href;
	return pathname === href || pathname.startsWith(href + '/');
}

export interface AdminNavGroup {
	id: string;
	label: string;
	items: AdminNavItem[];
}

export const adminNavItems: AdminNavItem[] = [
	// ── Core ──
	{
		id: 'dashboard',
		href: '/admin',
		label: 'Dashboard',
		icon: LayoutDashboard,
		description: 'Overview & stats',
		group: 'core',
		quickAccess: true
	},
	{
		id: 'registry',
		href: '/admin/registry',
		label: 'Registry',
		icon: Database,
		description: 'Agent management',
		badge: (s) => s.agents.alive,
		group: 'core',
		quickAccess: true
	},
	{
		id: 'certifier',
		href: '/admin/certifier',
		label: 'Certifier',
		icon: ShieldCheck,
		description: 'Certification pipeline',
		badge: (s) => s.certJobs.pending + s.certJobs.running,
		group: 'core',
		quickAccess: true
	},
	{
		id: 'compliance',
		href: '/admin/compliance',
		label: 'Compliance',
		icon: Scale,
		description: 'Policy decisions & violations',
		badge: (s) => s.violations.total,
		group: 'core'
	},

	{
		id: 'switchboard',
		href: '/admin/switchboard',
		label: 'Switchboard',
		icon: ArrowLeftRight,
		description: 'Protocol bridge & discovery',
		group: 'core'
	},

	// ── Operations ──
	{
		id: 'observer',
		href: '/admin/observer',
		label: 'Observer',
		icon: Eye,
		description: 'Telemetry & probes',
		badge: (s) => s.telemetry.recentErrors,
		group: 'operations'
	},
	{
		id: 'network',
		href: '/admin/network',
		label: 'Network',
		icon: Network,
		description: 'Agent graph & connections',
		group: 'operations'
	},
	{
		id: 'federation',
		href: '/admin/federation',
		label: 'Federation',
		icon: Globe,
		description: 'Peer management & gossip',
		group: 'operations'
	},
	{
		id: 'analytics',
		href: '/admin/analytics',
		label: 'Analytics',
		icon: ChartBar,
		description: 'Usage metrics',
		group: 'operations'
	},

	// ── Lifecycle ──
	{
		id: 'payments',
		href: '/admin/payments',
		label: 'Payments',
		icon: Wallet,
		description: 'Multi-currency wallets & exchange',
		group: 'lifecycle'
	},
	{
		id: 'auditor',
		href: '/admin/auditor',
		label: 'Auditor',
		icon: Coins,
		description: 'Intents, settlements & wallets',
		badge: (s) => s.intents.open,
		group: 'lifecycle'
	},
	{
		id: 'deprecation',
		href: '/admin/deprecation',
		label: 'Deprecation',
		icon: TriangleAlert,
		description: 'Agent lifecycle management',
		group: 'lifecycle'
	},
	{
		id: 'visitors',
		href: '/admin/visitors',
		label: 'Visitors',
		icon: Users,
		description: 'Site visitor tracking',
		badge: (s) => s.visitors.total,
		group: 'lifecycle'
	},

	// ── Configuration ──
	{
		id: 'trust',
		href: '/admin/trust',
		label: 'Trust Framework',
		icon: Shield,
		description: 'Trust scores & graph',
		group: 'configuration'
	},
	{
		id: 'webhooks',
		href: '/admin/webhooks',
		label: 'Webhooks',
		icon: Webhook,
		description: 'Event subscriptions',
		group: 'configuration'
	},
	{
		id: 'orchestration',
		href: '/admin/orchestration',
		label: 'Orchestration',
		icon: Workflow,
		description: 'Workflows & DAG engine',
		group: 'configuration'
	},
	{
		id: 'keys',
		href: '/admin/keys',
		label: 'Key Management',
		icon: KeyRound,
		description: 'Node secrets & key rotation',
		group: 'configuration'
	},
	{
		id: 'settings',
		href: '/admin/settings',
		label: 'Settings',
		icon: Settings,
		description: 'Node settings, invitations, branding',
		group: 'configuration'
	}
];

/** Group metadata for section headers */
export const adminNavGroups: { id: AdminNavItem['group']; label: string }[] = [
	{ id: 'core', label: 'Core' },
	{ id: 'operations', label: 'Operations' },
	{ id: 'lifecycle', label: 'Lifecycle' },
	{ id: 'configuration', label: 'Configuration' }
];

/** Get nav items organized by group */
export function getGroupedNavItems(): AdminNavGroup[] {
	return adminNavGroups.map((g) => ({
		...g,
		items: adminNavItems.filter((item) => item.group === g.id)
	}));
}

/** Admin items shown in the user menu quick-access section */
export const adminQuickAccessItems = adminNavItems.filter((item) => item.quickAccess);
