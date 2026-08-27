export { SlyClient } from "./client.ts";
export {
	SlyClientDisposedError,
	SlyDisconnectedError,
	SlyServerError,
	SlySessionDetachedError,
	SlySessionOwnershipError,
} from "./errors.ts";
export type { AcquireSessionOptions, SessionLease, SessionLeaseMode, SlySessionHandle } from "./session-handle.ts";
export type { ByteTransport, ByteTransportFactory, ByteTransportHandlers } from "./transport.ts";
export type {
	ConnectionState,
	ConnectionStateChange,
	CreateSessionOptions,
	ListenerErrorHandler,
	SlyClientOptions,
	Unsubscribe,
} from "./types.ts";
