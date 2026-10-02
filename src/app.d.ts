declare global {
	namespace App {
		interface Locals {
			auth: () => Promise<import('@auth/core').Session | null>;
		}
	}
}

declare module '@auth/core/types' {
	interface Session {
		user?: { id?: string } & DefaultSession['user'];
	}
}

import type { DefaultSession } from '@auth/core/types';
export {};
