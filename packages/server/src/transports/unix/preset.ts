import { SlyServer } from "../../server.ts";
import type { SlyServerService } from "../../types.ts";
import { createUnixListener } from "./listener.ts";
import type { UnixServerOptions } from "./types.ts";

/** Compose SlyServer with one Unix-domain socket listener. */
export function createUnixServer(service: SlyServerService, options: UnixServerOptions): SlyServer {
	const listener = createUnixListener({
		path: options.path,
		mode: options.mode,
		maxFrameLength: options.maxFrameLength,
		maxPendingBytes: options.maxPendingBytes,
		gracefulCloseTimeoutMs: options.gracefulCloseTimeoutMs,
		onError: options.onError,
	});
	return new SlyServer(service, {
		listeners: [listener],
		maxFrameLength: options.maxFrameLength,
		handshakeTimeoutMs: options.handshakeTimeoutMs,
		serverId: options.serverId,
		onError: options.onError,
	});
}
