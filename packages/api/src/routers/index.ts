import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import * as catalog from "./catalog";
import * as playlists from "./playlists";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	...catalog,
	...playlists,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
