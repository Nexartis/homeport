/**
 * Skill Mapper — OASF skill taxonomy mapping
 * Phase 6 — Agent California
 *
 * TypeScript port of Python SkillMapper from:
 *   nanda-repos/nanda-index/agntcy-interop/batch/export_nanda_to_agntcy.py
 *
 * Maps NANDA capabilities → OASF skill taxonomy for cross-registry interop.
 * In Workers environment, operates with a pre-loaded taxonomy JSON rather
 * than filesystem access.
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase E
 */

import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'skill-mapper');

/** OASF skill taxonomy entry */
export interface OasfSkill {
	name: string;
	caption?: string;
	uid?: number;
	extends?: string;
	description?: string;
}

/** Mapped skill result */
export interface MappedSkill {
	skill_id: string;
	category_name: string;
	category_uid: number;
	class_name: string;
	class_uid: number;
}

/** Fuzzy match rules (Python fallback rules ported to TS) */
const FUZZY_RULES: Array<[string, string]> = [
	['chat', 'natural_language_generation'],
	['conversation', 'natural_language_generation'],
	['classif', 'text_classification'],
	['retriev', 'information_retrieval_synthesis'],
	['search', 'information_retrieval_synthesis'],
	['vision', 'image_classification'],
	['image', 'image_classification'],
	['tool', 'tool_use_planning'],
	['code', 'code_generation'],
	['translate', 'machine_translation'],
	['summariz', 'text_summarization'],
	['embed', 'embedding_generation'],
	['reason', 'logical_reasoning'],
	['plan', 'task_planning']
];

export class SkillMapper {
	private categories: Map<string, Record<string, unknown>> = new Map();
	private skills: Map<string, OasfSkill> = new Map();
	private leafSkills: Map<string, OasfSkill> = new Map();
	private children: Map<string, string[]> = new Map();

	/**
	 * Load from pre-parsed taxonomy data (no filesystem access in Workers).
	 * categories: { [name]: { caption, uid, ... } }
	 * skills: { [name]: { name, caption, uid, extends, ... } }
	 */
	loadFromData(
		categoryData?: Record<string, Record<string, unknown>>,
		skillData?: Record<string, OasfSkill>
	): void {
		this.categories.clear();
		this.skills.clear();
		this.leafSkills.clear();
		this.children.clear();

		if (categoryData) {
			for (const [k, v] of Object.entries(categoryData)) {
				this.categories.set(k, v);
			}
		}

		if (skillData) {
			for (const [k, v] of Object.entries(skillData)) {
				this.skills.set(k, v);
				if (typeof v.extends === 'string') {
					const parentChildren = this.children.get(v.extends) ?? [];
					parentChildren.push(k);
					this.children.set(v.extends, parentChildren);
				}
			}
			this.computeLeaves();
		}

		log.info('loadFromData', `Loaded ${this.skills.size} skills, ${this.leafSkills.size} leaves`);
	}

	private computeLeaves(): void {
		for (const [name, obj] of this.skills) {
			const kids = this.children.get(name);
			if (!kids || kids.length === 0) {
				this.leafSkills.set(name, obj);
			}
		}
	}

	/** Map a capability string to an OASF taxonomy entry */
	mapCapability(capability: string): MappedSkill | null {
		const capNorm = capability.toLowerCase().trim().replace(/ /g, '_').replace(/-/g, '_');

		// 1. Exact leaf match
		const exactLeaf = this.leafSkills.get(capNorm);
		if (exactLeaf) return this.buildPayload(exactLeaf);

		// 2. Caption substring match
		for (const leaf of this.leafSkills.values()) {
			const caption = (leaf.caption ?? '').toLowerCase();
			if (caption && capNorm.length >= 3 && caption.includes(capNorm)) {
				return this.buildPayload(leaf);
			}
		}

		// 3. Fuzzy rule match
		for (const [needle, target] of FUZZY_RULES) {
			if (capNorm.includes(needle) && this.skills.has(target)) {
				let candidate = this.skills.get(target)!;
				// If target is a parent, use first child
				if (!this.leafSkills.has(target)) {
					const kids = this.children.get(target);
					if (kids?.[0]) {
						candidate = this.skills.get(kids[0]) ?? candidate;
					}
				}
				return this.buildPayload(candidate);
			}
		}

		return null;
	}

	private buildPayload(leaf: OasfSkill): MappedSkill {
		// Walk up the taxonomy chain
		let current: OasfSkill | undefined = leaf;
		let topParent: OasfSkill | undefined;
		const seen = new Set<string>();

		while (current?.extends && current.extends !== 'base_skill') {
			if (seen.has(current.extends)) break;
			seen.add(current.extends);
			const parent = this.skills.get(current.extends);
			if (!parent) break;
			topParent = parent;
			current = parent;
		}

		const catKey = topParent?.extends === 'base_skill' ? topParent.name : leaf.extends;
		const catMeta = catKey ? (this.categories.get(catKey) ?? {}) : {};

		return {
			skill_id: leaf.name,
			category_name: (catMeta as { caption?: string }).caption ?? catKey ?? '',
			category_uid: (catMeta as { uid?: number }).uid ?? 0,
			class_name: leaf.caption ?? leaf.name,
			class_uid: leaf.uid ?? 0
		};
	}

	/** Check if taxonomy is loaded */
	get isLoaded(): boolean {
		return this.skills.size > 0;
	}

	/** Get loaded skill count */
	get skillCount(): number {
		return this.skills.size;
	}

	/** Get loaded leaf skill count */
	get leafSkillCount(): number {
		return this.leafSkills.size;
	}
}
