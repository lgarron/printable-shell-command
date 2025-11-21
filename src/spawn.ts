import type {
  ChildProcess,
  ChildProcessByStdio,
  ChildProcessWithoutNullStreams,
  ProcessEnvOptions,
  SpawnOptions,
  SpawnOptionsWithoutStdio,
  SpawnOptionsWithStdioTuple,
  StdioNull,
  StdioPipe,
} from "node:child_process";
import type { Readable, Writable } from "node:stream";
import type { Path } from "path-class";
import type { SetFieldType } from "type-fest";

export type NodeCwd = ProcessEnvOptions["cwd"] | Path;
export type NodeWithCwd<T extends { cwd?: ProcessEnvOptions["cwd"] }> =
  SetFieldType<T, "cwd", NodeCwd | undefined>;

export interface WithSuccess {
  success: Promise<void>;
}

export declare function spawnType(
  options?: NodeWithCwd<SpawnOptionsWithoutStdio>,
): ChildProcessWithoutNullStreams & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe>
  >,
): ChildProcessByStdio<Writable, Readable, Readable> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioNull>
  >,
): ChildProcessByStdio<Writable, Readable, null> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioPipe, StdioNull, StdioPipe>
  >,
): ChildProcessByStdio<Writable, null, Readable> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>
  >,
): ChildProcessByStdio<null, Readable, Readable> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioPipe, StdioNull, StdioNull>
  >,
): ChildProcessByStdio<Writable, null, null> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioNull>
  >,
): ChildProcessByStdio<null, Readable, null> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioNull, StdioNull, StdioPipe>
  >,
): ChildProcessByStdio<null, null, Readable> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<
    SpawnOptionsWithStdioTuple<StdioNull, StdioNull, StdioNull>
  >,
): ChildProcessByStdio<null, null, null> & WithSuccess;
export declare function spawnType(
  options: NodeWithCwd<SpawnOptions>,
): ChildProcess & WithSuccess;
