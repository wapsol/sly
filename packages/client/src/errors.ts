import type { JsonValue, ProtocolError, ProtocolErrorCode } from "@earendil-works/pi-protocol";

export class SlyServerError extends Error {
	readonly code: ProtocolErrorCode;
	readonly details: JsonValue | undefined;

	constructor(error: ProtocolError) {
		super(error.message);
		this.name = "SlyServerError";
		this.code = error.code;
		this.details = error.details;
	}
}

export class SlyDisconnectedError extends Error {
	constructor(message = "Sly client is disconnected") {
		super(message);
		this.name = "SlyDisconnectedError";
	}
}

export class SlyClientDisposedError extends Error {
	constructor() {
		super("Sly client is disposed");
		this.name = "SlyClientDisposedError";
	}
}

export class SlySessionOwnershipError extends Error {
	readonly sessionId: string;

	constructor(sessionId: string, message: string) {
		super(message);
		this.name = "SlySessionOwnershipError";
		this.sessionId = sessionId;
	}
}

export class SlySessionDetachedError extends Error {
	readonly sessionId: string;

	constructor(sessionId: string) {
		super(`Session ${sessionId} is not attached`);
		this.name = "SlySessionDetachedError";
		this.sessionId = sessionId;
	}
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export function toDisconnectedError(error: unknown): SlyDisconnectedError {
	const cause = toError(error);
	return cause instanceof SlyDisconnectedError ? cause : new SlyDisconnectedError(cause.message);
}
