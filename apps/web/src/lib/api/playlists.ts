import { createMutation, createQuery } from "@tanstack/svelte-query";
import { orpc, queryClient } from "$lib/orpc";

/**
 * 收藏列表的 web 端数据层封装。
 * 收藏粒度 = 专辑；列表操作均为登录后行为（后端 protectedProcedure）。
 */

export function usePlaylistList() {
	return createQuery(() =>
		orpc.playlistList.queryOptions({ placeholderData: (prev) => prev }),
	);
}

export function usePlaylistDetail(id: string | undefined) {
	return createQuery(() =>
		orpc.playlistDetail.queryOptions({
			input: { id: id ?? "" },
			enabled: !!id,
			placeholderData: (prev) => prev,
		}),
	);
}

/** 失效列表页 + 单个列表详情（用于增删改后刷新） */
function invalidatePlaylists(id?: string) {
	queryClient.invalidateQueries({ queryKey: orpc.playlistList.key() });
	if (id) {
		queryClient.invalidateQueries({
			queryKey: orpc.playlistDetail.key({ input: { id } }),
		});
	}
}

export function useCreatePlaylist() {
	return createMutation(() =>
		orpc.playlistCreate.mutationOptions({
			onSuccess: () => invalidatePlaylists(),
		}),
	);
}

export function useRenamePlaylist() {
	return createMutation(() =>
		orpc.playlistRename.mutationOptions({
			onSuccess: (_data, variables) => invalidatePlaylists(variables.id),
		}),
	);
}

export function useDeletePlaylist() {
	return createMutation(() =>
		orpc.playlistDelete.mutationOptions({
			onSuccess: (_data, variables) => invalidatePlaylists(variables.id),
		}),
	);
}

export function useAddAlbumToPlaylist() {
	return createMutation(() =>
		orpc.playlistAddAlbum.mutationOptions({
			onSuccess: (_data, variables) =>
				invalidatePlaylists(variables.playlistId),
		}),
	);
}

export function useRemoveAlbumFromPlaylist() {
	return createMutation(() =>
		orpc.playlistRemoveAlbum.mutationOptions({
			onSuccess: (_data, variables) =>
				invalidatePlaylists(variables.playlistId),
		}),
	);
}
