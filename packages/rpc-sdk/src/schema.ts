export interface ParseSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface ParseFailure {
  readonly success: false;
  readonly error: string;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export interface Schema<TOut, TIn = TOut> {
  readonly _out?: TOut;
  readonly _in?: TIn;
  parse(val: unknown): ParseResult<TOut>;
  optional(): Schema<TOut | undefined, TIn | undefined>;
  nullable(): Schema<TOut | null, TIn | null>;
  default(fallback: TOut): Schema<TOut, TIn | undefined>;
  refine(predicate: (val: TOut) => boolean, message: string): Schema<TOut, TIn>;
}

export type InferOut<S extends Schema<any, any>> = S extends Schema<infer TOut, any> ? TOut : never;
export type InferIn<S extends Schema<any, any>> = S extends Schema<any, infer TIn> ? TIn : never;
export type Infer<S extends Schema<any, any>> = InferOut<S>;

type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;
type MakeUndefinedOptional<T> = { [K in RequiredKeys<T>]: T[K] } & { [K in OptionalKeys<T>]?: T[K] };
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type ObjectOut<TShape extends Record<string, Schema<any, any>>> = Prettify<
  MakeUndefinedOptional<{ [K in keyof TShape]: InferOut<TShape[K]> }>
>;
type ObjectIn<TShape extends Record<string, Schema<any, any>>> = Prettify<
  MakeUndefinedOptional<{ [K in keyof TShape]: InferIn<TShape[K]> }>
>;

function makeSchema<TOut, TIn = TOut>(fn: (val: unknown) => ParseResult<TOut>): Schema<TOut, TIn> {
  const schema: Schema<TOut, TIn> = {
    parse: fn,
    optional() {
      return makeSchema<TOut | undefined, TIn | undefined>((val) =>
        val === undefined ? { success: true, data: undefined } : fn(val),
      );
    },
    nullable() {
      return makeSchema<TOut | null, TIn | null>((val) =>
        val === null ? { success: true, data: null } : fn(val),
      );
    },
    default(fallback: TOut) {
      return makeSchema<TOut, TIn | undefined>((val) =>
        val === undefined ? { success: true, data: fallback } : fn(val),
      );
    },
    refine(predicate: (val: TOut) => boolean, message: string) {
      return makeSchema<TOut, TIn>((val) => {
        const res = fn(val);
        if (!res.success) return res;
        return predicate(res.data) ? res : { success: false, error: message };
      });
    },
  };
  return schema;
}

export interface StringSchema extends Schema<string, string> {
  min(n: number): StringSchema;
  max(n: number): StringSchema;
}

function createStringSchema(minLen?: number, maxLen?: number): StringSchema {
  const base = makeSchema<string, string>((val) => {
    if (typeof val !== "string") return { success: false, error: "Expected string" };
    if (minLen != null && val.length < minLen) return { success: false, error: `String must be at least ${minLen} chars` };
    if (maxLen != null && val.length > maxLen) return { success: false, error: `String must be at most ${maxLen} chars` };
    return { success: true, data: val };
  });
  return {
    ...base,
    min: (n: number) => createStringSchema(n, maxLen),
    max: (n: number) => createStringSchema(minLen, n),
  };
}

export interface NumberSchema extends Schema<number, number> {
  int(): NumberSchema;
  min(n: number): NumberSchema;
  max(n: number): NumberSchema;
}

function createNumberSchema(isInt = false, minVal?: number, maxVal?: number): NumberSchema {
  const base = makeSchema<number, number>((val) => {
    if (typeof val !== "number" || !Number.isFinite(val)) return { success: false, error: "Expected finite number" };
    if (isInt && !Number.isInteger(val)) return { success: false, error: "Expected integer" };
    if (minVal != null && val < minVal) return { success: false, error: `Number must be >= ${minVal}` };
    if (maxVal != null && val > maxVal) return { success: false, error: `Number must be <= ${maxVal}` };
    return { success: true, data: val };
  });
  return {
    ...base,
    int: () => createNumberSchema(true, minVal, maxVal),
    min: (n: number) => createNumberSchema(isInt, n, maxVal),
    max: (n: number) => createNumberSchema(isInt, minVal, n),
  };
}

export interface ObjectSchema<TShape extends Record<string, Schema<any, any>>>
  extends Schema<ObjectOut<TShape>, ObjectIn<TShape>> {
  readonly shape: TShape;
  extend<TExtra extends Record<string, Schema<any, any>>>(
    extra: TExtra,
  ): ObjectSchema<TShape & TExtra>;
}

function createObjectSchema<TShape extends Record<string, Schema<any, any>>>(
  shape: TShape,
): ObjectSchema<TShape> {
  const base = makeSchema<ObjectOut<TShape>, ObjectIn<TShape>>((val) => {
    if (typeof val !== "object" || val === null || Array.isArray(val)) {
      return { success: false, error: "Expected object" };
    }
    const record = val as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const parsed = fieldSchema.parse(record[key]);
      if (!parsed.success) {
        return { success: false, error: `${key}: ${parsed.error}` };
      }
      if (parsed.data !== undefined) {
        out[key] = parsed.data;
      }
    }
    return { success: true, data: out as ObjectOut<TShape> };
  });

  return {
    ...base,
    shape,
    extend<TExtra extends Record<string, Schema<any, any>>>(extra: TExtra) {
      return createObjectSchema({ ...shape, ...extra });
    },
  };
}

export const s = {
  string: () => createStringSchema(),
  number: () => createNumberSchema(),
  boolean: () =>
    makeSchema<boolean, boolean>((val) =>
      typeof val === "boolean" ? { success: true, data: val } : { success: false, error: "Expected boolean" },
    ),
  literal: <T extends string | number | boolean>(expected: T) =>
    makeSchema<T, T>((val) =>
      val === expected ? { success: true, data: expected } : { success: false, error: `Expected ${String(expected)}` },
    ),
  enum: <const T extends readonly [string, ...string[]]>(values: T) =>
    makeSchema<T[number], T[number]>((val) =>
      typeof val === "string" && (values as readonly string[]).includes(val)
        ? { success: true, data: val as T[number] }
        : { success: false, error: `Expected one of: ${values.join(", ")}` },
    ),
  union: <T extends readonly [Schema<any, any>, Schema<any, any>, ...Schema<any, any>[]]>(schemas: T) =>
    makeSchema<InferOut<T[number]>, InferIn<T[number]>>((val) => {
      const errs: string[] = [];
      for (const sc of schemas) {
        const res = sc.parse(val);
        if (res.success) return res;
        errs.push(res.error);
      }
      return { success: false, error: errs.join(" | ") };
    }),
  object: createObjectSchema,
  any: <T = any>() => makeSchema<T, T>((val) => ({ success: true, data: val as T })),
};
