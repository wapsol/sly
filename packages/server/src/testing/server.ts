import { SlyServer } from "../server.ts";
import type { SlyServerOptions, SlyServerService } from "../types.ts";
import { TestServerService } from "./service.ts";

export interface TestServerOptions extends SlyServerOptions {
	service?: SlyServerService;
}

export interface TestServer {
	server: SlyServer;
	service: SlyServerService;
}

/** Create an unstarted SlyServer with deterministic defaults for transport conformance tests. */
export function createTestServer(options: TestServerOptions): TestServer {
	const service = options.service ?? new TestServerService();
	return {
		server: new SlyServer(service, {
			listeners: options.listeners,
			maxFrameLength: options.maxFrameLength,
			handshakeTimeoutMs: options.handshakeTimeoutMs,
			serverId: options.serverId,
			onError: options.onError,
		}),
		service,
	};
}
