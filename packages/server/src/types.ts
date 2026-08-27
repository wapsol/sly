import type {
	Command,
	ModelMetadata,
	ModelRef,
	SessionMetadata,
	SessionPhase,
	SessionSnapshot,
	ThinkingLevel,
	TranscriptProgress,
} from "@earendil-works/pi-protocol";
import type { SlyServerError } from "./errors.ts";
import type { SlyServerListener } from "./listener.ts";

export interface SlyServerOptions {
	listeners: readonly SlyServerListener[];
	maxFrameLength?: number;
	handshakeTimeoutMs?: number;
	serverId?: string;
	onError?: (error: Error) => void;
}

export type MaybePromise<T> = T | Promise<T>;

export type PromptInput = Omit<Extract<Command, { command: "prompt" }>, "command" | "sessionId">;
export type SteerInput = Omit<Extract<Command, { command: "steer" }>, "command" | "sessionId">;

export interface CreateSessionOptions {
	/** A collision-resistant ID assigned by SlyServer. The service must persist this exact ID. */
	id: string;
	cwd?: string;
	name?: string;
	model?: ModelRef;
	thinkingLevel?: ThinkingLevel;
}

export type SlySessionRuntimeEvent =
	| { type: "snapshot" }
	| { type: "progress"; progress: TranscriptProgress }
	| { type: "error"; error: SlyServerError };

/** One acquired durable session. Conflicting operations must reject rather than queue. */
export interface SlySessionRuntime {
	snapshot(): MaybePromise<SessionSnapshot>;
	getPhase(): SessionPhase;
	prompt(input: PromptInput): Promise<void>;
	steer(input: SteerInput): Promise<void>;
	abort(): Promise<void>;
	setModel(model: ModelRef): Promise<void>;
	setThinking(thinkingLevel: ThinkingLevel): Promise<void>;
	subscribe(listener: (event: SlySessionRuntimeEvent) => void): () => void;
	dispose(): Promise<void>;
}

/** Service boundary for durable sessions and exclusively acquired runtimes. */
export interface SlyServerService {
	listSessions(): Promise<SessionMetadata[]>;
	listModels(): Promise<ModelMetadata[]>;
	createSession(options: CreateSessionOptions): Promise<SlySessionRuntime>;
	openSession(sessionId: string): Promise<SlySessionRuntime>;
}

export type SessionRuntime = SlySessionRuntime;
export type SessionRuntimeEvent = SlySessionRuntimeEvent;
