
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model VerificationToken
 * 
 */
export type VerificationToken = $Result.DefaultSelection<Prisma.$VerificationTokenPayload>
/**
 * Model Session
 * 
 */
export type Session = $Result.DefaultSelection<Prisma.$SessionPayload>
/**
 * Model EmailLog
 * 
 */
export type EmailLog = $Result.DefaultSelection<Prisma.$EmailLogPayload>
/**
 * Model AdminUser
 * 
 */
export type AdminUser = $Result.DefaultSelection<Prisma.$AdminUserPayload>
/**
 * Model AdminSession
 * 
 */
export type AdminSession = $Result.DefaultSelection<Prisma.$AdminSessionPayload>
/**
 * Model AdminRecoveryCode
 * 
 */
export type AdminRecoveryCode = $Result.DefaultSelection<Prisma.$AdminRecoveryCodePayload>
/**
 * Model AuditLog
 * 
 */
export type AuditLog = $Result.DefaultSelection<Prisma.$AuditLogPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const UserStatus: {
  pending_verification: 'pending_verification',
  active: 'active',
  suspended: 'suspended',
  banned: 'banned'
};

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]


export const UserType: {
  guest: 'guest',
  provider: 'provider'
};

export type UserType = (typeof UserType)[keyof typeof UserType]


export const OAuthProvider: {
  google: 'google',
  apple: 'apple'
};

export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider]


export const LoyaltyTier: {
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  diamond: 'diamond'
};

export type LoyaltyTier = (typeof LoyaltyTier)[keyof typeof LoyaltyTier]


export const TokenType: {
  email_verification: 'email_verification',
  password_reset: 'password_reset'
};

export type TokenType = (typeof TokenType)[keyof typeof TokenType]


export const EmailLogType: {
  verification: 'verification',
  verification_resend: 'verification_resend',
  welcome: 'welcome',
  password_reset: 'password_reset',
  account_suspended: 'account_suspended',
  account_reinstated: 'account_reinstated',
  account_banned: 'account_banned'
};

export type EmailLogType = (typeof EmailLogType)[keyof typeof EmailLogType]


export const EmailLogStatus: {
  sent: 'sent',
  failed: 'failed',
  bounced: 'bounced'
};

export type EmailLogStatus = (typeof EmailLogStatus)[keyof typeof EmailLogStatus]


export const AdminRole: {
  super_admin: 'super_admin',
  admin: 'admin',
  country_manager: 'country_manager',
  sales: 'sales',
  support: 'support',
  finance: 'finance'
};

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole]

}

export type UserStatus = $Enums.UserStatus

export const UserStatus: typeof $Enums.UserStatus

export type UserType = $Enums.UserType

export const UserType: typeof $Enums.UserType

export type OAuthProvider = $Enums.OAuthProvider

export const OAuthProvider: typeof $Enums.OAuthProvider

export type LoyaltyTier = $Enums.LoyaltyTier

export const LoyaltyTier: typeof $Enums.LoyaltyTier

export type TokenType = $Enums.TokenType

export const TokenType: typeof $Enums.TokenType

export type EmailLogType = $Enums.EmailLogType

export const EmailLogType: typeof $Enums.EmailLogType

export type EmailLogStatus = $Enums.EmailLogStatus

export const EmailLogStatus: typeof $Enums.EmailLogStatus

export type AdminRole = $Enums.AdminRole

export const AdminRole: typeof $Enums.AdminRole

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.verificationToken`: Exposes CRUD operations for the **VerificationToken** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more VerificationTokens
    * const verificationTokens = await prisma.verificationToken.findMany()
    * ```
    */
  get verificationToken(): Prisma.VerificationTokenDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Sessions
    * const sessions = await prisma.session.findMany()
    * ```
    */
  get session(): Prisma.SessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.emailLog`: Exposes CRUD operations for the **EmailLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EmailLogs
    * const emailLogs = await prisma.emailLog.findMany()
    * ```
    */
  get emailLog(): Prisma.EmailLogDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.adminUser`: Exposes CRUD operations for the **AdminUser** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AdminUsers
    * const adminUsers = await prisma.adminUser.findMany()
    * ```
    */
  get adminUser(): Prisma.AdminUserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.adminSession`: Exposes CRUD operations for the **AdminSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AdminSessions
    * const adminSessions = await prisma.adminSession.findMany()
    * ```
    */
  get adminSession(): Prisma.AdminSessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.adminRecoveryCode`: Exposes CRUD operations for the **AdminRecoveryCode** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AdminRecoveryCodes
    * const adminRecoveryCodes = await prisma.adminRecoveryCode.findMany()
    * ```
    */
  get adminRecoveryCode(): Prisma.AdminRecoveryCodeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.auditLog`: Exposes CRUD operations for the **AuditLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AuditLogs
    * const auditLogs = await prisma.auditLog.findMany()
    * ```
    */
  get auditLog(): Prisma.AuditLogDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    VerificationToken: 'VerificationToken',
    Session: 'Session',
    EmailLog: 'EmailLog',
    AdminUser: 'AdminUser',
    AdminSession: 'AdminSession',
    AdminRecoveryCode: 'AdminRecoveryCode',
    AuditLog: 'AuditLog'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "verificationToken" | "session" | "emailLog" | "adminUser" | "adminSession" | "adminRecoveryCode" | "auditLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      VerificationToken: {
        payload: Prisma.$VerificationTokenPayload<ExtArgs>
        fields: Prisma.VerificationTokenFieldRefs
        operations: {
          findUnique: {
            args: Prisma.VerificationTokenFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.VerificationTokenFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          findFirst: {
            args: Prisma.VerificationTokenFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.VerificationTokenFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          findMany: {
            args: Prisma.VerificationTokenFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[]
          }
          create: {
            args: Prisma.VerificationTokenCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          createMany: {
            args: Prisma.VerificationTokenCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.VerificationTokenCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[]
          }
          delete: {
            args: Prisma.VerificationTokenDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          update: {
            args: Prisma.VerificationTokenUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          deleteMany: {
            args: Prisma.VerificationTokenDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.VerificationTokenUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.VerificationTokenUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[]
          }
          upsert: {
            args: Prisma.VerificationTokenUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>
          }
          aggregate: {
            args: Prisma.VerificationTokenAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateVerificationToken>
          }
          groupBy: {
            args: Prisma.VerificationTokenGroupByArgs<ExtArgs>
            result: $Utils.Optional<VerificationTokenGroupByOutputType>[]
          }
          count: {
            args: Prisma.VerificationTokenCountArgs<ExtArgs>
            result: $Utils.Optional<VerificationTokenCountAggregateOutputType> | number
          }
        }
      }
      Session: {
        payload: Prisma.$SessionPayload<ExtArgs>
        fields: Prisma.SessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findFirst: {
            args: Prisma.SessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findMany: {
            args: Prisma.SessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          create: {
            args: Prisma.SessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          createMany: {
            args: Prisma.SessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          delete: {
            args: Prisma.SessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          update: {
            args: Prisma.SessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          deleteMany: {
            args: Prisma.SessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          upsert: {
            args: Prisma.SessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          aggregate: {
            args: Prisma.SessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSession>
          }
          groupBy: {
            args: Prisma.SessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SessionCountArgs<ExtArgs>
            result: $Utils.Optional<SessionCountAggregateOutputType> | number
          }
        }
      }
      EmailLog: {
        payload: Prisma.$EmailLogPayload<ExtArgs>
        fields: Prisma.EmailLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EmailLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EmailLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          findFirst: {
            args: Prisma.EmailLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EmailLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          findMany: {
            args: Prisma.EmailLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>[]
          }
          create: {
            args: Prisma.EmailLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          createMany: {
            args: Prisma.EmailLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EmailLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>[]
          }
          delete: {
            args: Prisma.EmailLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          update: {
            args: Prisma.EmailLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          deleteMany: {
            args: Prisma.EmailLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EmailLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EmailLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>[]
          }
          upsert: {
            args: Prisma.EmailLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmailLogPayload>
          }
          aggregate: {
            args: Prisma.EmailLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEmailLog>
          }
          groupBy: {
            args: Prisma.EmailLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<EmailLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.EmailLogCountArgs<ExtArgs>
            result: $Utils.Optional<EmailLogCountAggregateOutputType> | number
          }
        }
      }
      AdminUser: {
        payload: Prisma.$AdminUserPayload<ExtArgs>
        fields: Prisma.AdminUserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AdminUserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AdminUserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          findFirst: {
            args: Prisma.AdminUserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AdminUserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          findMany: {
            args: Prisma.AdminUserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>[]
          }
          create: {
            args: Prisma.AdminUserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          createMany: {
            args: Prisma.AdminUserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AdminUserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>[]
          }
          delete: {
            args: Prisma.AdminUserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          update: {
            args: Prisma.AdminUserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          deleteMany: {
            args: Prisma.AdminUserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AdminUserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AdminUserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>[]
          }
          upsert: {
            args: Prisma.AdminUserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminUserPayload>
          }
          aggregate: {
            args: Prisma.AdminUserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAdminUser>
          }
          groupBy: {
            args: Prisma.AdminUserGroupByArgs<ExtArgs>
            result: $Utils.Optional<AdminUserGroupByOutputType>[]
          }
          count: {
            args: Prisma.AdminUserCountArgs<ExtArgs>
            result: $Utils.Optional<AdminUserCountAggregateOutputType> | number
          }
        }
      }
      AdminSession: {
        payload: Prisma.$AdminSessionPayload<ExtArgs>
        fields: Prisma.AdminSessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AdminSessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AdminSessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          findFirst: {
            args: Prisma.AdminSessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AdminSessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          findMany: {
            args: Prisma.AdminSessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>[]
          }
          create: {
            args: Prisma.AdminSessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          createMany: {
            args: Prisma.AdminSessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AdminSessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>[]
          }
          delete: {
            args: Prisma.AdminSessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          update: {
            args: Prisma.AdminSessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          deleteMany: {
            args: Prisma.AdminSessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AdminSessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AdminSessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>[]
          }
          upsert: {
            args: Prisma.AdminSessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminSessionPayload>
          }
          aggregate: {
            args: Prisma.AdminSessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAdminSession>
          }
          groupBy: {
            args: Prisma.AdminSessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<AdminSessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.AdminSessionCountArgs<ExtArgs>
            result: $Utils.Optional<AdminSessionCountAggregateOutputType> | number
          }
        }
      }
      AdminRecoveryCode: {
        payload: Prisma.$AdminRecoveryCodePayload<ExtArgs>
        fields: Prisma.AdminRecoveryCodeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AdminRecoveryCodeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AdminRecoveryCodeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          findFirst: {
            args: Prisma.AdminRecoveryCodeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AdminRecoveryCodeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          findMany: {
            args: Prisma.AdminRecoveryCodeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>[]
          }
          create: {
            args: Prisma.AdminRecoveryCodeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          createMany: {
            args: Prisma.AdminRecoveryCodeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AdminRecoveryCodeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>[]
          }
          delete: {
            args: Prisma.AdminRecoveryCodeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          update: {
            args: Prisma.AdminRecoveryCodeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          deleteMany: {
            args: Prisma.AdminRecoveryCodeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AdminRecoveryCodeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AdminRecoveryCodeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>[]
          }
          upsert: {
            args: Prisma.AdminRecoveryCodeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminRecoveryCodePayload>
          }
          aggregate: {
            args: Prisma.AdminRecoveryCodeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAdminRecoveryCode>
          }
          groupBy: {
            args: Prisma.AdminRecoveryCodeGroupByArgs<ExtArgs>
            result: $Utils.Optional<AdminRecoveryCodeGroupByOutputType>[]
          }
          count: {
            args: Prisma.AdminRecoveryCodeCountArgs<ExtArgs>
            result: $Utils.Optional<AdminRecoveryCodeCountAggregateOutputType> | number
          }
        }
      }
      AuditLog: {
        payload: Prisma.$AuditLogPayload<ExtArgs>
        fields: Prisma.AuditLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AuditLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AuditLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          findFirst: {
            args: Prisma.AuditLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AuditLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          findMany: {
            args: Prisma.AuditLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[]
          }
          create: {
            args: Prisma.AuditLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          createMany: {
            args: Prisma.AuditLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AuditLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[]
          }
          delete: {
            args: Prisma.AuditLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          update: {
            args: Prisma.AuditLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          deleteMany: {
            args: Prisma.AuditLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AuditLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AuditLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[]
          }
          upsert: {
            args: Prisma.AuditLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>
          }
          aggregate: {
            args: Prisma.AuditLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAuditLog>
          }
          groupBy: {
            args: Prisma.AuditLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<AuditLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.AuditLogCountArgs<ExtArgs>
            result: $Utils.Optional<AuditLogCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    verificationToken?: VerificationTokenOmit
    session?: SessionOmit
    emailLog?: EmailLogOmit
    adminUser?: AdminUserOmit
    adminSession?: AdminSessionOmit
    adminRecoveryCode?: AdminRecoveryCodeOmit
    auditLog?: AuditLogOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    verificationTokens: number
    sessions: number
    emailLogs: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    verificationTokens?: boolean | UserCountOutputTypeCountVerificationTokensArgs
    sessions?: boolean | UserCountOutputTypeCountSessionsArgs
    emailLogs?: boolean | UserCountOutputTypeCountEmailLogsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountVerificationTokensArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VerificationTokenWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountEmailLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmailLogWhereInput
  }


  /**
   * Count Type AdminUserCountOutputType
   */

  export type AdminUserCountOutputType = {
    adminSessions: number
    recoveryCodes: number
    auditLogs: number
  }

  export type AdminUserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminSessions?: boolean | AdminUserCountOutputTypeCountAdminSessionsArgs
    recoveryCodes?: boolean | AdminUserCountOutputTypeCountRecoveryCodesArgs
    auditLogs?: boolean | AdminUserCountOutputTypeCountAuditLogsArgs
  }

  // Custom InputTypes
  /**
   * AdminUserCountOutputType without action
   */
  export type AdminUserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUserCountOutputType
     */
    select?: AdminUserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AdminUserCountOutputType without action
   */
  export type AdminUserCountOutputTypeCountAdminSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminSessionWhereInput
  }

  /**
   * AdminUserCountOutputType without action
   */
  export type AdminUserCountOutputTypeCountRecoveryCodesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminRecoveryCodeWhereInput
  }

  /**
   * AdminUserCountOutputType without action
   */
  export type AdminUserCountOutputTypeCountAuditLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AuditLogWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    loyaltyPoints: number | null
  }

  export type UserSumAggregateOutputType = {
    loyaltyPoints: number | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    passwordHash: string | null
    status: $Enums.UserStatus | null
    userType: $Enums.UserType | null
    businessName: string | null
    country: string | null
    emailVerified: boolean | null
    emailVerifiedAt: Date | null
    oauthProvider: $Enums.OAuthProvider | null
    oauthSub: string | null
    oauthRevoked: boolean | null
    currentTier: $Enums.LoyaltyTier | null
    loyaltyPoints: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    passwordHash: string | null
    status: $Enums.UserStatus | null
    userType: $Enums.UserType | null
    businessName: string | null
    country: string | null
    emailVerified: boolean | null
    emailVerifiedAt: Date | null
    oauthProvider: $Enums.OAuthProvider | null
    oauthSub: string | null
    oauthRevoked: boolean | null
    currentTier: $Enums.LoyaltyTier | null
    loyaltyPoints: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    firstName: number
    lastName: number
    email: number
    passwordHash: number
    status: number
    userType: number
    businessName: number
    country: number
    emailVerified: number
    emailVerifiedAt: number
    oauthProvider: number
    oauthSub: number
    oauthRevoked: number
    currentTier: number
    loyaltyPoints: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    loyaltyPoints?: true
  }

  export type UserSumAggregateInputType = {
    loyaltyPoints?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    email?: true
    passwordHash?: true
    status?: true
    userType?: true
    businessName?: true
    country?: true
    emailVerified?: true
    emailVerifiedAt?: true
    oauthProvider?: true
    oauthSub?: true
    oauthRevoked?: true
    currentTier?: true
    loyaltyPoints?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    email?: true
    passwordHash?: true
    status?: true
    userType?: true
    businessName?: true
    country?: true
    emailVerified?: true
    emailVerifiedAt?: true
    oauthProvider?: true
    oauthSub?: true
    oauthRevoked?: true
    currentTier?: true
    loyaltyPoints?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    email?: true
    passwordHash?: true
    status?: true
    userType?: true
    businessName?: true
    country?: true
    emailVerified?: true
    emailVerifiedAt?: true
    oauthProvider?: true
    oauthSub?: true
    oauthRevoked?: true
    currentTier?: true
    loyaltyPoints?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    firstName: string
    lastName: string
    email: string
    passwordHash: string | null
    status: $Enums.UserStatus
    userType: $Enums.UserType
    businessName: string | null
    country: string | null
    emailVerified: boolean
    emailVerifiedAt: Date | null
    oauthProvider: $Enums.OAuthProvider | null
    oauthSub: string | null
    oauthRevoked: boolean
    currentTier: $Enums.LoyaltyTier
    loyaltyPoints: number
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    passwordHash?: boolean
    status?: boolean
    userType?: boolean
    businessName?: boolean
    country?: boolean
    emailVerified?: boolean
    emailVerifiedAt?: boolean
    oauthProvider?: boolean
    oauthSub?: boolean
    oauthRevoked?: boolean
    currentTier?: boolean
    loyaltyPoints?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    verificationTokens?: boolean | User$verificationTokensArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    emailLogs?: boolean | User$emailLogsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    passwordHash?: boolean
    status?: boolean
    userType?: boolean
    businessName?: boolean
    country?: boolean
    emailVerified?: boolean
    emailVerifiedAt?: boolean
    oauthProvider?: boolean
    oauthSub?: boolean
    oauthRevoked?: boolean
    currentTier?: boolean
    loyaltyPoints?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    passwordHash?: boolean
    status?: boolean
    userType?: boolean
    businessName?: boolean
    country?: boolean
    emailVerified?: boolean
    emailVerifiedAt?: boolean
    oauthProvider?: boolean
    oauthSub?: boolean
    oauthRevoked?: boolean
    currentTier?: boolean
    loyaltyPoints?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    passwordHash?: boolean
    status?: boolean
    userType?: boolean
    businessName?: boolean
    country?: boolean
    emailVerified?: boolean
    emailVerifiedAt?: boolean
    oauthProvider?: boolean
    oauthSub?: boolean
    oauthRevoked?: boolean
    currentTier?: boolean
    loyaltyPoints?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "firstName" | "lastName" | "email" | "passwordHash" | "status" | "userType" | "businessName" | "country" | "emailVerified" | "emailVerifiedAt" | "oauthProvider" | "oauthSub" | "oauthRevoked" | "currentTier" | "loyaltyPoints" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    verificationTokens?: boolean | User$verificationTokensArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    emailLogs?: boolean | User$emailLogsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      verificationTokens: Prisma.$VerificationTokenPayload<ExtArgs>[]
      sessions: Prisma.$SessionPayload<ExtArgs>[]
      emailLogs: Prisma.$EmailLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      firstName: string
      lastName: string
      email: string
      passwordHash: string | null
      status: $Enums.UserStatus
      userType: $Enums.UserType
      businessName: string | null
      country: string | null
      emailVerified: boolean
      emailVerifiedAt: Date | null
      oauthProvider: $Enums.OAuthProvider | null
      oauthSub: string | null
      oauthRevoked: boolean
      currentTier: $Enums.LoyaltyTier
      loyaltyPoints: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    verificationTokens<T extends User$verificationTokensArgs<ExtArgs> = {}>(args?: Subset<T, User$verificationTokensArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    sessions<T extends User$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, User$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    emailLogs<T extends User$emailLogsArgs<ExtArgs> = {}>(args?: Subset<T, User$emailLogsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly firstName: FieldRef<"User", 'String'>
    readonly lastName: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly status: FieldRef<"User", 'UserStatus'>
    readonly userType: FieldRef<"User", 'UserType'>
    readonly businessName: FieldRef<"User", 'String'>
    readonly country: FieldRef<"User", 'String'>
    readonly emailVerified: FieldRef<"User", 'Boolean'>
    readonly emailVerifiedAt: FieldRef<"User", 'DateTime'>
    readonly oauthProvider: FieldRef<"User", 'OAuthProvider'>
    readonly oauthSub: FieldRef<"User", 'String'>
    readonly oauthRevoked: FieldRef<"User", 'Boolean'>
    readonly currentTier: FieldRef<"User", 'LoyaltyTier'>
    readonly loyaltyPoints: FieldRef<"User", 'Int'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.verificationTokens
   */
  export type User$verificationTokensArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    where?: VerificationTokenWhereInput
    orderBy?: VerificationTokenOrderByWithRelationInput | VerificationTokenOrderByWithRelationInput[]
    cursor?: VerificationTokenWhereUniqueInput
    take?: number
    skip?: number
    distinct?: VerificationTokenScalarFieldEnum | VerificationTokenScalarFieldEnum[]
  }

  /**
   * User.sessions
   */
  export type User$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    cursor?: SessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * User.emailLogs
   */
  export type User$emailLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    where?: EmailLogWhereInput
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    cursor?: EmailLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model VerificationToken
   */

  export type AggregateVerificationToken = {
    _count: VerificationTokenCountAggregateOutputType | null
    _min: VerificationTokenMinAggregateOutputType | null
    _max: VerificationTokenMaxAggregateOutputType | null
  }

  export type VerificationTokenMinAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    tokenType: $Enums.TokenType | null
    expiresAt: Date | null
    used: boolean | null
    usedAt: Date | null
    invalidatedReason: string | null
    createdAt: Date | null
  }

  export type VerificationTokenMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    tokenType: $Enums.TokenType | null
    expiresAt: Date | null
    used: boolean | null
    usedAt: Date | null
    invalidatedReason: string | null
    createdAt: Date | null
  }

  export type VerificationTokenCountAggregateOutputType = {
    id: number
    userId: number
    tokenHash: number
    tokenType: number
    expiresAt: number
    used: number
    usedAt: number
    invalidatedReason: number
    createdAt: number
    _all: number
  }


  export type VerificationTokenMinAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    expiresAt?: true
    used?: true
    usedAt?: true
    invalidatedReason?: true
    createdAt?: true
  }

  export type VerificationTokenMaxAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    expiresAt?: true
    used?: true
    usedAt?: true
    invalidatedReason?: true
    createdAt?: true
  }

  export type VerificationTokenCountAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    expiresAt?: true
    used?: true
    usedAt?: true
    invalidatedReason?: true
    createdAt?: true
    _all?: true
  }

  export type VerificationTokenAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which VerificationToken to aggregate.
     */
    where?: VerificationTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?: VerificationTokenOrderByWithRelationInput | VerificationTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: VerificationTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VerificationTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned VerificationTokens
    **/
    _count?: true | VerificationTokenCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: VerificationTokenMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: VerificationTokenMaxAggregateInputType
  }

  export type GetVerificationTokenAggregateType<T extends VerificationTokenAggregateArgs> = {
        [P in keyof T & keyof AggregateVerificationToken]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVerificationToken[P]>
      : GetScalarType<T[P], AggregateVerificationToken[P]>
  }




  export type VerificationTokenGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VerificationTokenWhereInput
    orderBy?: VerificationTokenOrderByWithAggregationInput | VerificationTokenOrderByWithAggregationInput[]
    by: VerificationTokenScalarFieldEnum[] | VerificationTokenScalarFieldEnum
    having?: VerificationTokenScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: VerificationTokenCountAggregateInputType | true
    _min?: VerificationTokenMinAggregateInputType
    _max?: VerificationTokenMaxAggregateInputType
  }

  export type VerificationTokenGroupByOutputType = {
    id: string
    userId: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date
    used: boolean
    usedAt: Date | null
    invalidatedReason: string | null
    createdAt: Date
    _count: VerificationTokenCountAggregateOutputType | null
    _min: VerificationTokenMinAggregateOutputType | null
    _max: VerificationTokenMaxAggregateOutputType | null
  }

  type GetVerificationTokenGroupByPayload<T extends VerificationTokenGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VerificationTokenGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof VerificationTokenGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], VerificationTokenGroupByOutputType[P]>
            : GetScalarType<T[P], VerificationTokenGroupByOutputType[P]>
        }
      >
    >


  export type VerificationTokenSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    expiresAt?: boolean
    used?: boolean
    usedAt?: boolean
    invalidatedReason?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["verificationToken"]>

  export type VerificationTokenSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    expiresAt?: boolean
    used?: boolean
    usedAt?: boolean
    invalidatedReason?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["verificationToken"]>

  export type VerificationTokenSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    expiresAt?: boolean
    used?: boolean
    usedAt?: boolean
    invalidatedReason?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["verificationToken"]>

  export type VerificationTokenSelectScalar = {
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    expiresAt?: boolean
    used?: boolean
    usedAt?: boolean
    invalidatedReason?: boolean
    createdAt?: boolean
  }

  export type VerificationTokenOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "tokenHash" | "tokenType" | "expiresAt" | "used" | "usedAt" | "invalidatedReason" | "createdAt", ExtArgs["result"]["verificationToken"]>
  export type VerificationTokenInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type VerificationTokenIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type VerificationTokenIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $VerificationTokenPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "VerificationToken"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      tokenHash: string
      tokenType: $Enums.TokenType
      expiresAt: Date
      used: boolean
      usedAt: Date | null
      invalidatedReason: string | null
      createdAt: Date
    }, ExtArgs["result"]["verificationToken"]>
    composites: {}
  }

  type VerificationTokenGetPayload<S extends boolean | null | undefined | VerificationTokenDefaultArgs> = $Result.GetResult<Prisma.$VerificationTokenPayload, S>

  type VerificationTokenCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<VerificationTokenFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: VerificationTokenCountAggregateInputType | true
    }

  export interface VerificationTokenDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['VerificationToken'], meta: { name: 'VerificationToken' } }
    /**
     * Find zero or one VerificationToken that matches the filter.
     * @param {VerificationTokenFindUniqueArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VerificationTokenFindUniqueArgs>(args: SelectSubset<T, VerificationTokenFindUniqueArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one VerificationToken that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VerificationTokenFindUniqueOrThrowArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VerificationTokenFindUniqueOrThrowArgs>(args: SelectSubset<T, VerificationTokenFindUniqueOrThrowArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first VerificationToken that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindFirstArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VerificationTokenFindFirstArgs>(args?: SelectSubset<T, VerificationTokenFindFirstArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first VerificationToken that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindFirstOrThrowArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VerificationTokenFindFirstOrThrowArgs>(args?: SelectSubset<T, VerificationTokenFindFirstOrThrowArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more VerificationTokens that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all VerificationTokens
     * const verificationTokens = await prisma.verificationToken.findMany()
     * 
     * // Get first 10 VerificationTokens
     * const verificationTokens = await prisma.verificationToken.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const verificationTokenWithIdOnly = await prisma.verificationToken.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends VerificationTokenFindManyArgs>(args?: SelectSubset<T, VerificationTokenFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a VerificationToken.
     * @param {VerificationTokenCreateArgs} args - Arguments to create a VerificationToken.
     * @example
     * // Create one VerificationToken
     * const VerificationToken = await prisma.verificationToken.create({
     *   data: {
     *     // ... data to create a VerificationToken
     *   }
     * })
     * 
     */
    create<T extends VerificationTokenCreateArgs>(args: SelectSubset<T, VerificationTokenCreateArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many VerificationTokens.
     * @param {VerificationTokenCreateManyArgs} args - Arguments to create many VerificationTokens.
     * @example
     * // Create many VerificationTokens
     * const verificationToken = await prisma.verificationToken.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends VerificationTokenCreateManyArgs>(args?: SelectSubset<T, VerificationTokenCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many VerificationTokens and returns the data saved in the database.
     * @param {VerificationTokenCreateManyAndReturnArgs} args - Arguments to create many VerificationTokens.
     * @example
     * // Create many VerificationTokens
     * const verificationToken = await prisma.verificationToken.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many VerificationTokens and only return the `id`
     * const verificationTokenWithIdOnly = await prisma.verificationToken.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends VerificationTokenCreateManyAndReturnArgs>(args?: SelectSubset<T, VerificationTokenCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a VerificationToken.
     * @param {VerificationTokenDeleteArgs} args - Arguments to delete one VerificationToken.
     * @example
     * // Delete one VerificationToken
     * const VerificationToken = await prisma.verificationToken.delete({
     *   where: {
     *     // ... filter to delete one VerificationToken
     *   }
     * })
     * 
     */
    delete<T extends VerificationTokenDeleteArgs>(args: SelectSubset<T, VerificationTokenDeleteArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one VerificationToken.
     * @param {VerificationTokenUpdateArgs} args - Arguments to update one VerificationToken.
     * @example
     * // Update one VerificationToken
     * const verificationToken = await prisma.verificationToken.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends VerificationTokenUpdateArgs>(args: SelectSubset<T, VerificationTokenUpdateArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more VerificationTokens.
     * @param {VerificationTokenDeleteManyArgs} args - Arguments to filter VerificationTokens to delete.
     * @example
     * // Delete a few VerificationTokens
     * const { count } = await prisma.verificationToken.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends VerificationTokenDeleteManyArgs>(args?: SelectSubset<T, VerificationTokenDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more VerificationTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many VerificationTokens
     * const verificationToken = await prisma.verificationToken.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends VerificationTokenUpdateManyArgs>(args: SelectSubset<T, VerificationTokenUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more VerificationTokens and returns the data updated in the database.
     * @param {VerificationTokenUpdateManyAndReturnArgs} args - Arguments to update many VerificationTokens.
     * @example
     * // Update many VerificationTokens
     * const verificationToken = await prisma.verificationToken.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more VerificationTokens and only return the `id`
     * const verificationTokenWithIdOnly = await prisma.verificationToken.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends VerificationTokenUpdateManyAndReturnArgs>(args: SelectSubset<T, VerificationTokenUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one VerificationToken.
     * @param {VerificationTokenUpsertArgs} args - Arguments to update or create a VerificationToken.
     * @example
     * // Update or create a VerificationToken
     * const verificationToken = await prisma.verificationToken.upsert({
     *   create: {
     *     // ... data to create a VerificationToken
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the VerificationToken we want to update
     *   }
     * })
     */
    upsert<T extends VerificationTokenUpsertArgs>(args: SelectSubset<T, VerificationTokenUpsertArgs<ExtArgs>>): Prisma__VerificationTokenClient<$Result.GetResult<Prisma.$VerificationTokenPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of VerificationTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenCountArgs} args - Arguments to filter VerificationTokens to count.
     * @example
     * // Count the number of VerificationTokens
     * const count = await prisma.verificationToken.count({
     *   where: {
     *     // ... the filter for the VerificationTokens we want to count
     *   }
     * })
    **/
    count<T extends VerificationTokenCountArgs>(
      args?: Subset<T, VerificationTokenCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], VerificationTokenCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a VerificationToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VerificationTokenAggregateArgs>(args: Subset<T, VerificationTokenAggregateArgs>): Prisma.PrismaPromise<GetVerificationTokenAggregateType<T>>

    /**
     * Group by VerificationToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends VerificationTokenGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VerificationTokenGroupByArgs['orderBy'] }
        : { orderBy?: VerificationTokenGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, VerificationTokenGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVerificationTokenGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the VerificationToken model
   */
  readonly fields: VerificationTokenFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for VerificationToken.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VerificationTokenClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the VerificationToken model
   */
  interface VerificationTokenFieldRefs {
    readonly id: FieldRef<"VerificationToken", 'String'>
    readonly userId: FieldRef<"VerificationToken", 'String'>
    readonly tokenHash: FieldRef<"VerificationToken", 'String'>
    readonly tokenType: FieldRef<"VerificationToken", 'TokenType'>
    readonly expiresAt: FieldRef<"VerificationToken", 'DateTime'>
    readonly used: FieldRef<"VerificationToken", 'Boolean'>
    readonly usedAt: FieldRef<"VerificationToken", 'DateTime'>
    readonly invalidatedReason: FieldRef<"VerificationToken", 'String'>
    readonly createdAt: FieldRef<"VerificationToken", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * VerificationToken findUnique
   */
  export type VerificationTokenFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter, which VerificationToken to fetch.
     */
    where: VerificationTokenWhereUniqueInput
  }

  /**
   * VerificationToken findUniqueOrThrow
   */
  export type VerificationTokenFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter, which VerificationToken to fetch.
     */
    where: VerificationTokenWhereUniqueInput
  }

  /**
   * VerificationToken findFirst
   */
  export type VerificationTokenFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter, which VerificationToken to fetch.
     */
    where?: VerificationTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?: VerificationTokenOrderByWithRelationInput | VerificationTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VerificationTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of VerificationTokens.
     */
    distinct?: VerificationTokenScalarFieldEnum | VerificationTokenScalarFieldEnum[]
  }

  /**
   * VerificationToken findFirstOrThrow
   */
  export type VerificationTokenFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter, which VerificationToken to fetch.
     */
    where?: VerificationTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?: VerificationTokenOrderByWithRelationInput | VerificationTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VerificationTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of VerificationTokens.
     */
    distinct?: VerificationTokenScalarFieldEnum | VerificationTokenScalarFieldEnum[]
  }

  /**
   * VerificationToken findMany
   */
  export type VerificationTokenFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter, which VerificationTokens to fetch.
     */
    where?: VerificationTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?: VerificationTokenOrderByWithRelationInput | VerificationTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` VerificationTokens.
     */
    skip?: number
    distinct?: VerificationTokenScalarFieldEnum | VerificationTokenScalarFieldEnum[]
  }

  /**
   * VerificationToken create
   */
  export type VerificationTokenCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * The data needed to create a VerificationToken.
     */
    data: XOR<VerificationTokenCreateInput, VerificationTokenUncheckedCreateInput>
  }

  /**
   * VerificationToken createMany
   */
  export type VerificationTokenCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many VerificationTokens.
     */
    data: VerificationTokenCreateManyInput | VerificationTokenCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * VerificationToken createManyAndReturn
   */
  export type VerificationTokenCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * The data used to create many VerificationTokens.
     */
    data: VerificationTokenCreateManyInput | VerificationTokenCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * VerificationToken update
   */
  export type VerificationTokenUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * The data needed to update a VerificationToken.
     */
    data: XOR<VerificationTokenUpdateInput, VerificationTokenUncheckedUpdateInput>
    /**
     * Choose, which VerificationToken to update.
     */
    where: VerificationTokenWhereUniqueInput
  }

  /**
   * VerificationToken updateMany
   */
  export type VerificationTokenUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update VerificationTokens.
     */
    data: XOR<VerificationTokenUpdateManyMutationInput, VerificationTokenUncheckedUpdateManyInput>
    /**
     * Filter which VerificationTokens to update
     */
    where?: VerificationTokenWhereInput
    /**
     * Limit how many VerificationTokens to update.
     */
    limit?: number
  }

  /**
   * VerificationToken updateManyAndReturn
   */
  export type VerificationTokenUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * The data used to update VerificationTokens.
     */
    data: XOR<VerificationTokenUpdateManyMutationInput, VerificationTokenUncheckedUpdateManyInput>
    /**
     * Filter which VerificationTokens to update
     */
    where?: VerificationTokenWhereInput
    /**
     * Limit how many VerificationTokens to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * VerificationToken upsert
   */
  export type VerificationTokenUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * The filter to search for the VerificationToken to update in case it exists.
     */
    where: VerificationTokenWhereUniqueInput
    /**
     * In case the VerificationToken found by the `where` argument doesn't exist, create a new VerificationToken with this data.
     */
    create: XOR<VerificationTokenCreateInput, VerificationTokenUncheckedCreateInput>
    /**
     * In case the VerificationToken was found with the provided `where` argument, update it with this data.
     */
    update: XOR<VerificationTokenUpdateInput, VerificationTokenUncheckedUpdateInput>
  }

  /**
   * VerificationToken delete
   */
  export type VerificationTokenDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
    /**
     * Filter which VerificationToken to delete.
     */
    where: VerificationTokenWhereUniqueInput
  }

  /**
   * VerificationToken deleteMany
   */
  export type VerificationTokenDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which VerificationTokens to delete
     */
    where?: VerificationTokenWhereInput
    /**
     * Limit how many VerificationTokens to delete.
     */
    limit?: number
  }

  /**
   * VerificationToken without action
   */
  export type VerificationTokenDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VerificationTokenInclude<ExtArgs> | null
  }


  /**
   * Model Session
   */

  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  export type SessionMinAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    revoked: boolean | null
    createdAt: Date | null
    expiresAt: Date | null
  }

  export type SessionMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    revoked: boolean | null
    createdAt: Date | null
    expiresAt: Date | null
  }

  export type SessionCountAggregateOutputType = {
    id: number
    userId: number
    tokenHash: number
    revoked: number
    createdAt: number
    expiresAt: number
    _all: number
  }


  export type SessionMinAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    revoked?: true
    createdAt?: true
    expiresAt?: true
  }

  export type SessionMaxAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    revoked?: true
    createdAt?: true
    expiresAt?: true
  }

  export type SessionCountAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    revoked?: true
    createdAt?: true
    expiresAt?: true
    _all?: true
  }

  export type SessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Session to aggregate.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Sessions
    **/
    _count?: true | SessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionMaxAggregateInputType
  }

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
        [P in keyof T & keyof AggregateSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>
  }




  export type SessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithAggregationInput | SessionOrderByWithAggregationInput[]
    by: SessionScalarFieldEnum[] | SessionScalarFieldEnum
    having?: SessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionCountAggregateInputType | true
    _min?: SessionMinAggregateInputType
    _max?: SessionMaxAggregateInputType
  }

  export type SessionGroupByOutputType = {
    id: string
    userId: string
    tokenHash: string
    revoked: boolean
    createdAt: Date
    expiresAt: Date
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>
        }
      >
    >


  export type SessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectScalar = {
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    createdAt?: boolean
    expiresAt?: boolean
  }

  export type SessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "tokenHash" | "revoked" | "createdAt" | "expiresAt", ExtArgs["result"]["session"]>
  export type SessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Session"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      tokenHash: string
      revoked: boolean
      createdAt: Date
      expiresAt: Date
    }, ExtArgs["result"]["session"]>
    composites: {}
  }

  type SessionGetPayload<S extends boolean | null | undefined | SessionDefaultArgs> = $Result.GetResult<Prisma.$SessionPayload, S>

  type SessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SessionCountAggregateInputType | true
    }

  export interface SessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Session'], meta: { name: 'Session' } }
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SessionFindUniqueArgs>(args: SelectSubset<T, SessionFindUniqueArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Session that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(args: SelectSubset<T, SessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SessionFindFirstArgs>(args?: SelectSubset<T, SessionFindFirstArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(args?: SelectSubset<T, SessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     * 
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SessionFindManyArgs>(args?: SelectSubset<T, SessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     * 
     */
    create<T extends SessionCreateArgs>(args: SelectSubset<T, SessionCreateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Sessions.
     * @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SessionCreateManyArgs>(args?: SelectSubset<T, SessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Sessions and returns the data saved in the database.
     * @param {SessionCreateManyAndReturnArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SessionCreateManyAndReturnArgs>(args?: SelectSubset<T, SessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     * 
     */
    delete<T extends SessionDeleteArgs>(args: SelectSubset<T, SessionDeleteArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SessionUpdateArgs>(args: SelectSubset<T, SessionUpdateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SessionDeleteManyArgs>(args?: SelectSubset<T, SessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SessionUpdateManyArgs>(args: SelectSubset<T, SessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions and returns the data updated in the database.
     * @param {SessionUpdateManyAndReturnArgs} args - Arguments to update many Sessions.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SessionUpdateManyAndReturnArgs>(args: SelectSubset<T, SessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
     */
    upsert<T extends SessionUpsertArgs>(args: SelectSubset<T, SessionUpsertArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
    **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionAggregateArgs>(args: Subset<T, SessionAggregateArgs>): Prisma.PrismaPromise<GetSessionAggregateType<T>>

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs['orderBy'] }
        : { orderBy?: SessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Session model
   */
  readonly fields: SessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Session model
   */
  interface SessionFieldRefs {
    readonly id: FieldRef<"Session", 'String'>
    readonly userId: FieldRef<"Session", 'String'>
    readonly tokenHash: FieldRef<"Session", 'String'>
    readonly revoked: FieldRef<"Session", 'Boolean'>
    readonly createdAt: FieldRef<"Session", 'DateTime'>
    readonly expiresAt: FieldRef<"Session", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Session findUnique
   */
  export type SessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findFirst
   */
  export type SessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findMany
   */
  export type SessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Sessions to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session create
   */
  export type SessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to create a Session.
     */
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>
  }

  /**
   * Session createMany
   */
  export type SessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Session createManyAndReturn
   */
  export type SessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session update
   */
  export type SessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to update a Session.
     */
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
    /**
     * Choose, which Session to update.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
  }

  /**
   * Session updateManyAndReturn
   */
  export type SessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session upsert
   */
  export type SessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The filter to search for the Session to update in case it exists.
     */
    where: SessionWhereUniqueInput
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     */
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
  }

  /**
   * Session delete
   */
  export type SessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter which Session to delete.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Sessions to delete
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to delete.
     */
    limit?: number
  }

  /**
   * Session without action
   */
  export type SessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
  }


  /**
   * Model EmailLog
   */

  export type AggregateEmailLog = {
    _count: EmailLogCountAggregateOutputType | null
    _min: EmailLogMinAggregateOutputType | null
    _max: EmailLogMaxAggregateOutputType | null
  }

  export type EmailLogMinAggregateOutputType = {
    id: string | null
    userId: string | null
    type: $Enums.EmailLogType | null
    recipient: string | null
    status: $Enums.EmailLogStatus | null
    sendgridMsgId: string | null
    sentAt: Date | null
    createdAt: Date | null
  }

  export type EmailLogMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    type: $Enums.EmailLogType | null
    recipient: string | null
    status: $Enums.EmailLogStatus | null
    sendgridMsgId: string | null
    sentAt: Date | null
    createdAt: Date | null
  }

  export type EmailLogCountAggregateOutputType = {
    id: number
    userId: number
    type: number
    recipient: number
    status: number
    sendgridMsgId: number
    sentAt: number
    createdAt: number
    _all: number
  }


  export type EmailLogMinAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    recipient?: true
    status?: true
    sendgridMsgId?: true
    sentAt?: true
    createdAt?: true
  }

  export type EmailLogMaxAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    recipient?: true
    status?: true
    sendgridMsgId?: true
    sentAt?: true
    createdAt?: true
  }

  export type EmailLogCountAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    recipient?: true
    status?: true
    sendgridMsgId?: true
    sentAt?: true
    createdAt?: true
    _all?: true
  }

  export type EmailLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EmailLog to aggregate.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EmailLogs
    **/
    _count?: true | EmailLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EmailLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EmailLogMaxAggregateInputType
  }

  export type GetEmailLogAggregateType<T extends EmailLogAggregateArgs> = {
        [P in keyof T & keyof AggregateEmailLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEmailLog[P]>
      : GetScalarType<T[P], AggregateEmailLog[P]>
  }




  export type EmailLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmailLogWhereInput
    orderBy?: EmailLogOrderByWithAggregationInput | EmailLogOrderByWithAggregationInput[]
    by: EmailLogScalarFieldEnum[] | EmailLogScalarFieldEnum
    having?: EmailLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EmailLogCountAggregateInputType | true
    _min?: EmailLogMinAggregateInputType
    _max?: EmailLogMaxAggregateInputType
  }

  export type EmailLogGroupByOutputType = {
    id: string
    userId: string | null
    type: $Enums.EmailLogType
    recipient: string
    status: $Enums.EmailLogStatus
    sendgridMsgId: string | null
    sentAt: Date | null
    createdAt: Date
    _count: EmailLogCountAggregateOutputType | null
    _min: EmailLogMinAggregateOutputType | null
    _max: EmailLogMaxAggregateOutputType | null
  }

  type GetEmailLogGroupByPayload<T extends EmailLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EmailLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EmailLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EmailLogGroupByOutputType[P]>
            : GetScalarType<T[P], EmailLogGroupByOutputType[P]>
        }
      >
    >


  export type EmailLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    recipient?: boolean
    status?: boolean
    sendgridMsgId?: boolean
    sentAt?: boolean
    createdAt?: boolean
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }, ExtArgs["result"]["emailLog"]>

  export type EmailLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    recipient?: boolean
    status?: boolean
    sendgridMsgId?: boolean
    sentAt?: boolean
    createdAt?: boolean
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }, ExtArgs["result"]["emailLog"]>

  export type EmailLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    recipient?: boolean
    status?: boolean
    sendgridMsgId?: boolean
    sentAt?: boolean
    createdAt?: boolean
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }, ExtArgs["result"]["emailLog"]>

  export type EmailLogSelectScalar = {
    id?: boolean
    userId?: boolean
    type?: boolean
    recipient?: boolean
    status?: boolean
    sendgridMsgId?: boolean
    sentAt?: boolean
    createdAt?: boolean
  }

  export type EmailLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "type" | "recipient" | "status" | "sendgridMsgId" | "sentAt" | "createdAt", ExtArgs["result"]["emailLog"]>
  export type EmailLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }
  export type EmailLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }
  export type EmailLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | EmailLog$userArgs<ExtArgs>
  }

  export type $EmailLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "EmailLog"
    objects: {
      user: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string | null
      type: $Enums.EmailLogType
      recipient: string
      status: $Enums.EmailLogStatus
      sendgridMsgId: string | null
      sentAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["emailLog"]>
    composites: {}
  }

  type EmailLogGetPayload<S extends boolean | null | undefined | EmailLogDefaultArgs> = $Result.GetResult<Prisma.$EmailLogPayload, S>

  type EmailLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EmailLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EmailLogCountAggregateInputType | true
    }

  export interface EmailLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EmailLog'], meta: { name: 'EmailLog' } }
    /**
     * Find zero or one EmailLog that matches the filter.
     * @param {EmailLogFindUniqueArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EmailLogFindUniqueArgs>(args: SelectSubset<T, EmailLogFindUniqueArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one EmailLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EmailLogFindUniqueOrThrowArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EmailLogFindUniqueOrThrowArgs>(args: SelectSubset<T, EmailLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EmailLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindFirstArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EmailLogFindFirstArgs>(args?: SelectSubset<T, EmailLogFindFirstArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EmailLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindFirstOrThrowArgs} args - Arguments to find a EmailLog
     * @example
     * // Get one EmailLog
     * const emailLog = await prisma.emailLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EmailLogFindFirstOrThrowArgs>(args?: SelectSubset<T, EmailLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more EmailLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EmailLogs
     * const emailLogs = await prisma.emailLog.findMany()
     * 
     * // Get first 10 EmailLogs
     * const emailLogs = await prisma.emailLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const emailLogWithIdOnly = await prisma.emailLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EmailLogFindManyArgs>(args?: SelectSubset<T, EmailLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a EmailLog.
     * @param {EmailLogCreateArgs} args - Arguments to create a EmailLog.
     * @example
     * // Create one EmailLog
     * const EmailLog = await prisma.emailLog.create({
     *   data: {
     *     // ... data to create a EmailLog
     *   }
     * })
     * 
     */
    create<T extends EmailLogCreateArgs>(args: SelectSubset<T, EmailLogCreateArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many EmailLogs.
     * @param {EmailLogCreateManyArgs} args - Arguments to create many EmailLogs.
     * @example
     * // Create many EmailLogs
     * const emailLog = await prisma.emailLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EmailLogCreateManyArgs>(args?: SelectSubset<T, EmailLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many EmailLogs and returns the data saved in the database.
     * @param {EmailLogCreateManyAndReturnArgs} args - Arguments to create many EmailLogs.
     * @example
     * // Create many EmailLogs
     * const emailLog = await prisma.emailLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many EmailLogs and only return the `id`
     * const emailLogWithIdOnly = await prisma.emailLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EmailLogCreateManyAndReturnArgs>(args?: SelectSubset<T, EmailLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a EmailLog.
     * @param {EmailLogDeleteArgs} args - Arguments to delete one EmailLog.
     * @example
     * // Delete one EmailLog
     * const EmailLog = await prisma.emailLog.delete({
     *   where: {
     *     // ... filter to delete one EmailLog
     *   }
     * })
     * 
     */
    delete<T extends EmailLogDeleteArgs>(args: SelectSubset<T, EmailLogDeleteArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one EmailLog.
     * @param {EmailLogUpdateArgs} args - Arguments to update one EmailLog.
     * @example
     * // Update one EmailLog
     * const emailLog = await prisma.emailLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EmailLogUpdateArgs>(args: SelectSubset<T, EmailLogUpdateArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more EmailLogs.
     * @param {EmailLogDeleteManyArgs} args - Arguments to filter EmailLogs to delete.
     * @example
     * // Delete a few EmailLogs
     * const { count } = await prisma.emailLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EmailLogDeleteManyArgs>(args?: SelectSubset<T, EmailLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EmailLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EmailLogs
     * const emailLog = await prisma.emailLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EmailLogUpdateManyArgs>(args: SelectSubset<T, EmailLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EmailLogs and returns the data updated in the database.
     * @param {EmailLogUpdateManyAndReturnArgs} args - Arguments to update many EmailLogs.
     * @example
     * // Update many EmailLogs
     * const emailLog = await prisma.emailLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more EmailLogs and only return the `id`
     * const emailLogWithIdOnly = await prisma.emailLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EmailLogUpdateManyAndReturnArgs>(args: SelectSubset<T, EmailLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one EmailLog.
     * @param {EmailLogUpsertArgs} args - Arguments to update or create a EmailLog.
     * @example
     * // Update or create a EmailLog
     * const emailLog = await prisma.emailLog.upsert({
     *   create: {
     *     // ... data to create a EmailLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EmailLog we want to update
     *   }
     * })
     */
    upsert<T extends EmailLogUpsertArgs>(args: SelectSubset<T, EmailLogUpsertArgs<ExtArgs>>): Prisma__EmailLogClient<$Result.GetResult<Prisma.$EmailLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of EmailLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogCountArgs} args - Arguments to filter EmailLogs to count.
     * @example
     * // Count the number of EmailLogs
     * const count = await prisma.emailLog.count({
     *   where: {
     *     // ... the filter for the EmailLogs we want to count
     *   }
     * })
    **/
    count<T extends EmailLogCountArgs>(
      args?: Subset<T, EmailLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EmailLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EmailLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EmailLogAggregateArgs>(args: Subset<T, EmailLogAggregateArgs>): Prisma.PrismaPromise<GetEmailLogAggregateType<T>>

    /**
     * Group by EmailLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmailLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EmailLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EmailLogGroupByArgs['orderBy'] }
        : { orderBy?: EmailLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EmailLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmailLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EmailLog model
   */
  readonly fields: EmailLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EmailLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EmailLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends EmailLog$userArgs<ExtArgs> = {}>(args?: Subset<T, EmailLog$userArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the EmailLog model
   */
  interface EmailLogFieldRefs {
    readonly id: FieldRef<"EmailLog", 'String'>
    readonly userId: FieldRef<"EmailLog", 'String'>
    readonly type: FieldRef<"EmailLog", 'EmailLogType'>
    readonly recipient: FieldRef<"EmailLog", 'String'>
    readonly status: FieldRef<"EmailLog", 'EmailLogStatus'>
    readonly sendgridMsgId: FieldRef<"EmailLog", 'String'>
    readonly sentAt: FieldRef<"EmailLog", 'DateTime'>
    readonly createdAt: FieldRef<"EmailLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * EmailLog findUnique
   */
  export type EmailLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog findUniqueOrThrow
   */
  export type EmailLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog findFirst
   */
  export type EmailLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EmailLogs.
     */
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog findFirstOrThrow
   */
  export type EmailLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter, which EmailLog to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EmailLogs.
     */
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog findMany
   */
  export type EmailLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter, which EmailLogs to fetch.
     */
    where?: EmailLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EmailLogs to fetch.
     */
    orderBy?: EmailLogOrderByWithRelationInput | EmailLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EmailLogs.
     */
    cursor?: EmailLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EmailLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EmailLogs.
     */
    skip?: number
    distinct?: EmailLogScalarFieldEnum | EmailLogScalarFieldEnum[]
  }

  /**
   * EmailLog create
   */
  export type EmailLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * The data needed to create a EmailLog.
     */
    data: XOR<EmailLogCreateInput, EmailLogUncheckedCreateInput>
  }

  /**
   * EmailLog createMany
   */
  export type EmailLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EmailLogs.
     */
    data: EmailLogCreateManyInput | EmailLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * EmailLog createManyAndReturn
   */
  export type EmailLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * The data used to create many EmailLogs.
     */
    data: EmailLogCreateManyInput | EmailLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * EmailLog update
   */
  export type EmailLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * The data needed to update a EmailLog.
     */
    data: XOR<EmailLogUpdateInput, EmailLogUncheckedUpdateInput>
    /**
     * Choose, which EmailLog to update.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog updateMany
   */
  export type EmailLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EmailLogs.
     */
    data: XOR<EmailLogUpdateManyMutationInput, EmailLogUncheckedUpdateManyInput>
    /**
     * Filter which EmailLogs to update
     */
    where?: EmailLogWhereInput
    /**
     * Limit how many EmailLogs to update.
     */
    limit?: number
  }

  /**
   * EmailLog updateManyAndReturn
   */
  export type EmailLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * The data used to update EmailLogs.
     */
    data: XOR<EmailLogUpdateManyMutationInput, EmailLogUncheckedUpdateManyInput>
    /**
     * Filter which EmailLogs to update
     */
    where?: EmailLogWhereInput
    /**
     * Limit how many EmailLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * EmailLog upsert
   */
  export type EmailLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * The filter to search for the EmailLog to update in case it exists.
     */
    where: EmailLogWhereUniqueInput
    /**
     * In case the EmailLog found by the `where` argument doesn't exist, create a new EmailLog with this data.
     */
    create: XOR<EmailLogCreateInput, EmailLogUncheckedCreateInput>
    /**
     * In case the EmailLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EmailLogUpdateInput, EmailLogUncheckedUpdateInput>
  }

  /**
   * EmailLog delete
   */
  export type EmailLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
    /**
     * Filter which EmailLog to delete.
     */
    where: EmailLogWhereUniqueInput
  }

  /**
   * EmailLog deleteMany
   */
  export type EmailLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EmailLogs to delete
     */
    where?: EmailLogWhereInput
    /**
     * Limit how many EmailLogs to delete.
     */
    limit?: number
  }

  /**
   * EmailLog.user
   */
  export type EmailLog$userArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * EmailLog without action
   */
  export type EmailLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmailLog
     */
    select?: EmailLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EmailLog
     */
    omit?: EmailLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmailLogInclude<ExtArgs> | null
  }


  /**
   * Model AdminUser
   */

  export type AggregateAdminUser = {
    _count: AdminUserCountAggregateOutputType | null
    _avg: AdminUserAvgAggregateOutputType | null
    _sum: AdminUserSumAggregateOutputType | null
    _min: AdminUserMinAggregateOutputType | null
    _max: AdminUserMaxAggregateOutputType | null
  }

  export type AdminUserAvgAggregateOutputType = {
    cancellationCount: number | null
  }

  export type AdminUserSumAggregateOutputType = {
    cancellationCount: number | null
  }

  export type AdminUserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    passwordHash: string | null
    role: $Enums.AdminRole | null
    totpEnabled: boolean | null
    totpSecretEncrypted: string | null
    createdAt: Date | null
    updatedAt: Date | null
    cancellationCount: number | null
  }

  export type AdminUserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    passwordHash: string | null
    role: $Enums.AdminRole | null
    totpEnabled: boolean | null
    totpSecretEncrypted: string | null
    createdAt: Date | null
    updatedAt: Date | null
    cancellationCount: number | null
  }

  export type AdminUserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    passwordHash: number
    role: number
    countryScope: number
    totpEnabled: number
    totpSecretEncrypted: number
    fido2Credential: number
    createdAt: number
    updatedAt: number
    cancellationCount: number
    _all: number
  }


  export type AdminUserAvgAggregateInputType = {
    cancellationCount?: true
  }

  export type AdminUserSumAggregateInputType = {
    cancellationCount?: true
  }

  export type AdminUserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    passwordHash?: true
    role?: true
    totpEnabled?: true
    totpSecretEncrypted?: true
    createdAt?: true
    updatedAt?: true
    cancellationCount?: true
  }

  export type AdminUserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    passwordHash?: true
    role?: true
    totpEnabled?: true
    totpSecretEncrypted?: true
    createdAt?: true
    updatedAt?: true
    cancellationCount?: true
  }

  export type AdminUserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    passwordHash?: true
    role?: true
    countryScope?: true
    totpEnabled?: true
    totpSecretEncrypted?: true
    fido2Credential?: true
    createdAt?: true
    updatedAt?: true
    cancellationCount?: true
    _all?: true
  }

  export type AdminUserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminUser to aggregate.
     */
    where?: AdminUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminUsers to fetch.
     */
    orderBy?: AdminUserOrderByWithRelationInput | AdminUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AdminUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AdminUsers
    **/
    _count?: true | AdminUserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AdminUserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AdminUserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AdminUserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AdminUserMaxAggregateInputType
  }

  export type GetAdminUserAggregateType<T extends AdminUserAggregateArgs> = {
        [P in keyof T & keyof AggregateAdminUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAdminUser[P]>
      : GetScalarType<T[P], AggregateAdminUser[P]>
  }




  export type AdminUserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminUserWhereInput
    orderBy?: AdminUserOrderByWithAggregationInput | AdminUserOrderByWithAggregationInput[]
    by: AdminUserScalarFieldEnum[] | AdminUserScalarFieldEnum
    having?: AdminUserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AdminUserCountAggregateInputType | true
    _avg?: AdminUserAvgAggregateInputType
    _sum?: AdminUserSumAggregateInputType
    _min?: AdminUserMinAggregateInputType
    _max?: AdminUserMaxAggregateInputType
  }

  export type AdminUserGroupByOutputType = {
    id: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope: string[]
    totpEnabled: boolean
    totpSecretEncrypted: string | null
    fido2Credential: JsonValue | null
    createdAt: Date
    updatedAt: Date
    cancellationCount: number
    _count: AdminUserCountAggregateOutputType | null
    _avg: AdminUserAvgAggregateOutputType | null
    _sum: AdminUserSumAggregateOutputType | null
    _min: AdminUserMinAggregateOutputType | null
    _max: AdminUserMaxAggregateOutputType | null
  }

  type GetAdminUserGroupByPayload<T extends AdminUserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AdminUserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AdminUserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AdminUserGroupByOutputType[P]>
            : GetScalarType<T[P], AdminUserGroupByOutputType[P]>
        }
      >
    >


  export type AdminUserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    passwordHash?: boolean
    role?: boolean
    countryScope?: boolean
    totpEnabled?: boolean
    totpSecretEncrypted?: boolean
    fido2Credential?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    cancellationCount?: boolean
    adminSessions?: boolean | AdminUser$adminSessionsArgs<ExtArgs>
    recoveryCodes?: boolean | AdminUser$recoveryCodesArgs<ExtArgs>
    auditLogs?: boolean | AdminUser$auditLogsArgs<ExtArgs>
    _count?: boolean | AdminUserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminUser"]>

  export type AdminUserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    passwordHash?: boolean
    role?: boolean
    countryScope?: boolean
    totpEnabled?: boolean
    totpSecretEncrypted?: boolean
    fido2Credential?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    cancellationCount?: boolean
  }, ExtArgs["result"]["adminUser"]>

  export type AdminUserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    passwordHash?: boolean
    role?: boolean
    countryScope?: boolean
    totpEnabled?: boolean
    totpSecretEncrypted?: boolean
    fido2Credential?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    cancellationCount?: boolean
  }, ExtArgs["result"]["adminUser"]>

  export type AdminUserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    passwordHash?: boolean
    role?: boolean
    countryScope?: boolean
    totpEnabled?: boolean
    totpSecretEncrypted?: boolean
    fido2Credential?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    cancellationCount?: boolean
  }

  export type AdminUserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "email" | "passwordHash" | "role" | "countryScope" | "totpEnabled" | "totpSecretEncrypted" | "fido2Credential" | "createdAt" | "updatedAt" | "cancellationCount", ExtArgs["result"]["adminUser"]>
  export type AdminUserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminSessions?: boolean | AdminUser$adminSessionsArgs<ExtArgs>
    recoveryCodes?: boolean | AdminUser$recoveryCodesArgs<ExtArgs>
    auditLogs?: boolean | AdminUser$auditLogsArgs<ExtArgs>
    _count?: boolean | AdminUserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type AdminUserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type AdminUserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $AdminUserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AdminUser"
    objects: {
      adminSessions: Prisma.$AdminSessionPayload<ExtArgs>[]
      recoveryCodes: Prisma.$AdminRecoveryCodePayload<ExtArgs>[]
      auditLogs: Prisma.$AuditLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      email: string
      passwordHash: string
      role: $Enums.AdminRole
      countryScope: string[]
      totpEnabled: boolean
      totpSecretEncrypted: string | null
      fido2Credential: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
      cancellationCount: number
    }, ExtArgs["result"]["adminUser"]>
    composites: {}
  }

  type AdminUserGetPayload<S extends boolean | null | undefined | AdminUserDefaultArgs> = $Result.GetResult<Prisma.$AdminUserPayload, S>

  type AdminUserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AdminUserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AdminUserCountAggregateInputType | true
    }

  export interface AdminUserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AdminUser'], meta: { name: 'AdminUser' } }
    /**
     * Find zero or one AdminUser that matches the filter.
     * @param {AdminUserFindUniqueArgs} args - Arguments to find a AdminUser
     * @example
     * // Get one AdminUser
     * const adminUser = await prisma.adminUser.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AdminUserFindUniqueArgs>(args: SelectSubset<T, AdminUserFindUniqueArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AdminUser that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AdminUserFindUniqueOrThrowArgs} args - Arguments to find a AdminUser
     * @example
     * // Get one AdminUser
     * const adminUser = await prisma.adminUser.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AdminUserFindUniqueOrThrowArgs>(args: SelectSubset<T, AdminUserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminUser that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserFindFirstArgs} args - Arguments to find a AdminUser
     * @example
     * // Get one AdminUser
     * const adminUser = await prisma.adminUser.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AdminUserFindFirstArgs>(args?: SelectSubset<T, AdminUserFindFirstArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminUser that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserFindFirstOrThrowArgs} args - Arguments to find a AdminUser
     * @example
     * // Get one AdminUser
     * const adminUser = await prisma.adminUser.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AdminUserFindFirstOrThrowArgs>(args?: SelectSubset<T, AdminUserFindFirstOrThrowArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AdminUsers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AdminUsers
     * const adminUsers = await prisma.adminUser.findMany()
     * 
     * // Get first 10 AdminUsers
     * const adminUsers = await prisma.adminUser.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const adminUserWithIdOnly = await prisma.adminUser.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AdminUserFindManyArgs>(args?: SelectSubset<T, AdminUserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AdminUser.
     * @param {AdminUserCreateArgs} args - Arguments to create a AdminUser.
     * @example
     * // Create one AdminUser
     * const AdminUser = await prisma.adminUser.create({
     *   data: {
     *     // ... data to create a AdminUser
     *   }
     * })
     * 
     */
    create<T extends AdminUserCreateArgs>(args: SelectSubset<T, AdminUserCreateArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AdminUsers.
     * @param {AdminUserCreateManyArgs} args - Arguments to create many AdminUsers.
     * @example
     * // Create many AdminUsers
     * const adminUser = await prisma.adminUser.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AdminUserCreateManyArgs>(args?: SelectSubset<T, AdminUserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AdminUsers and returns the data saved in the database.
     * @param {AdminUserCreateManyAndReturnArgs} args - Arguments to create many AdminUsers.
     * @example
     * // Create many AdminUsers
     * const adminUser = await prisma.adminUser.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AdminUsers and only return the `id`
     * const adminUserWithIdOnly = await prisma.adminUser.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AdminUserCreateManyAndReturnArgs>(args?: SelectSubset<T, AdminUserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AdminUser.
     * @param {AdminUserDeleteArgs} args - Arguments to delete one AdminUser.
     * @example
     * // Delete one AdminUser
     * const AdminUser = await prisma.adminUser.delete({
     *   where: {
     *     // ... filter to delete one AdminUser
     *   }
     * })
     * 
     */
    delete<T extends AdminUserDeleteArgs>(args: SelectSubset<T, AdminUserDeleteArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AdminUser.
     * @param {AdminUserUpdateArgs} args - Arguments to update one AdminUser.
     * @example
     * // Update one AdminUser
     * const adminUser = await prisma.adminUser.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AdminUserUpdateArgs>(args: SelectSubset<T, AdminUserUpdateArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AdminUsers.
     * @param {AdminUserDeleteManyArgs} args - Arguments to filter AdminUsers to delete.
     * @example
     * // Delete a few AdminUsers
     * const { count } = await prisma.adminUser.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AdminUserDeleteManyArgs>(args?: SelectSubset<T, AdminUserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AdminUsers
     * const adminUser = await prisma.adminUser.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AdminUserUpdateManyArgs>(args: SelectSubset<T, AdminUserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminUsers and returns the data updated in the database.
     * @param {AdminUserUpdateManyAndReturnArgs} args - Arguments to update many AdminUsers.
     * @example
     * // Update many AdminUsers
     * const adminUser = await prisma.adminUser.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AdminUsers and only return the `id`
     * const adminUserWithIdOnly = await prisma.adminUser.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AdminUserUpdateManyAndReturnArgs>(args: SelectSubset<T, AdminUserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AdminUser.
     * @param {AdminUserUpsertArgs} args - Arguments to update or create a AdminUser.
     * @example
     * // Update or create a AdminUser
     * const adminUser = await prisma.adminUser.upsert({
     *   create: {
     *     // ... data to create a AdminUser
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AdminUser we want to update
     *   }
     * })
     */
    upsert<T extends AdminUserUpsertArgs>(args: SelectSubset<T, AdminUserUpsertArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AdminUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserCountArgs} args - Arguments to filter AdminUsers to count.
     * @example
     * // Count the number of AdminUsers
     * const count = await prisma.adminUser.count({
     *   where: {
     *     // ... the filter for the AdminUsers we want to count
     *   }
     * })
    **/
    count<T extends AdminUserCountArgs>(
      args?: Subset<T, AdminUserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AdminUserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AdminUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AdminUserAggregateArgs>(args: Subset<T, AdminUserAggregateArgs>): Prisma.PrismaPromise<GetAdminUserAggregateType<T>>

    /**
     * Group by AdminUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminUserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AdminUserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AdminUserGroupByArgs['orderBy'] }
        : { orderBy?: AdminUserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AdminUserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAdminUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AdminUser model
   */
  readonly fields: AdminUserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AdminUser.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AdminUserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    adminSessions<T extends AdminUser$adminSessionsArgs<ExtArgs> = {}>(args?: Subset<T, AdminUser$adminSessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    recoveryCodes<T extends AdminUser$recoveryCodesArgs<ExtArgs> = {}>(args?: Subset<T, AdminUser$recoveryCodesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    auditLogs<T extends AdminUser$auditLogsArgs<ExtArgs> = {}>(args?: Subset<T, AdminUser$auditLogsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AdminUser model
   */
  interface AdminUserFieldRefs {
    readonly id: FieldRef<"AdminUser", 'String'>
    readonly name: FieldRef<"AdminUser", 'String'>
    readonly email: FieldRef<"AdminUser", 'String'>
    readonly passwordHash: FieldRef<"AdminUser", 'String'>
    readonly role: FieldRef<"AdminUser", 'AdminRole'>
    readonly countryScope: FieldRef<"AdminUser", 'String[]'>
    readonly totpEnabled: FieldRef<"AdminUser", 'Boolean'>
    readonly totpSecretEncrypted: FieldRef<"AdminUser", 'String'>
    readonly fido2Credential: FieldRef<"AdminUser", 'Json'>
    readonly createdAt: FieldRef<"AdminUser", 'DateTime'>
    readonly updatedAt: FieldRef<"AdminUser", 'DateTime'>
    readonly cancellationCount: FieldRef<"AdminUser", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * AdminUser findUnique
   */
  export type AdminUserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter, which AdminUser to fetch.
     */
    where: AdminUserWhereUniqueInput
  }

  /**
   * AdminUser findUniqueOrThrow
   */
  export type AdminUserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter, which AdminUser to fetch.
     */
    where: AdminUserWhereUniqueInput
  }

  /**
   * AdminUser findFirst
   */
  export type AdminUserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter, which AdminUser to fetch.
     */
    where?: AdminUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminUsers to fetch.
     */
    orderBy?: AdminUserOrderByWithRelationInput | AdminUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminUsers.
     */
    cursor?: AdminUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminUsers.
     */
    distinct?: AdminUserScalarFieldEnum | AdminUserScalarFieldEnum[]
  }

  /**
   * AdminUser findFirstOrThrow
   */
  export type AdminUserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter, which AdminUser to fetch.
     */
    where?: AdminUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminUsers to fetch.
     */
    orderBy?: AdminUserOrderByWithRelationInput | AdminUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminUsers.
     */
    cursor?: AdminUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminUsers.
     */
    distinct?: AdminUserScalarFieldEnum | AdminUserScalarFieldEnum[]
  }

  /**
   * AdminUser findMany
   */
  export type AdminUserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter, which AdminUsers to fetch.
     */
    where?: AdminUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminUsers to fetch.
     */
    orderBy?: AdminUserOrderByWithRelationInput | AdminUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AdminUsers.
     */
    cursor?: AdminUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminUsers.
     */
    skip?: number
    distinct?: AdminUserScalarFieldEnum | AdminUserScalarFieldEnum[]
  }

  /**
   * AdminUser create
   */
  export type AdminUserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * The data needed to create a AdminUser.
     */
    data: XOR<AdminUserCreateInput, AdminUserUncheckedCreateInput>
  }

  /**
   * AdminUser createMany
   */
  export type AdminUserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AdminUsers.
     */
    data: AdminUserCreateManyInput | AdminUserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AdminUser createManyAndReturn
   */
  export type AdminUserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * The data used to create many AdminUsers.
     */
    data: AdminUserCreateManyInput | AdminUserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AdminUser update
   */
  export type AdminUserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * The data needed to update a AdminUser.
     */
    data: XOR<AdminUserUpdateInput, AdminUserUncheckedUpdateInput>
    /**
     * Choose, which AdminUser to update.
     */
    where: AdminUserWhereUniqueInput
  }

  /**
   * AdminUser updateMany
   */
  export type AdminUserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AdminUsers.
     */
    data: XOR<AdminUserUpdateManyMutationInput, AdminUserUncheckedUpdateManyInput>
    /**
     * Filter which AdminUsers to update
     */
    where?: AdminUserWhereInput
    /**
     * Limit how many AdminUsers to update.
     */
    limit?: number
  }

  /**
   * AdminUser updateManyAndReturn
   */
  export type AdminUserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * The data used to update AdminUsers.
     */
    data: XOR<AdminUserUpdateManyMutationInput, AdminUserUncheckedUpdateManyInput>
    /**
     * Filter which AdminUsers to update
     */
    where?: AdminUserWhereInput
    /**
     * Limit how many AdminUsers to update.
     */
    limit?: number
  }

  /**
   * AdminUser upsert
   */
  export type AdminUserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * The filter to search for the AdminUser to update in case it exists.
     */
    where: AdminUserWhereUniqueInput
    /**
     * In case the AdminUser found by the `where` argument doesn't exist, create a new AdminUser with this data.
     */
    create: XOR<AdminUserCreateInput, AdminUserUncheckedCreateInput>
    /**
     * In case the AdminUser was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AdminUserUpdateInput, AdminUserUncheckedUpdateInput>
  }

  /**
   * AdminUser delete
   */
  export type AdminUserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
    /**
     * Filter which AdminUser to delete.
     */
    where: AdminUserWhereUniqueInput
  }

  /**
   * AdminUser deleteMany
   */
  export type AdminUserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminUsers to delete
     */
    where?: AdminUserWhereInput
    /**
     * Limit how many AdminUsers to delete.
     */
    limit?: number
  }

  /**
   * AdminUser.adminSessions
   */
  export type AdminUser$adminSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    where?: AdminSessionWhereInput
    orderBy?: AdminSessionOrderByWithRelationInput | AdminSessionOrderByWithRelationInput[]
    cursor?: AdminSessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AdminSessionScalarFieldEnum | AdminSessionScalarFieldEnum[]
  }

  /**
   * AdminUser.recoveryCodes
   */
  export type AdminUser$recoveryCodesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    where?: AdminRecoveryCodeWhereInput
    orderBy?: AdminRecoveryCodeOrderByWithRelationInput | AdminRecoveryCodeOrderByWithRelationInput[]
    cursor?: AdminRecoveryCodeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AdminRecoveryCodeScalarFieldEnum | AdminRecoveryCodeScalarFieldEnum[]
  }

  /**
   * AdminUser.auditLogs
   */
  export type AdminUser$auditLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    where?: AuditLogWhereInput
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    cursor?: AuditLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AdminUser without action
   */
  export type AdminUserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminUser
     */
    select?: AdminUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminUser
     */
    omit?: AdminUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminUserInclude<ExtArgs> | null
  }


  /**
   * Model AdminSession
   */

  export type AggregateAdminSession = {
    _count: AdminSessionCountAggregateOutputType | null
    _min: AdminSessionMinAggregateOutputType | null
    _max: AdminSessionMaxAggregateOutputType | null
  }

  export type AdminSessionMinAggregateOutputType = {
    id: string | null
    adminUserId: string | null
    tokenHash: string | null
    revoked: boolean | null
    lastActiveAt: Date | null
    createdAt: Date | null
    expiresAt: Date | null
  }

  export type AdminSessionMaxAggregateOutputType = {
    id: string | null
    adminUserId: string | null
    tokenHash: string | null
    revoked: boolean | null
    lastActiveAt: Date | null
    createdAt: Date | null
    expiresAt: Date | null
  }

  export type AdminSessionCountAggregateOutputType = {
    id: number
    adminUserId: number
    tokenHash: number
    revoked: number
    lastActiveAt: number
    createdAt: number
    expiresAt: number
    _all: number
  }


  export type AdminSessionMinAggregateInputType = {
    id?: true
    adminUserId?: true
    tokenHash?: true
    revoked?: true
    lastActiveAt?: true
    createdAt?: true
    expiresAt?: true
  }

  export type AdminSessionMaxAggregateInputType = {
    id?: true
    adminUserId?: true
    tokenHash?: true
    revoked?: true
    lastActiveAt?: true
    createdAt?: true
    expiresAt?: true
  }

  export type AdminSessionCountAggregateInputType = {
    id?: true
    adminUserId?: true
    tokenHash?: true
    revoked?: true
    lastActiveAt?: true
    createdAt?: true
    expiresAt?: true
    _all?: true
  }

  export type AdminSessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminSession to aggregate.
     */
    where?: AdminSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminSessions to fetch.
     */
    orderBy?: AdminSessionOrderByWithRelationInput | AdminSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AdminSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AdminSessions
    **/
    _count?: true | AdminSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AdminSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AdminSessionMaxAggregateInputType
  }

  export type GetAdminSessionAggregateType<T extends AdminSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateAdminSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAdminSession[P]>
      : GetScalarType<T[P], AggregateAdminSession[P]>
  }




  export type AdminSessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminSessionWhereInput
    orderBy?: AdminSessionOrderByWithAggregationInput | AdminSessionOrderByWithAggregationInput[]
    by: AdminSessionScalarFieldEnum[] | AdminSessionScalarFieldEnum
    having?: AdminSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AdminSessionCountAggregateInputType | true
    _min?: AdminSessionMinAggregateInputType
    _max?: AdminSessionMaxAggregateInputType
  }

  export type AdminSessionGroupByOutputType = {
    id: string
    adminUserId: string
    tokenHash: string
    revoked: boolean
    lastActiveAt: Date
    createdAt: Date
    expiresAt: Date
    _count: AdminSessionCountAggregateOutputType | null
    _min: AdminSessionMinAggregateOutputType | null
    _max: AdminSessionMaxAggregateOutputType | null
  }

  type GetAdminSessionGroupByPayload<T extends AdminSessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AdminSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AdminSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AdminSessionGroupByOutputType[P]>
            : GetScalarType<T[P], AdminSessionGroupByOutputType[P]>
        }
      >
    >


  export type AdminSessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminSession"]>

  export type AdminSessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminSession"]>

  export type AdminSessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    expiresAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminSession"]>

  export type AdminSessionSelectScalar = {
    id?: boolean
    adminUserId?: boolean
    tokenHash?: boolean
    revoked?: boolean
    lastActiveAt?: boolean
    createdAt?: boolean
    expiresAt?: boolean
  }

  export type AdminSessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "adminUserId" | "tokenHash" | "revoked" | "lastActiveAt" | "createdAt" | "expiresAt", ExtArgs["result"]["adminSession"]>
  export type AdminSessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AdminSessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AdminSessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }

  export type $AdminSessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AdminSession"
    objects: {
      adminUser: Prisma.$AdminUserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      adminUserId: string
      tokenHash: string
      revoked: boolean
      lastActiveAt: Date
      createdAt: Date
      expiresAt: Date
    }, ExtArgs["result"]["adminSession"]>
    composites: {}
  }

  type AdminSessionGetPayload<S extends boolean | null | undefined | AdminSessionDefaultArgs> = $Result.GetResult<Prisma.$AdminSessionPayload, S>

  type AdminSessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AdminSessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AdminSessionCountAggregateInputType | true
    }

  export interface AdminSessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AdminSession'], meta: { name: 'AdminSession' } }
    /**
     * Find zero or one AdminSession that matches the filter.
     * @param {AdminSessionFindUniqueArgs} args - Arguments to find a AdminSession
     * @example
     * // Get one AdminSession
     * const adminSession = await prisma.adminSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AdminSessionFindUniqueArgs>(args: SelectSubset<T, AdminSessionFindUniqueArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AdminSession that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AdminSessionFindUniqueOrThrowArgs} args - Arguments to find a AdminSession
     * @example
     * // Get one AdminSession
     * const adminSession = await prisma.adminSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AdminSessionFindUniqueOrThrowArgs>(args: SelectSubset<T, AdminSessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionFindFirstArgs} args - Arguments to find a AdminSession
     * @example
     * // Get one AdminSession
     * const adminSession = await prisma.adminSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AdminSessionFindFirstArgs>(args?: SelectSubset<T, AdminSessionFindFirstArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminSession that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionFindFirstOrThrowArgs} args - Arguments to find a AdminSession
     * @example
     * // Get one AdminSession
     * const adminSession = await prisma.adminSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AdminSessionFindFirstOrThrowArgs>(args?: SelectSubset<T, AdminSessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AdminSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AdminSessions
     * const adminSessions = await prisma.adminSession.findMany()
     * 
     * // Get first 10 AdminSessions
     * const adminSessions = await prisma.adminSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const adminSessionWithIdOnly = await prisma.adminSession.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AdminSessionFindManyArgs>(args?: SelectSubset<T, AdminSessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AdminSession.
     * @param {AdminSessionCreateArgs} args - Arguments to create a AdminSession.
     * @example
     * // Create one AdminSession
     * const AdminSession = await prisma.adminSession.create({
     *   data: {
     *     // ... data to create a AdminSession
     *   }
     * })
     * 
     */
    create<T extends AdminSessionCreateArgs>(args: SelectSubset<T, AdminSessionCreateArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AdminSessions.
     * @param {AdminSessionCreateManyArgs} args - Arguments to create many AdminSessions.
     * @example
     * // Create many AdminSessions
     * const adminSession = await prisma.adminSession.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AdminSessionCreateManyArgs>(args?: SelectSubset<T, AdminSessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AdminSessions and returns the data saved in the database.
     * @param {AdminSessionCreateManyAndReturnArgs} args - Arguments to create many AdminSessions.
     * @example
     * // Create many AdminSessions
     * const adminSession = await prisma.adminSession.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AdminSessions and only return the `id`
     * const adminSessionWithIdOnly = await prisma.adminSession.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AdminSessionCreateManyAndReturnArgs>(args?: SelectSubset<T, AdminSessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AdminSession.
     * @param {AdminSessionDeleteArgs} args - Arguments to delete one AdminSession.
     * @example
     * // Delete one AdminSession
     * const AdminSession = await prisma.adminSession.delete({
     *   where: {
     *     // ... filter to delete one AdminSession
     *   }
     * })
     * 
     */
    delete<T extends AdminSessionDeleteArgs>(args: SelectSubset<T, AdminSessionDeleteArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AdminSession.
     * @param {AdminSessionUpdateArgs} args - Arguments to update one AdminSession.
     * @example
     * // Update one AdminSession
     * const adminSession = await prisma.adminSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AdminSessionUpdateArgs>(args: SelectSubset<T, AdminSessionUpdateArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AdminSessions.
     * @param {AdminSessionDeleteManyArgs} args - Arguments to filter AdminSessions to delete.
     * @example
     * // Delete a few AdminSessions
     * const { count } = await prisma.adminSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AdminSessionDeleteManyArgs>(args?: SelectSubset<T, AdminSessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AdminSessions
     * const adminSession = await prisma.adminSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AdminSessionUpdateManyArgs>(args: SelectSubset<T, AdminSessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminSessions and returns the data updated in the database.
     * @param {AdminSessionUpdateManyAndReturnArgs} args - Arguments to update many AdminSessions.
     * @example
     * // Update many AdminSessions
     * const adminSession = await prisma.adminSession.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AdminSessions and only return the `id`
     * const adminSessionWithIdOnly = await prisma.adminSession.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AdminSessionUpdateManyAndReturnArgs>(args: SelectSubset<T, AdminSessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AdminSession.
     * @param {AdminSessionUpsertArgs} args - Arguments to update or create a AdminSession.
     * @example
     * // Update or create a AdminSession
     * const adminSession = await prisma.adminSession.upsert({
     *   create: {
     *     // ... data to create a AdminSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AdminSession we want to update
     *   }
     * })
     */
    upsert<T extends AdminSessionUpsertArgs>(args: SelectSubset<T, AdminSessionUpsertArgs<ExtArgs>>): Prisma__AdminSessionClient<$Result.GetResult<Prisma.$AdminSessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AdminSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionCountArgs} args - Arguments to filter AdminSessions to count.
     * @example
     * // Count the number of AdminSessions
     * const count = await prisma.adminSession.count({
     *   where: {
     *     // ... the filter for the AdminSessions we want to count
     *   }
     * })
    **/
    count<T extends AdminSessionCountArgs>(
      args?: Subset<T, AdminSessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AdminSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AdminSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AdminSessionAggregateArgs>(args: Subset<T, AdminSessionAggregateArgs>): Prisma.PrismaPromise<GetAdminSessionAggregateType<T>>

    /**
     * Group by AdminSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AdminSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AdminSessionGroupByArgs['orderBy'] }
        : { orderBy?: AdminSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AdminSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAdminSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AdminSession model
   */
  readonly fields: AdminSessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AdminSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AdminSessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    adminUser<T extends AdminUserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AdminUserDefaultArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AdminSession model
   */
  interface AdminSessionFieldRefs {
    readonly id: FieldRef<"AdminSession", 'String'>
    readonly adminUserId: FieldRef<"AdminSession", 'String'>
    readonly tokenHash: FieldRef<"AdminSession", 'String'>
    readonly revoked: FieldRef<"AdminSession", 'Boolean'>
    readonly lastActiveAt: FieldRef<"AdminSession", 'DateTime'>
    readonly createdAt: FieldRef<"AdminSession", 'DateTime'>
    readonly expiresAt: FieldRef<"AdminSession", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AdminSession findUnique
   */
  export type AdminSessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter, which AdminSession to fetch.
     */
    where: AdminSessionWhereUniqueInput
  }

  /**
   * AdminSession findUniqueOrThrow
   */
  export type AdminSessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter, which AdminSession to fetch.
     */
    where: AdminSessionWhereUniqueInput
  }

  /**
   * AdminSession findFirst
   */
  export type AdminSessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter, which AdminSession to fetch.
     */
    where?: AdminSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminSessions to fetch.
     */
    orderBy?: AdminSessionOrderByWithRelationInput | AdminSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminSessions.
     */
    cursor?: AdminSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminSessions.
     */
    distinct?: AdminSessionScalarFieldEnum | AdminSessionScalarFieldEnum[]
  }

  /**
   * AdminSession findFirstOrThrow
   */
  export type AdminSessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter, which AdminSession to fetch.
     */
    where?: AdminSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminSessions to fetch.
     */
    orderBy?: AdminSessionOrderByWithRelationInput | AdminSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminSessions.
     */
    cursor?: AdminSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminSessions.
     */
    distinct?: AdminSessionScalarFieldEnum | AdminSessionScalarFieldEnum[]
  }

  /**
   * AdminSession findMany
   */
  export type AdminSessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter, which AdminSessions to fetch.
     */
    where?: AdminSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminSessions to fetch.
     */
    orderBy?: AdminSessionOrderByWithRelationInput | AdminSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AdminSessions.
     */
    cursor?: AdminSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminSessions.
     */
    skip?: number
    distinct?: AdminSessionScalarFieldEnum | AdminSessionScalarFieldEnum[]
  }

  /**
   * AdminSession create
   */
  export type AdminSessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * The data needed to create a AdminSession.
     */
    data: XOR<AdminSessionCreateInput, AdminSessionUncheckedCreateInput>
  }

  /**
   * AdminSession createMany
   */
  export type AdminSessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AdminSessions.
     */
    data: AdminSessionCreateManyInput | AdminSessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AdminSession createManyAndReturn
   */
  export type AdminSessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * The data used to create many AdminSessions.
     */
    data: AdminSessionCreateManyInput | AdminSessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminSession update
   */
  export type AdminSessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * The data needed to update a AdminSession.
     */
    data: XOR<AdminSessionUpdateInput, AdminSessionUncheckedUpdateInput>
    /**
     * Choose, which AdminSession to update.
     */
    where: AdminSessionWhereUniqueInput
  }

  /**
   * AdminSession updateMany
   */
  export type AdminSessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AdminSessions.
     */
    data: XOR<AdminSessionUpdateManyMutationInput, AdminSessionUncheckedUpdateManyInput>
    /**
     * Filter which AdminSessions to update
     */
    where?: AdminSessionWhereInput
    /**
     * Limit how many AdminSessions to update.
     */
    limit?: number
  }

  /**
   * AdminSession updateManyAndReturn
   */
  export type AdminSessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * The data used to update AdminSessions.
     */
    data: XOR<AdminSessionUpdateManyMutationInput, AdminSessionUncheckedUpdateManyInput>
    /**
     * Filter which AdminSessions to update
     */
    where?: AdminSessionWhereInput
    /**
     * Limit how many AdminSessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminSession upsert
   */
  export type AdminSessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * The filter to search for the AdminSession to update in case it exists.
     */
    where: AdminSessionWhereUniqueInput
    /**
     * In case the AdminSession found by the `where` argument doesn't exist, create a new AdminSession with this data.
     */
    create: XOR<AdminSessionCreateInput, AdminSessionUncheckedCreateInput>
    /**
     * In case the AdminSession was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AdminSessionUpdateInput, AdminSessionUncheckedUpdateInput>
  }

  /**
   * AdminSession delete
   */
  export type AdminSessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
    /**
     * Filter which AdminSession to delete.
     */
    where: AdminSessionWhereUniqueInput
  }

  /**
   * AdminSession deleteMany
   */
  export type AdminSessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminSessions to delete
     */
    where?: AdminSessionWhereInput
    /**
     * Limit how many AdminSessions to delete.
     */
    limit?: number
  }

  /**
   * AdminSession without action
   */
  export type AdminSessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminSession
     */
    select?: AdminSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminSession
     */
    omit?: AdminSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminSessionInclude<ExtArgs> | null
  }


  /**
   * Model AdminRecoveryCode
   */

  export type AggregateAdminRecoveryCode = {
    _count: AdminRecoveryCodeCountAggregateOutputType | null
    _min: AdminRecoveryCodeMinAggregateOutputType | null
    _max: AdminRecoveryCodeMaxAggregateOutputType | null
  }

  export type AdminRecoveryCodeMinAggregateOutputType = {
    id: string | null
    adminUserId: string | null
    codeHash: string | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type AdminRecoveryCodeMaxAggregateOutputType = {
    id: string | null
    adminUserId: string | null
    codeHash: string | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type AdminRecoveryCodeCountAggregateOutputType = {
    id: number
    adminUserId: number
    codeHash: number
    usedAt: number
    createdAt: number
    _all: number
  }


  export type AdminRecoveryCodeMinAggregateInputType = {
    id?: true
    adminUserId?: true
    codeHash?: true
    usedAt?: true
    createdAt?: true
  }

  export type AdminRecoveryCodeMaxAggregateInputType = {
    id?: true
    adminUserId?: true
    codeHash?: true
    usedAt?: true
    createdAt?: true
  }

  export type AdminRecoveryCodeCountAggregateInputType = {
    id?: true
    adminUserId?: true
    codeHash?: true
    usedAt?: true
    createdAt?: true
    _all?: true
  }

  export type AdminRecoveryCodeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminRecoveryCode to aggregate.
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminRecoveryCodes to fetch.
     */
    orderBy?: AdminRecoveryCodeOrderByWithRelationInput | AdminRecoveryCodeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AdminRecoveryCodeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminRecoveryCodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminRecoveryCodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AdminRecoveryCodes
    **/
    _count?: true | AdminRecoveryCodeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AdminRecoveryCodeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AdminRecoveryCodeMaxAggregateInputType
  }

  export type GetAdminRecoveryCodeAggregateType<T extends AdminRecoveryCodeAggregateArgs> = {
        [P in keyof T & keyof AggregateAdminRecoveryCode]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAdminRecoveryCode[P]>
      : GetScalarType<T[P], AggregateAdminRecoveryCode[P]>
  }




  export type AdminRecoveryCodeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminRecoveryCodeWhereInput
    orderBy?: AdminRecoveryCodeOrderByWithAggregationInput | AdminRecoveryCodeOrderByWithAggregationInput[]
    by: AdminRecoveryCodeScalarFieldEnum[] | AdminRecoveryCodeScalarFieldEnum
    having?: AdminRecoveryCodeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AdminRecoveryCodeCountAggregateInputType | true
    _min?: AdminRecoveryCodeMinAggregateInputType
    _max?: AdminRecoveryCodeMaxAggregateInputType
  }

  export type AdminRecoveryCodeGroupByOutputType = {
    id: string
    adminUserId: string
    codeHash: string
    usedAt: Date | null
    createdAt: Date
    _count: AdminRecoveryCodeCountAggregateOutputType | null
    _min: AdminRecoveryCodeMinAggregateOutputType | null
    _max: AdminRecoveryCodeMaxAggregateOutputType | null
  }

  type GetAdminRecoveryCodeGroupByPayload<T extends AdminRecoveryCodeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AdminRecoveryCodeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AdminRecoveryCodeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AdminRecoveryCodeGroupByOutputType[P]>
            : GetScalarType<T[P], AdminRecoveryCodeGroupByOutputType[P]>
        }
      >
    >


  export type AdminRecoveryCodeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    codeHash?: boolean
    usedAt?: boolean
    createdAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminRecoveryCode"]>

  export type AdminRecoveryCodeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    codeHash?: boolean
    usedAt?: boolean
    createdAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminRecoveryCode"]>

  export type AdminRecoveryCodeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminUserId?: boolean
    codeHash?: boolean
    usedAt?: boolean
    createdAt?: boolean
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminRecoveryCode"]>

  export type AdminRecoveryCodeSelectScalar = {
    id?: boolean
    adminUserId?: boolean
    codeHash?: boolean
    usedAt?: boolean
    createdAt?: boolean
  }

  export type AdminRecoveryCodeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "adminUserId" | "codeHash" | "usedAt" | "createdAt", ExtArgs["result"]["adminRecoveryCode"]>
  export type AdminRecoveryCodeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AdminRecoveryCodeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AdminRecoveryCodeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    adminUser?: boolean | AdminUserDefaultArgs<ExtArgs>
  }

  export type $AdminRecoveryCodePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AdminRecoveryCode"
    objects: {
      adminUser: Prisma.$AdminUserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      adminUserId: string
      codeHash: string
      usedAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["adminRecoveryCode"]>
    composites: {}
  }

  type AdminRecoveryCodeGetPayload<S extends boolean | null | undefined | AdminRecoveryCodeDefaultArgs> = $Result.GetResult<Prisma.$AdminRecoveryCodePayload, S>

  type AdminRecoveryCodeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AdminRecoveryCodeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AdminRecoveryCodeCountAggregateInputType | true
    }

  export interface AdminRecoveryCodeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AdminRecoveryCode'], meta: { name: 'AdminRecoveryCode' } }
    /**
     * Find zero or one AdminRecoveryCode that matches the filter.
     * @param {AdminRecoveryCodeFindUniqueArgs} args - Arguments to find a AdminRecoveryCode
     * @example
     * // Get one AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AdminRecoveryCodeFindUniqueArgs>(args: SelectSubset<T, AdminRecoveryCodeFindUniqueArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AdminRecoveryCode that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AdminRecoveryCodeFindUniqueOrThrowArgs} args - Arguments to find a AdminRecoveryCode
     * @example
     * // Get one AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AdminRecoveryCodeFindUniqueOrThrowArgs>(args: SelectSubset<T, AdminRecoveryCodeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminRecoveryCode that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeFindFirstArgs} args - Arguments to find a AdminRecoveryCode
     * @example
     * // Get one AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AdminRecoveryCodeFindFirstArgs>(args?: SelectSubset<T, AdminRecoveryCodeFindFirstArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminRecoveryCode that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeFindFirstOrThrowArgs} args - Arguments to find a AdminRecoveryCode
     * @example
     * // Get one AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AdminRecoveryCodeFindFirstOrThrowArgs>(args?: SelectSubset<T, AdminRecoveryCodeFindFirstOrThrowArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AdminRecoveryCodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AdminRecoveryCodes
     * const adminRecoveryCodes = await prisma.adminRecoveryCode.findMany()
     * 
     * // Get first 10 AdminRecoveryCodes
     * const adminRecoveryCodes = await prisma.adminRecoveryCode.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const adminRecoveryCodeWithIdOnly = await prisma.adminRecoveryCode.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AdminRecoveryCodeFindManyArgs>(args?: SelectSubset<T, AdminRecoveryCodeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AdminRecoveryCode.
     * @param {AdminRecoveryCodeCreateArgs} args - Arguments to create a AdminRecoveryCode.
     * @example
     * // Create one AdminRecoveryCode
     * const AdminRecoveryCode = await prisma.adminRecoveryCode.create({
     *   data: {
     *     // ... data to create a AdminRecoveryCode
     *   }
     * })
     * 
     */
    create<T extends AdminRecoveryCodeCreateArgs>(args: SelectSubset<T, AdminRecoveryCodeCreateArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AdminRecoveryCodes.
     * @param {AdminRecoveryCodeCreateManyArgs} args - Arguments to create many AdminRecoveryCodes.
     * @example
     * // Create many AdminRecoveryCodes
     * const adminRecoveryCode = await prisma.adminRecoveryCode.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AdminRecoveryCodeCreateManyArgs>(args?: SelectSubset<T, AdminRecoveryCodeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AdminRecoveryCodes and returns the data saved in the database.
     * @param {AdminRecoveryCodeCreateManyAndReturnArgs} args - Arguments to create many AdminRecoveryCodes.
     * @example
     * // Create many AdminRecoveryCodes
     * const adminRecoveryCode = await prisma.adminRecoveryCode.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AdminRecoveryCodes and only return the `id`
     * const adminRecoveryCodeWithIdOnly = await prisma.adminRecoveryCode.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AdminRecoveryCodeCreateManyAndReturnArgs>(args?: SelectSubset<T, AdminRecoveryCodeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AdminRecoveryCode.
     * @param {AdminRecoveryCodeDeleteArgs} args - Arguments to delete one AdminRecoveryCode.
     * @example
     * // Delete one AdminRecoveryCode
     * const AdminRecoveryCode = await prisma.adminRecoveryCode.delete({
     *   where: {
     *     // ... filter to delete one AdminRecoveryCode
     *   }
     * })
     * 
     */
    delete<T extends AdminRecoveryCodeDeleteArgs>(args: SelectSubset<T, AdminRecoveryCodeDeleteArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AdminRecoveryCode.
     * @param {AdminRecoveryCodeUpdateArgs} args - Arguments to update one AdminRecoveryCode.
     * @example
     * // Update one AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AdminRecoveryCodeUpdateArgs>(args: SelectSubset<T, AdminRecoveryCodeUpdateArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AdminRecoveryCodes.
     * @param {AdminRecoveryCodeDeleteManyArgs} args - Arguments to filter AdminRecoveryCodes to delete.
     * @example
     * // Delete a few AdminRecoveryCodes
     * const { count } = await prisma.adminRecoveryCode.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AdminRecoveryCodeDeleteManyArgs>(args?: SelectSubset<T, AdminRecoveryCodeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminRecoveryCodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AdminRecoveryCodes
     * const adminRecoveryCode = await prisma.adminRecoveryCode.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AdminRecoveryCodeUpdateManyArgs>(args: SelectSubset<T, AdminRecoveryCodeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminRecoveryCodes and returns the data updated in the database.
     * @param {AdminRecoveryCodeUpdateManyAndReturnArgs} args - Arguments to update many AdminRecoveryCodes.
     * @example
     * // Update many AdminRecoveryCodes
     * const adminRecoveryCode = await prisma.adminRecoveryCode.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AdminRecoveryCodes and only return the `id`
     * const adminRecoveryCodeWithIdOnly = await prisma.adminRecoveryCode.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AdminRecoveryCodeUpdateManyAndReturnArgs>(args: SelectSubset<T, AdminRecoveryCodeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AdminRecoveryCode.
     * @param {AdminRecoveryCodeUpsertArgs} args - Arguments to update or create a AdminRecoveryCode.
     * @example
     * // Update or create a AdminRecoveryCode
     * const adminRecoveryCode = await prisma.adminRecoveryCode.upsert({
     *   create: {
     *     // ... data to create a AdminRecoveryCode
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AdminRecoveryCode we want to update
     *   }
     * })
     */
    upsert<T extends AdminRecoveryCodeUpsertArgs>(args: SelectSubset<T, AdminRecoveryCodeUpsertArgs<ExtArgs>>): Prisma__AdminRecoveryCodeClient<$Result.GetResult<Prisma.$AdminRecoveryCodePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AdminRecoveryCodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeCountArgs} args - Arguments to filter AdminRecoveryCodes to count.
     * @example
     * // Count the number of AdminRecoveryCodes
     * const count = await prisma.adminRecoveryCode.count({
     *   where: {
     *     // ... the filter for the AdminRecoveryCodes we want to count
     *   }
     * })
    **/
    count<T extends AdminRecoveryCodeCountArgs>(
      args?: Subset<T, AdminRecoveryCodeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AdminRecoveryCodeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AdminRecoveryCode.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AdminRecoveryCodeAggregateArgs>(args: Subset<T, AdminRecoveryCodeAggregateArgs>): Prisma.PrismaPromise<GetAdminRecoveryCodeAggregateType<T>>

    /**
     * Group by AdminRecoveryCode.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminRecoveryCodeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AdminRecoveryCodeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AdminRecoveryCodeGroupByArgs['orderBy'] }
        : { orderBy?: AdminRecoveryCodeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AdminRecoveryCodeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAdminRecoveryCodeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AdminRecoveryCode model
   */
  readonly fields: AdminRecoveryCodeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AdminRecoveryCode.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AdminRecoveryCodeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    adminUser<T extends AdminUserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AdminUserDefaultArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AdminRecoveryCode model
   */
  interface AdminRecoveryCodeFieldRefs {
    readonly id: FieldRef<"AdminRecoveryCode", 'String'>
    readonly adminUserId: FieldRef<"AdminRecoveryCode", 'String'>
    readonly codeHash: FieldRef<"AdminRecoveryCode", 'String'>
    readonly usedAt: FieldRef<"AdminRecoveryCode", 'DateTime'>
    readonly createdAt: FieldRef<"AdminRecoveryCode", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AdminRecoveryCode findUnique
   */
  export type AdminRecoveryCodeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter, which AdminRecoveryCode to fetch.
     */
    where: AdminRecoveryCodeWhereUniqueInput
  }

  /**
   * AdminRecoveryCode findUniqueOrThrow
   */
  export type AdminRecoveryCodeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter, which AdminRecoveryCode to fetch.
     */
    where: AdminRecoveryCodeWhereUniqueInput
  }

  /**
   * AdminRecoveryCode findFirst
   */
  export type AdminRecoveryCodeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter, which AdminRecoveryCode to fetch.
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminRecoveryCodes to fetch.
     */
    orderBy?: AdminRecoveryCodeOrderByWithRelationInput | AdminRecoveryCodeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminRecoveryCodes.
     */
    cursor?: AdminRecoveryCodeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminRecoveryCodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminRecoveryCodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminRecoveryCodes.
     */
    distinct?: AdminRecoveryCodeScalarFieldEnum | AdminRecoveryCodeScalarFieldEnum[]
  }

  /**
   * AdminRecoveryCode findFirstOrThrow
   */
  export type AdminRecoveryCodeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter, which AdminRecoveryCode to fetch.
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminRecoveryCodes to fetch.
     */
    orderBy?: AdminRecoveryCodeOrderByWithRelationInput | AdminRecoveryCodeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminRecoveryCodes.
     */
    cursor?: AdminRecoveryCodeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminRecoveryCodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminRecoveryCodes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminRecoveryCodes.
     */
    distinct?: AdminRecoveryCodeScalarFieldEnum | AdminRecoveryCodeScalarFieldEnum[]
  }

  /**
   * AdminRecoveryCode findMany
   */
  export type AdminRecoveryCodeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter, which AdminRecoveryCodes to fetch.
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminRecoveryCodes to fetch.
     */
    orderBy?: AdminRecoveryCodeOrderByWithRelationInput | AdminRecoveryCodeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AdminRecoveryCodes.
     */
    cursor?: AdminRecoveryCodeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminRecoveryCodes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminRecoveryCodes.
     */
    skip?: number
    distinct?: AdminRecoveryCodeScalarFieldEnum | AdminRecoveryCodeScalarFieldEnum[]
  }

  /**
   * AdminRecoveryCode create
   */
  export type AdminRecoveryCodeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * The data needed to create a AdminRecoveryCode.
     */
    data: XOR<AdminRecoveryCodeCreateInput, AdminRecoveryCodeUncheckedCreateInput>
  }

  /**
   * AdminRecoveryCode createMany
   */
  export type AdminRecoveryCodeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AdminRecoveryCodes.
     */
    data: AdminRecoveryCodeCreateManyInput | AdminRecoveryCodeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AdminRecoveryCode createManyAndReturn
   */
  export type AdminRecoveryCodeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * The data used to create many AdminRecoveryCodes.
     */
    data: AdminRecoveryCodeCreateManyInput | AdminRecoveryCodeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminRecoveryCode update
   */
  export type AdminRecoveryCodeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * The data needed to update a AdminRecoveryCode.
     */
    data: XOR<AdminRecoveryCodeUpdateInput, AdminRecoveryCodeUncheckedUpdateInput>
    /**
     * Choose, which AdminRecoveryCode to update.
     */
    where: AdminRecoveryCodeWhereUniqueInput
  }

  /**
   * AdminRecoveryCode updateMany
   */
  export type AdminRecoveryCodeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AdminRecoveryCodes.
     */
    data: XOR<AdminRecoveryCodeUpdateManyMutationInput, AdminRecoveryCodeUncheckedUpdateManyInput>
    /**
     * Filter which AdminRecoveryCodes to update
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * Limit how many AdminRecoveryCodes to update.
     */
    limit?: number
  }

  /**
   * AdminRecoveryCode updateManyAndReturn
   */
  export type AdminRecoveryCodeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * The data used to update AdminRecoveryCodes.
     */
    data: XOR<AdminRecoveryCodeUpdateManyMutationInput, AdminRecoveryCodeUncheckedUpdateManyInput>
    /**
     * Filter which AdminRecoveryCodes to update
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * Limit how many AdminRecoveryCodes to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminRecoveryCode upsert
   */
  export type AdminRecoveryCodeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * The filter to search for the AdminRecoveryCode to update in case it exists.
     */
    where: AdminRecoveryCodeWhereUniqueInput
    /**
     * In case the AdminRecoveryCode found by the `where` argument doesn't exist, create a new AdminRecoveryCode with this data.
     */
    create: XOR<AdminRecoveryCodeCreateInput, AdminRecoveryCodeUncheckedCreateInput>
    /**
     * In case the AdminRecoveryCode was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AdminRecoveryCodeUpdateInput, AdminRecoveryCodeUncheckedUpdateInput>
  }

  /**
   * AdminRecoveryCode delete
   */
  export type AdminRecoveryCodeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
    /**
     * Filter which AdminRecoveryCode to delete.
     */
    where: AdminRecoveryCodeWhereUniqueInput
  }

  /**
   * AdminRecoveryCode deleteMany
   */
  export type AdminRecoveryCodeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminRecoveryCodes to delete
     */
    where?: AdminRecoveryCodeWhereInput
    /**
     * Limit how many AdminRecoveryCodes to delete.
     */
    limit?: number
  }

  /**
   * AdminRecoveryCode without action
   */
  export type AdminRecoveryCodeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminRecoveryCode
     */
    select?: AdminRecoveryCodeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminRecoveryCode
     */
    omit?: AdminRecoveryCodeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminRecoveryCodeInclude<ExtArgs> | null
  }


  /**
   * Model AuditLog
   */

  export type AggregateAuditLog = {
    _count: AuditLogCountAggregateOutputType | null
    _min: AuditLogMinAggregateOutputType | null
    _max: AuditLogMaxAggregateOutputType | null
  }

  export type AuditLogMinAggregateOutputType = {
    id: string | null
    adminId: string | null
    role: string | null
    action: string | null
    targetType: string | null
    targetId: string | null
    oldValue: string | null
    newValue: string | null
    ipAddress: string | null
    timestamp: Date | null
  }

  export type AuditLogMaxAggregateOutputType = {
    id: string | null
    adminId: string | null
    role: string | null
    action: string | null
    targetType: string | null
    targetId: string | null
    oldValue: string | null
    newValue: string | null
    ipAddress: string | null
    timestamp: Date | null
  }

  export type AuditLogCountAggregateOutputType = {
    id: number
    adminId: number
    role: number
    action: number
    targetType: number
    targetId: number
    oldValue: number
    newValue: number
    ipAddress: number
    timestamp: number
    _all: number
  }


  export type AuditLogMinAggregateInputType = {
    id?: true
    adminId?: true
    role?: true
    action?: true
    targetType?: true
    targetId?: true
    oldValue?: true
    newValue?: true
    ipAddress?: true
    timestamp?: true
  }

  export type AuditLogMaxAggregateInputType = {
    id?: true
    adminId?: true
    role?: true
    action?: true
    targetType?: true
    targetId?: true
    oldValue?: true
    newValue?: true
    ipAddress?: true
    timestamp?: true
  }

  export type AuditLogCountAggregateInputType = {
    id?: true
    adminId?: true
    role?: true
    action?: true
    targetType?: true
    targetId?: true
    oldValue?: true
    newValue?: true
    ipAddress?: true
    timestamp?: true
    _all?: true
  }

  export type AuditLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuditLog to aggregate.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AuditLogs
    **/
    _count?: true | AuditLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AuditLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AuditLogMaxAggregateInputType
  }

  export type GetAuditLogAggregateType<T extends AuditLogAggregateArgs> = {
        [P in keyof T & keyof AggregateAuditLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAuditLog[P]>
      : GetScalarType<T[P], AggregateAuditLog[P]>
  }




  export type AuditLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AuditLogWhereInput
    orderBy?: AuditLogOrderByWithAggregationInput | AuditLogOrderByWithAggregationInput[]
    by: AuditLogScalarFieldEnum[] | AuditLogScalarFieldEnum
    having?: AuditLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AuditLogCountAggregateInputType | true
    _min?: AuditLogMinAggregateInputType
    _max?: AuditLogMaxAggregateInputType
  }

  export type AuditLogGroupByOutputType = {
    id: string
    adminId: string
    role: string
    action: string
    targetType: string | null
    targetId: string | null
    oldValue: string | null
    newValue: string | null
    ipAddress: string
    timestamp: Date
    _count: AuditLogCountAggregateOutputType | null
    _min: AuditLogMinAggregateOutputType | null
    _max: AuditLogMaxAggregateOutputType | null
  }

  type GetAuditLogGroupByPayload<T extends AuditLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AuditLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AuditLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AuditLogGroupByOutputType[P]>
            : GetScalarType<T[P], AuditLogGroupByOutputType[P]>
        }
      >
    >


  export type AuditLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminId?: boolean
    role?: boolean
    action?: boolean
    targetType?: boolean
    targetId?: boolean
    oldValue?: boolean
    newValue?: boolean
    ipAddress?: boolean
    timestamp?: boolean
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["auditLog"]>

  export type AuditLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminId?: boolean
    role?: boolean
    action?: boolean
    targetType?: boolean
    targetId?: boolean
    oldValue?: boolean
    newValue?: boolean
    ipAddress?: boolean
    timestamp?: boolean
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["auditLog"]>

  export type AuditLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    adminId?: boolean
    role?: boolean
    action?: boolean
    targetType?: boolean
    targetId?: boolean
    oldValue?: boolean
    newValue?: boolean
    ipAddress?: boolean
    timestamp?: boolean
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["auditLog"]>

  export type AuditLogSelectScalar = {
    id?: boolean
    adminId?: boolean
    role?: boolean
    action?: boolean
    targetType?: boolean
    targetId?: boolean
    oldValue?: boolean
    newValue?: boolean
    ipAddress?: boolean
    timestamp?: boolean
  }

  export type AuditLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "adminId" | "role" | "action" | "targetType" | "targetId" | "oldValue" | "newValue" | "ipAddress" | "timestamp", ExtArgs["result"]["auditLog"]>
  export type AuditLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AuditLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }
  export type AuditLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    admin?: boolean | AdminUserDefaultArgs<ExtArgs>
  }

  export type $AuditLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AuditLog"
    objects: {
      admin: Prisma.$AdminUserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      adminId: string
      role: string
      action: string
      targetType: string | null
      targetId: string | null
      oldValue: string | null
      newValue: string | null
      ipAddress: string
      timestamp: Date
    }, ExtArgs["result"]["auditLog"]>
    composites: {}
  }

  type AuditLogGetPayload<S extends boolean | null | undefined | AuditLogDefaultArgs> = $Result.GetResult<Prisma.$AuditLogPayload, S>

  type AuditLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AuditLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AuditLogCountAggregateInputType | true
    }

  export interface AuditLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AuditLog'], meta: { name: 'AuditLog' } }
    /**
     * Find zero or one AuditLog that matches the filter.
     * @param {AuditLogFindUniqueArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AuditLogFindUniqueArgs>(args: SelectSubset<T, AuditLogFindUniqueArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AuditLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AuditLogFindUniqueOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AuditLogFindUniqueOrThrowArgs>(args: SelectSubset<T, AuditLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AuditLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AuditLogFindFirstArgs>(args?: SelectSubset<T, AuditLogFindFirstArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AuditLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AuditLogFindFirstOrThrowArgs>(args?: SelectSubset<T, AuditLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AuditLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AuditLogs
     * const auditLogs = await prisma.auditLog.findMany()
     * 
     * // Get first 10 AuditLogs
     * const auditLogs = await prisma.auditLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AuditLogFindManyArgs>(args?: SelectSubset<T, AuditLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AuditLog.
     * @param {AuditLogCreateArgs} args - Arguments to create a AuditLog.
     * @example
     * // Create one AuditLog
     * const AuditLog = await prisma.auditLog.create({
     *   data: {
     *     // ... data to create a AuditLog
     *   }
     * })
     * 
     */
    create<T extends AuditLogCreateArgs>(args: SelectSubset<T, AuditLogCreateArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AuditLogs.
     * @param {AuditLogCreateManyArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AuditLogCreateManyArgs>(args?: SelectSubset<T, AuditLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AuditLogs and returns the data saved in the database.
     * @param {AuditLogCreateManyAndReturnArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AuditLogs and only return the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AuditLogCreateManyAndReturnArgs>(args?: SelectSubset<T, AuditLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AuditLog.
     * @param {AuditLogDeleteArgs} args - Arguments to delete one AuditLog.
     * @example
     * // Delete one AuditLog
     * const AuditLog = await prisma.auditLog.delete({
     *   where: {
     *     // ... filter to delete one AuditLog
     *   }
     * })
     * 
     */
    delete<T extends AuditLogDeleteArgs>(args: SelectSubset<T, AuditLogDeleteArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AuditLog.
     * @param {AuditLogUpdateArgs} args - Arguments to update one AuditLog.
     * @example
     * // Update one AuditLog
     * const auditLog = await prisma.auditLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AuditLogUpdateArgs>(args: SelectSubset<T, AuditLogUpdateArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AuditLogs.
     * @param {AuditLogDeleteManyArgs} args - Arguments to filter AuditLogs to delete.
     * @example
     * // Delete a few AuditLogs
     * const { count } = await prisma.auditLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AuditLogDeleteManyArgs>(args?: SelectSubset<T, AuditLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AuditLogs
     * const auditLog = await prisma.auditLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AuditLogUpdateManyArgs>(args: SelectSubset<T, AuditLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AuditLogs and returns the data updated in the database.
     * @param {AuditLogUpdateManyAndReturnArgs} args - Arguments to update many AuditLogs.
     * @example
     * // Update many AuditLogs
     * const auditLog = await prisma.auditLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AuditLogs and only return the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AuditLogUpdateManyAndReturnArgs>(args: SelectSubset<T, AuditLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AuditLog.
     * @param {AuditLogUpsertArgs} args - Arguments to update or create a AuditLog.
     * @example
     * // Update or create a AuditLog
     * const auditLog = await prisma.auditLog.upsert({
     *   create: {
     *     // ... data to create a AuditLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AuditLog we want to update
     *   }
     * })
     */
    upsert<T extends AuditLogUpsertArgs>(args: SelectSubset<T, AuditLogUpsertArgs<ExtArgs>>): Prisma__AuditLogClient<$Result.GetResult<Prisma.$AuditLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogCountArgs} args - Arguments to filter AuditLogs to count.
     * @example
     * // Count the number of AuditLogs
     * const count = await prisma.auditLog.count({
     *   where: {
     *     // ... the filter for the AuditLogs we want to count
     *   }
     * })
    **/
    count<T extends AuditLogCountArgs>(
      args?: Subset<T, AuditLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AuditLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AuditLogAggregateArgs>(args: Subset<T, AuditLogAggregateArgs>): Prisma.PrismaPromise<GetAuditLogAggregateType<T>>

    /**
     * Group by AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AuditLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AuditLogGroupByArgs['orderBy'] }
        : { orderBy?: AuditLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AuditLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAuditLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AuditLog model
   */
  readonly fields: AuditLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AuditLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AuditLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    admin<T extends AdminUserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AdminUserDefaultArgs<ExtArgs>>): Prisma__AdminUserClient<$Result.GetResult<Prisma.$AdminUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AuditLog model
   */
  interface AuditLogFieldRefs {
    readonly id: FieldRef<"AuditLog", 'String'>
    readonly adminId: FieldRef<"AuditLog", 'String'>
    readonly role: FieldRef<"AuditLog", 'String'>
    readonly action: FieldRef<"AuditLog", 'String'>
    readonly targetType: FieldRef<"AuditLog", 'String'>
    readonly targetId: FieldRef<"AuditLog", 'String'>
    readonly oldValue: FieldRef<"AuditLog", 'String'>
    readonly newValue: FieldRef<"AuditLog", 'String'>
    readonly ipAddress: FieldRef<"AuditLog", 'String'>
    readonly timestamp: FieldRef<"AuditLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AuditLog findUnique
   */
  export type AuditLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog findUniqueOrThrow
   */
  export type AuditLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog findFirst
   */
  export type AuditLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog findFirstOrThrow
   */
  export type AuditLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog findMany
   */
  export type AuditLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter, which AuditLogs to fetch.
     */
    where?: AuditLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?: AuditLogOrderByWithRelationInput | AuditLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuditLogs.
     */
    skip?: number
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[]
  }

  /**
   * AuditLog create
   */
  export type AuditLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * The data needed to create a AuditLog.
     */
    data: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>
  }

  /**
   * AuditLog createMany
   */
  export type AuditLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AuditLog createManyAndReturn
   */
  export type AuditLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AuditLog update
   */
  export type AuditLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * The data needed to update a AuditLog.
     */
    data: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>
    /**
     * Choose, which AuditLog to update.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog updateMany
   */
  export type AuditLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AuditLogs.
     */
    data: XOR<AuditLogUpdateManyMutationInput, AuditLogUncheckedUpdateManyInput>
    /**
     * Filter which AuditLogs to update
     */
    where?: AuditLogWhereInput
    /**
     * Limit how many AuditLogs to update.
     */
    limit?: number
  }

  /**
   * AuditLog updateManyAndReturn
   */
  export type AuditLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * The data used to update AuditLogs.
     */
    data: XOR<AuditLogUpdateManyMutationInput, AuditLogUncheckedUpdateManyInput>
    /**
     * Filter which AuditLogs to update
     */
    where?: AuditLogWhereInput
    /**
     * Limit how many AuditLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AuditLog upsert
   */
  export type AuditLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * The filter to search for the AuditLog to update in case it exists.
     */
    where: AuditLogWhereUniqueInput
    /**
     * In case the AuditLog found by the `where` argument doesn't exist, create a new AuditLog with this data.
     */
    create: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>
    /**
     * In case the AuditLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>
  }

  /**
   * AuditLog delete
   */
  export type AuditLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
    /**
     * Filter which AuditLog to delete.
     */
    where: AuditLogWhereUniqueInput
  }

  /**
   * AuditLog deleteMany
   */
  export type AuditLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuditLogs to delete
     */
    where?: AuditLogWhereInput
    /**
     * Limit how many AuditLogs to delete.
     */
    limit?: number
  }

  /**
   * AuditLog without action
   */
  export type AuditLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    firstName: 'firstName',
    lastName: 'lastName',
    email: 'email',
    passwordHash: 'passwordHash',
    status: 'status',
    userType: 'userType',
    businessName: 'businessName',
    country: 'country',
    emailVerified: 'emailVerified',
    emailVerifiedAt: 'emailVerifiedAt',
    oauthProvider: 'oauthProvider',
    oauthSub: 'oauthSub',
    oauthRevoked: 'oauthRevoked',
    currentTier: 'currentTier',
    loyaltyPoints: 'loyaltyPoints',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const VerificationTokenScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    tokenType: 'tokenType',
    expiresAt: 'expiresAt',
    used: 'used',
    usedAt: 'usedAt',
    invalidatedReason: 'invalidatedReason',
    createdAt: 'createdAt'
  };

  export type VerificationTokenScalarFieldEnum = (typeof VerificationTokenScalarFieldEnum)[keyof typeof VerificationTokenScalarFieldEnum]


  export const SessionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    revoked: 'revoked',
    createdAt: 'createdAt',
    expiresAt: 'expiresAt'
  };

  export type SessionScalarFieldEnum = (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum]


  export const EmailLogScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    recipient: 'recipient',
    status: 'status',
    sendgridMsgId: 'sendgridMsgId',
    sentAt: 'sentAt',
    createdAt: 'createdAt'
  };

  export type EmailLogScalarFieldEnum = (typeof EmailLogScalarFieldEnum)[keyof typeof EmailLogScalarFieldEnum]


  export const AdminUserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    passwordHash: 'passwordHash',
    role: 'role',
    countryScope: 'countryScope',
    totpEnabled: 'totpEnabled',
    totpSecretEncrypted: 'totpSecretEncrypted',
    fido2Credential: 'fido2Credential',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    cancellationCount: 'cancellationCount'
  };

  export type AdminUserScalarFieldEnum = (typeof AdminUserScalarFieldEnum)[keyof typeof AdminUserScalarFieldEnum]


  export const AdminSessionScalarFieldEnum: {
    id: 'id',
    adminUserId: 'adminUserId',
    tokenHash: 'tokenHash',
    revoked: 'revoked',
    lastActiveAt: 'lastActiveAt',
    createdAt: 'createdAt',
    expiresAt: 'expiresAt'
  };

  export type AdminSessionScalarFieldEnum = (typeof AdminSessionScalarFieldEnum)[keyof typeof AdminSessionScalarFieldEnum]


  export const AdminRecoveryCodeScalarFieldEnum: {
    id: 'id',
    adminUserId: 'adminUserId',
    codeHash: 'codeHash',
    usedAt: 'usedAt',
    createdAt: 'createdAt'
  };

  export type AdminRecoveryCodeScalarFieldEnum = (typeof AdminRecoveryCodeScalarFieldEnum)[keyof typeof AdminRecoveryCodeScalarFieldEnum]


  export const AuditLogScalarFieldEnum: {
    id: 'id',
    adminId: 'adminId',
    role: 'role',
    action: 'action',
    targetType: 'targetType',
    targetId: 'targetId',
    oldValue: 'oldValue',
    newValue: 'newValue',
    ipAddress: 'ipAddress',
    timestamp: 'timestamp'
  };

  export type AuditLogScalarFieldEnum = (typeof AuditLogScalarFieldEnum)[keyof typeof AuditLogScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'UserStatus'
   */
  export type EnumUserStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserStatus'>
    


  /**
   * Reference to a field of type 'UserStatus[]'
   */
  export type ListEnumUserStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserStatus[]'>
    


  /**
   * Reference to a field of type 'UserType'
   */
  export type EnumUserTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserType'>
    


  /**
   * Reference to a field of type 'UserType[]'
   */
  export type ListEnumUserTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserType[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'OAuthProvider'
   */
  export type EnumOAuthProviderFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OAuthProvider'>
    


  /**
   * Reference to a field of type 'OAuthProvider[]'
   */
  export type ListEnumOAuthProviderFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OAuthProvider[]'>
    


  /**
   * Reference to a field of type 'LoyaltyTier'
   */
  export type EnumLoyaltyTierFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'LoyaltyTier'>
    


  /**
   * Reference to a field of type 'LoyaltyTier[]'
   */
  export type ListEnumLoyaltyTierFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'LoyaltyTier[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'TokenType'
   */
  export type EnumTokenTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TokenType'>
    


  /**
   * Reference to a field of type 'TokenType[]'
   */
  export type ListEnumTokenTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TokenType[]'>
    


  /**
   * Reference to a field of type 'EmailLogType'
   */
  export type EnumEmailLogTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmailLogType'>
    


  /**
   * Reference to a field of type 'EmailLogType[]'
   */
  export type ListEnumEmailLogTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmailLogType[]'>
    


  /**
   * Reference to a field of type 'EmailLogStatus'
   */
  export type EnumEmailLogStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmailLogStatus'>
    


  /**
   * Reference to a field of type 'EmailLogStatus[]'
   */
  export type ListEnumEmailLogStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmailLogStatus[]'>
    


  /**
   * Reference to a field of type 'AdminRole'
   */
  export type EnumAdminRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AdminRole'>
    


  /**
   * Reference to a field of type 'AdminRole[]'
   */
  export type ListEnumAdminRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AdminRole[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    firstName?: StringFilter<"User"> | string
    lastName?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    passwordHash?: StringNullableFilter<"User"> | string | null
    status?: EnumUserStatusFilter<"User"> | $Enums.UserStatus
    userType?: EnumUserTypeFilter<"User"> | $Enums.UserType
    businessName?: StringNullableFilter<"User"> | string | null
    country?: StringNullableFilter<"User"> | string | null
    emailVerified?: BoolFilter<"User"> | boolean
    emailVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    oauthProvider?: EnumOAuthProviderNullableFilter<"User"> | $Enums.OAuthProvider | null
    oauthSub?: StringNullableFilter<"User"> | string | null
    oauthRevoked?: BoolFilter<"User"> | boolean
    currentTier?: EnumLoyaltyTierFilter<"User"> | $Enums.LoyaltyTier
    loyaltyPoints?: IntFilter<"User"> | number
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    verificationTokens?: VerificationTokenListRelationFilter
    sessions?: SessionListRelationFilter
    emailLogs?: EmailLogListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrderInput | SortOrder
    status?: SortOrder
    userType?: SortOrder
    businessName?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    emailVerified?: SortOrder
    emailVerifiedAt?: SortOrderInput | SortOrder
    oauthProvider?: SortOrderInput | SortOrder
    oauthSub?: SortOrderInput | SortOrder
    oauthRevoked?: SortOrder
    currentTier?: SortOrder
    loyaltyPoints?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    verificationTokens?: VerificationTokenOrderByRelationAggregateInput
    sessions?: SessionOrderByRelationAggregateInput
    emailLogs?: EmailLogOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    oauthProvider_oauthSub?: UserOauthProviderOauthSubCompoundUniqueInput
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    firstName?: StringFilter<"User"> | string
    lastName?: StringFilter<"User"> | string
    passwordHash?: StringNullableFilter<"User"> | string | null
    status?: EnumUserStatusFilter<"User"> | $Enums.UserStatus
    userType?: EnumUserTypeFilter<"User"> | $Enums.UserType
    businessName?: StringNullableFilter<"User"> | string | null
    country?: StringNullableFilter<"User"> | string | null
    emailVerified?: BoolFilter<"User"> | boolean
    emailVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    oauthProvider?: EnumOAuthProviderNullableFilter<"User"> | $Enums.OAuthProvider | null
    oauthSub?: StringNullableFilter<"User"> | string | null
    oauthRevoked?: BoolFilter<"User"> | boolean
    currentTier?: EnumLoyaltyTierFilter<"User"> | $Enums.LoyaltyTier
    loyaltyPoints?: IntFilter<"User"> | number
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    verificationTokens?: VerificationTokenListRelationFilter
    sessions?: SessionListRelationFilter
    emailLogs?: EmailLogListRelationFilter
  }, "id" | "email" | "oauthProvider_oauthSub">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrderInput | SortOrder
    status?: SortOrder
    userType?: SortOrder
    businessName?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    emailVerified?: SortOrder
    emailVerifiedAt?: SortOrderInput | SortOrder
    oauthProvider?: SortOrderInput | SortOrder
    oauthSub?: SortOrderInput | SortOrder
    oauthRevoked?: SortOrder
    currentTier?: SortOrder
    loyaltyPoints?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    firstName?: StringWithAggregatesFilter<"User"> | string
    lastName?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    passwordHash?: StringNullableWithAggregatesFilter<"User"> | string | null
    status?: EnumUserStatusWithAggregatesFilter<"User"> | $Enums.UserStatus
    userType?: EnumUserTypeWithAggregatesFilter<"User"> | $Enums.UserType
    businessName?: StringNullableWithAggregatesFilter<"User"> | string | null
    country?: StringNullableWithAggregatesFilter<"User"> | string | null
    emailVerified?: BoolWithAggregatesFilter<"User"> | boolean
    emailVerifiedAt?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    oauthProvider?: EnumOAuthProviderNullableWithAggregatesFilter<"User"> | $Enums.OAuthProvider | null
    oauthSub?: StringNullableWithAggregatesFilter<"User"> | string | null
    oauthRevoked?: BoolWithAggregatesFilter<"User"> | boolean
    currentTier?: EnumLoyaltyTierWithAggregatesFilter<"User"> | $Enums.LoyaltyTier
    loyaltyPoints?: IntWithAggregatesFilter<"User"> | number
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type VerificationTokenWhereInput = {
    AND?: VerificationTokenWhereInput | VerificationTokenWhereInput[]
    OR?: VerificationTokenWhereInput[]
    NOT?: VerificationTokenWhereInput | VerificationTokenWhereInput[]
    id?: StringFilter<"VerificationToken"> | string
    userId?: StringFilter<"VerificationToken"> | string
    tokenHash?: StringFilter<"VerificationToken"> | string
    tokenType?: EnumTokenTypeFilter<"VerificationToken"> | $Enums.TokenType
    expiresAt?: DateTimeFilter<"VerificationToken"> | Date | string
    used?: BoolFilter<"VerificationToken"> | boolean
    usedAt?: DateTimeNullableFilter<"VerificationToken"> | Date | string | null
    invalidatedReason?: StringNullableFilter<"VerificationToken"> | string | null
    createdAt?: DateTimeFilter<"VerificationToken"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type VerificationTokenOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    expiresAt?: SortOrder
    used?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    invalidatedReason?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type VerificationTokenWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: VerificationTokenWhereInput | VerificationTokenWhereInput[]
    OR?: VerificationTokenWhereInput[]
    NOT?: VerificationTokenWhereInput | VerificationTokenWhereInput[]
    userId?: StringFilter<"VerificationToken"> | string
    tokenType?: EnumTokenTypeFilter<"VerificationToken"> | $Enums.TokenType
    expiresAt?: DateTimeFilter<"VerificationToken"> | Date | string
    used?: BoolFilter<"VerificationToken"> | boolean
    usedAt?: DateTimeNullableFilter<"VerificationToken"> | Date | string | null
    invalidatedReason?: StringNullableFilter<"VerificationToken"> | string | null
    createdAt?: DateTimeFilter<"VerificationToken"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "tokenHash">

  export type VerificationTokenOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    expiresAt?: SortOrder
    used?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    invalidatedReason?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: VerificationTokenCountOrderByAggregateInput
    _max?: VerificationTokenMaxOrderByAggregateInput
    _min?: VerificationTokenMinOrderByAggregateInput
  }

  export type VerificationTokenScalarWhereWithAggregatesInput = {
    AND?: VerificationTokenScalarWhereWithAggregatesInput | VerificationTokenScalarWhereWithAggregatesInput[]
    OR?: VerificationTokenScalarWhereWithAggregatesInput[]
    NOT?: VerificationTokenScalarWhereWithAggregatesInput | VerificationTokenScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"VerificationToken"> | string
    userId?: StringWithAggregatesFilter<"VerificationToken"> | string
    tokenHash?: StringWithAggregatesFilter<"VerificationToken"> | string
    tokenType?: EnumTokenTypeWithAggregatesFilter<"VerificationToken"> | $Enums.TokenType
    expiresAt?: DateTimeWithAggregatesFilter<"VerificationToken"> | Date | string
    used?: BoolWithAggregatesFilter<"VerificationToken"> | boolean
    usedAt?: DateTimeNullableWithAggregatesFilter<"VerificationToken"> | Date | string | null
    invalidatedReason?: StringNullableWithAggregatesFilter<"VerificationToken"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"VerificationToken"> | Date | string
  }

  export type SessionWhereInput = {
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    id?: StringFilter<"Session"> | string
    userId?: StringFilter<"Session"> | string
    tokenHash?: StringFilter<"Session"> | string
    revoked?: BoolFilter<"Session"> | boolean
    createdAt?: DateTimeFilter<"Session"> | Date | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type SessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    userId?: StringFilter<"Session"> | string
    revoked?: BoolFilter<"Session"> | boolean
    createdAt?: DateTimeFilter<"Session"> | Date | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "tokenHash">

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
    _count?: SessionCountOrderByAggregateInput
    _max?: SessionMaxOrderByAggregateInput
    _min?: SessionMinOrderByAggregateInput
  }

  export type SessionScalarWhereWithAggregatesInput = {
    AND?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    OR?: SessionScalarWhereWithAggregatesInput[]
    NOT?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Session"> | string
    userId?: StringWithAggregatesFilter<"Session"> | string
    tokenHash?: StringWithAggregatesFilter<"Session"> | string
    revoked?: BoolWithAggregatesFilter<"Session"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    expiresAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
  }

  export type EmailLogWhereInput = {
    AND?: EmailLogWhereInput | EmailLogWhereInput[]
    OR?: EmailLogWhereInput[]
    NOT?: EmailLogWhereInput | EmailLogWhereInput[]
    id?: StringFilter<"EmailLog"> | string
    userId?: StringNullableFilter<"EmailLog"> | string | null
    type?: EnumEmailLogTypeFilter<"EmailLog"> | $Enums.EmailLogType
    recipient?: StringFilter<"EmailLog"> | string
    status?: EnumEmailLogStatusFilter<"EmailLog"> | $Enums.EmailLogStatus
    sendgridMsgId?: StringNullableFilter<"EmailLog"> | string | null
    sentAt?: DateTimeNullableFilter<"EmailLog"> | Date | string | null
    createdAt?: DateTimeFilter<"EmailLog"> | Date | string
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type EmailLogOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrderInput | SortOrder
    type?: SortOrder
    recipient?: SortOrder
    status?: SortOrder
    sendgridMsgId?: SortOrderInput | SortOrder
    sentAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type EmailLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: EmailLogWhereInput | EmailLogWhereInput[]
    OR?: EmailLogWhereInput[]
    NOT?: EmailLogWhereInput | EmailLogWhereInput[]
    userId?: StringNullableFilter<"EmailLog"> | string | null
    type?: EnumEmailLogTypeFilter<"EmailLog"> | $Enums.EmailLogType
    recipient?: StringFilter<"EmailLog"> | string
    status?: EnumEmailLogStatusFilter<"EmailLog"> | $Enums.EmailLogStatus
    sendgridMsgId?: StringNullableFilter<"EmailLog"> | string | null
    sentAt?: DateTimeNullableFilter<"EmailLog"> | Date | string | null
    createdAt?: DateTimeFilter<"EmailLog"> | Date | string
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id">

  export type EmailLogOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrderInput | SortOrder
    type?: SortOrder
    recipient?: SortOrder
    status?: SortOrder
    sendgridMsgId?: SortOrderInput | SortOrder
    sentAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: EmailLogCountOrderByAggregateInput
    _max?: EmailLogMaxOrderByAggregateInput
    _min?: EmailLogMinOrderByAggregateInput
  }

  export type EmailLogScalarWhereWithAggregatesInput = {
    AND?: EmailLogScalarWhereWithAggregatesInput | EmailLogScalarWhereWithAggregatesInput[]
    OR?: EmailLogScalarWhereWithAggregatesInput[]
    NOT?: EmailLogScalarWhereWithAggregatesInput | EmailLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"EmailLog"> | string
    userId?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    type?: EnumEmailLogTypeWithAggregatesFilter<"EmailLog"> | $Enums.EmailLogType
    recipient?: StringWithAggregatesFilter<"EmailLog"> | string
    status?: EnumEmailLogStatusWithAggregatesFilter<"EmailLog"> | $Enums.EmailLogStatus
    sendgridMsgId?: StringNullableWithAggregatesFilter<"EmailLog"> | string | null
    sentAt?: DateTimeNullableWithAggregatesFilter<"EmailLog"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"EmailLog"> | Date | string
  }

  export type AdminUserWhereInput = {
    AND?: AdminUserWhereInput | AdminUserWhereInput[]
    OR?: AdminUserWhereInput[]
    NOT?: AdminUserWhereInput | AdminUserWhereInput[]
    id?: StringFilter<"AdminUser"> | string
    name?: StringFilter<"AdminUser"> | string
    email?: StringFilter<"AdminUser"> | string
    passwordHash?: StringFilter<"AdminUser"> | string
    role?: EnumAdminRoleFilter<"AdminUser"> | $Enums.AdminRole
    countryScope?: StringNullableListFilter<"AdminUser">
    totpEnabled?: BoolFilter<"AdminUser"> | boolean
    totpSecretEncrypted?: StringNullableFilter<"AdminUser"> | string | null
    fido2Credential?: JsonNullableFilter<"AdminUser">
    createdAt?: DateTimeFilter<"AdminUser"> | Date | string
    updatedAt?: DateTimeFilter<"AdminUser"> | Date | string
    cancellationCount?: IntFilter<"AdminUser"> | number
    adminSessions?: AdminSessionListRelationFilter
    recoveryCodes?: AdminRecoveryCodeListRelationFilter
    auditLogs?: AuditLogListRelationFilter
  }

  export type AdminUserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    role?: SortOrder
    countryScope?: SortOrder
    totpEnabled?: SortOrder
    totpSecretEncrypted?: SortOrderInput | SortOrder
    fido2Credential?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cancellationCount?: SortOrder
    adminSessions?: AdminSessionOrderByRelationAggregateInput
    recoveryCodes?: AdminRecoveryCodeOrderByRelationAggregateInput
    auditLogs?: AuditLogOrderByRelationAggregateInput
  }

  export type AdminUserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: AdminUserWhereInput | AdminUserWhereInput[]
    OR?: AdminUserWhereInput[]
    NOT?: AdminUserWhereInput | AdminUserWhereInput[]
    name?: StringFilter<"AdminUser"> | string
    passwordHash?: StringFilter<"AdminUser"> | string
    role?: EnumAdminRoleFilter<"AdminUser"> | $Enums.AdminRole
    countryScope?: StringNullableListFilter<"AdminUser">
    totpEnabled?: BoolFilter<"AdminUser"> | boolean
    totpSecretEncrypted?: StringNullableFilter<"AdminUser"> | string | null
    fido2Credential?: JsonNullableFilter<"AdminUser">
    createdAt?: DateTimeFilter<"AdminUser"> | Date | string
    updatedAt?: DateTimeFilter<"AdminUser"> | Date | string
    cancellationCount?: IntFilter<"AdminUser"> | number
    adminSessions?: AdminSessionListRelationFilter
    recoveryCodes?: AdminRecoveryCodeListRelationFilter
    auditLogs?: AuditLogListRelationFilter
  }, "id" | "email">

  export type AdminUserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    role?: SortOrder
    countryScope?: SortOrder
    totpEnabled?: SortOrder
    totpSecretEncrypted?: SortOrderInput | SortOrder
    fido2Credential?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cancellationCount?: SortOrder
    _count?: AdminUserCountOrderByAggregateInput
    _avg?: AdminUserAvgOrderByAggregateInput
    _max?: AdminUserMaxOrderByAggregateInput
    _min?: AdminUserMinOrderByAggregateInput
    _sum?: AdminUserSumOrderByAggregateInput
  }

  export type AdminUserScalarWhereWithAggregatesInput = {
    AND?: AdminUserScalarWhereWithAggregatesInput | AdminUserScalarWhereWithAggregatesInput[]
    OR?: AdminUserScalarWhereWithAggregatesInput[]
    NOT?: AdminUserScalarWhereWithAggregatesInput | AdminUserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AdminUser"> | string
    name?: StringWithAggregatesFilter<"AdminUser"> | string
    email?: StringWithAggregatesFilter<"AdminUser"> | string
    passwordHash?: StringWithAggregatesFilter<"AdminUser"> | string
    role?: EnumAdminRoleWithAggregatesFilter<"AdminUser"> | $Enums.AdminRole
    countryScope?: StringNullableListFilter<"AdminUser">
    totpEnabled?: BoolWithAggregatesFilter<"AdminUser"> | boolean
    totpSecretEncrypted?: StringNullableWithAggregatesFilter<"AdminUser"> | string | null
    fido2Credential?: JsonNullableWithAggregatesFilter<"AdminUser">
    createdAt?: DateTimeWithAggregatesFilter<"AdminUser"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AdminUser"> | Date | string
    cancellationCount?: IntWithAggregatesFilter<"AdminUser"> | number
  }

  export type AdminSessionWhereInput = {
    AND?: AdminSessionWhereInput | AdminSessionWhereInput[]
    OR?: AdminSessionWhereInput[]
    NOT?: AdminSessionWhereInput | AdminSessionWhereInput[]
    id?: StringFilter<"AdminSession"> | string
    adminUserId?: StringFilter<"AdminSession"> | string
    tokenHash?: StringFilter<"AdminSession"> | string
    revoked?: BoolFilter<"AdminSession"> | boolean
    lastActiveAt?: DateTimeFilter<"AdminSession"> | Date | string
    createdAt?: DateTimeFilter<"AdminSession"> | Date | string
    expiresAt?: DateTimeFilter<"AdminSession"> | Date | string
    adminUser?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }

  export type AdminSessionOrderByWithRelationInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
    adminUser?: AdminUserOrderByWithRelationInput
  }

  export type AdminSessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: AdminSessionWhereInput | AdminSessionWhereInput[]
    OR?: AdminSessionWhereInput[]
    NOT?: AdminSessionWhereInput | AdminSessionWhereInput[]
    adminUserId?: StringFilter<"AdminSession"> | string
    revoked?: BoolFilter<"AdminSession"> | boolean
    lastActiveAt?: DateTimeFilter<"AdminSession"> | Date | string
    createdAt?: DateTimeFilter<"AdminSession"> | Date | string
    expiresAt?: DateTimeFilter<"AdminSession"> | Date | string
    adminUser?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }, "id" | "tokenHash">

  export type AdminSessionOrderByWithAggregationInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
    _count?: AdminSessionCountOrderByAggregateInput
    _max?: AdminSessionMaxOrderByAggregateInput
    _min?: AdminSessionMinOrderByAggregateInput
  }

  export type AdminSessionScalarWhereWithAggregatesInput = {
    AND?: AdminSessionScalarWhereWithAggregatesInput | AdminSessionScalarWhereWithAggregatesInput[]
    OR?: AdminSessionScalarWhereWithAggregatesInput[]
    NOT?: AdminSessionScalarWhereWithAggregatesInput | AdminSessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AdminSession"> | string
    adminUserId?: StringWithAggregatesFilter<"AdminSession"> | string
    tokenHash?: StringWithAggregatesFilter<"AdminSession"> | string
    revoked?: BoolWithAggregatesFilter<"AdminSession"> | boolean
    lastActiveAt?: DateTimeWithAggregatesFilter<"AdminSession"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"AdminSession"> | Date | string
    expiresAt?: DateTimeWithAggregatesFilter<"AdminSession"> | Date | string
  }

  export type AdminRecoveryCodeWhereInput = {
    AND?: AdminRecoveryCodeWhereInput | AdminRecoveryCodeWhereInput[]
    OR?: AdminRecoveryCodeWhereInput[]
    NOT?: AdminRecoveryCodeWhereInput | AdminRecoveryCodeWhereInput[]
    id?: StringFilter<"AdminRecoveryCode"> | string
    adminUserId?: StringFilter<"AdminRecoveryCode"> | string
    codeHash?: StringFilter<"AdminRecoveryCode"> | string
    usedAt?: DateTimeNullableFilter<"AdminRecoveryCode"> | Date | string | null
    createdAt?: DateTimeFilter<"AdminRecoveryCode"> | Date | string
    adminUser?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }

  export type AdminRecoveryCodeOrderByWithRelationInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    codeHash?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    adminUser?: AdminUserOrderByWithRelationInput
  }

  export type AdminRecoveryCodeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AdminRecoveryCodeWhereInput | AdminRecoveryCodeWhereInput[]
    OR?: AdminRecoveryCodeWhereInput[]
    NOT?: AdminRecoveryCodeWhereInput | AdminRecoveryCodeWhereInput[]
    adminUserId?: StringFilter<"AdminRecoveryCode"> | string
    codeHash?: StringFilter<"AdminRecoveryCode"> | string
    usedAt?: DateTimeNullableFilter<"AdminRecoveryCode"> | Date | string | null
    createdAt?: DateTimeFilter<"AdminRecoveryCode"> | Date | string
    adminUser?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }, "id">

  export type AdminRecoveryCodeOrderByWithAggregationInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    codeHash?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: AdminRecoveryCodeCountOrderByAggregateInput
    _max?: AdminRecoveryCodeMaxOrderByAggregateInput
    _min?: AdminRecoveryCodeMinOrderByAggregateInput
  }

  export type AdminRecoveryCodeScalarWhereWithAggregatesInput = {
    AND?: AdminRecoveryCodeScalarWhereWithAggregatesInput | AdminRecoveryCodeScalarWhereWithAggregatesInput[]
    OR?: AdminRecoveryCodeScalarWhereWithAggregatesInput[]
    NOT?: AdminRecoveryCodeScalarWhereWithAggregatesInput | AdminRecoveryCodeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AdminRecoveryCode"> | string
    adminUserId?: StringWithAggregatesFilter<"AdminRecoveryCode"> | string
    codeHash?: StringWithAggregatesFilter<"AdminRecoveryCode"> | string
    usedAt?: DateTimeNullableWithAggregatesFilter<"AdminRecoveryCode"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AdminRecoveryCode"> | Date | string
  }

  export type AuditLogWhereInput = {
    AND?: AuditLogWhereInput | AuditLogWhereInput[]
    OR?: AuditLogWhereInput[]
    NOT?: AuditLogWhereInput | AuditLogWhereInput[]
    id?: StringFilter<"AuditLog"> | string
    adminId?: StringFilter<"AuditLog"> | string
    role?: StringFilter<"AuditLog"> | string
    action?: StringFilter<"AuditLog"> | string
    targetType?: StringNullableFilter<"AuditLog"> | string | null
    targetId?: StringNullableFilter<"AuditLog"> | string | null
    oldValue?: StringNullableFilter<"AuditLog"> | string | null
    newValue?: StringNullableFilter<"AuditLog"> | string | null
    ipAddress?: StringFilter<"AuditLog"> | string
    timestamp?: DateTimeFilter<"AuditLog"> | Date | string
    admin?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }

  export type AuditLogOrderByWithRelationInput = {
    id?: SortOrder
    adminId?: SortOrder
    role?: SortOrder
    action?: SortOrder
    targetType?: SortOrderInput | SortOrder
    targetId?: SortOrderInput | SortOrder
    oldValue?: SortOrderInput | SortOrder
    newValue?: SortOrderInput | SortOrder
    ipAddress?: SortOrder
    timestamp?: SortOrder
    admin?: AdminUserOrderByWithRelationInput
  }

  export type AuditLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AuditLogWhereInput | AuditLogWhereInput[]
    OR?: AuditLogWhereInput[]
    NOT?: AuditLogWhereInput | AuditLogWhereInput[]
    adminId?: StringFilter<"AuditLog"> | string
    role?: StringFilter<"AuditLog"> | string
    action?: StringFilter<"AuditLog"> | string
    targetType?: StringNullableFilter<"AuditLog"> | string | null
    targetId?: StringNullableFilter<"AuditLog"> | string | null
    oldValue?: StringNullableFilter<"AuditLog"> | string | null
    newValue?: StringNullableFilter<"AuditLog"> | string | null
    ipAddress?: StringFilter<"AuditLog"> | string
    timestamp?: DateTimeFilter<"AuditLog"> | Date | string
    admin?: XOR<AdminUserScalarRelationFilter, AdminUserWhereInput>
  }, "id">

  export type AuditLogOrderByWithAggregationInput = {
    id?: SortOrder
    adminId?: SortOrder
    role?: SortOrder
    action?: SortOrder
    targetType?: SortOrderInput | SortOrder
    targetId?: SortOrderInput | SortOrder
    oldValue?: SortOrderInput | SortOrder
    newValue?: SortOrderInput | SortOrder
    ipAddress?: SortOrder
    timestamp?: SortOrder
    _count?: AuditLogCountOrderByAggregateInput
    _max?: AuditLogMaxOrderByAggregateInput
    _min?: AuditLogMinOrderByAggregateInput
  }

  export type AuditLogScalarWhereWithAggregatesInput = {
    AND?: AuditLogScalarWhereWithAggregatesInput | AuditLogScalarWhereWithAggregatesInput[]
    OR?: AuditLogScalarWhereWithAggregatesInput[]
    NOT?: AuditLogScalarWhereWithAggregatesInput | AuditLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AuditLog"> | string
    adminId?: StringWithAggregatesFilter<"AuditLog"> | string
    role?: StringWithAggregatesFilter<"AuditLog"> | string
    action?: StringWithAggregatesFilter<"AuditLog"> | string
    targetType?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null
    targetId?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null
    oldValue?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null
    newValue?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null
    ipAddress?: StringWithAggregatesFilter<"AuditLog"> | string
    timestamp?: DateTimeWithAggregatesFilter<"AuditLog"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenCreateNestedManyWithoutUserInput
    sessions?: SessionCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenUncheckedCreateNestedManyWithoutUserInput
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUpdateManyWithoutUserNestedInput
    sessions?: SessionUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUncheckedUpdateManyWithoutUserNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationTokenCreateInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutVerificationTokensInput
  }

  export type VerificationTokenUncheckedCreateInput = {
    id?: string
    userId: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
  }

  export type VerificationTokenUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutVerificationTokensNestedInput
  }

  export type VerificationTokenUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationTokenCreateManyInput = {
    id?: string
    userId: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
  }

  export type VerificationTokenUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationTokenUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateInput = {
    id?: string
    userId: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateManyInput = {
    id?: string
    userId: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogCreateInput = {
    id?: string
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
    user?: UserCreateNestedOneWithoutEmailLogsInput
  }

  export type EmailLogUncheckedCreateInput = {
    id?: string
    userId?: string | null
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
  }

  export type EmailLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutEmailLogsNestedInput
  }

  export type EmailLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogCreateManyInput = {
    id?: string
    userId?: string | null
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
  }

  export type EmailLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminUserCreateInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionCreateNestedManyWithoutAdminUserInput
    recoveryCodes?: AdminRecoveryCodeCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogCreateNestedManyWithoutAdminInput
  }

  export type AdminUserUncheckedCreateInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionUncheckedCreateNestedManyWithoutAdminUserInput
    recoveryCodes?: AdminRecoveryCodeUncheckedCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutAdminInput
  }

  export type AdminUserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUpdateManyWithoutAdminUserNestedInput
    recoveryCodes?: AdminRecoveryCodeUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUncheckedUpdateManyWithoutAdminUserNestedInput
    recoveryCodes?: AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUncheckedUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserCreateManyInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
  }

  export type AdminUserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
  }

  export type AdminUserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
  }

  export type AdminSessionCreateInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
    adminUser: AdminUserCreateNestedOneWithoutAdminSessionsInput
  }

  export type AdminSessionUncheckedCreateInput = {
    id?: string
    adminUserId: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type AdminSessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    adminUser?: AdminUserUpdateOneRequiredWithoutAdminSessionsNestedInput
  }

  export type AdminSessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminUserId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminSessionCreateManyInput = {
    id?: string
    adminUserId: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type AdminSessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminSessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminUserId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeCreateInput = {
    id?: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
    adminUser: AdminUserCreateNestedOneWithoutRecoveryCodesInput
  }

  export type AdminRecoveryCodeUncheckedCreateInput = {
    id?: string
    adminUserId: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AdminRecoveryCodeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    adminUser?: AdminUserUpdateOneRequiredWithoutRecoveryCodesNestedInput
  }

  export type AdminRecoveryCodeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminUserId?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeCreateManyInput = {
    id?: string
    adminUserId: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AdminRecoveryCodeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminUserId?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogCreateInput = {
    id?: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
    admin: AdminUserCreateNestedOneWithoutAuditLogsInput
  }

  export type AuditLogUncheckedCreateInput = {
    id?: string
    adminId: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
  }

  export type AuditLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    admin?: AdminUserUpdateOneRequiredWithoutAuditLogsNestedInput
  }

  export type AuditLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogCreateManyInput = {
    id?: string
    adminId: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
  }

  export type AuditLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumUserStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUserStatusFilter<$PrismaModel> | $Enums.UserStatus
  }

  export type EnumUserTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.UserType | EnumUserTypeFieldRefInput<$PrismaModel>
    in?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumUserTypeFilter<$PrismaModel> | $Enums.UserType
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type EnumOAuthProviderNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.OAuthProvider | EnumOAuthProviderFieldRefInput<$PrismaModel> | null
    in?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    not?: NestedEnumOAuthProviderNullableFilter<$PrismaModel> | $Enums.OAuthProvider | null
  }

  export type EnumLoyaltyTierFilter<$PrismaModel = never> = {
    equals?: $Enums.LoyaltyTier | EnumLoyaltyTierFieldRefInput<$PrismaModel>
    in?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    not?: NestedEnumLoyaltyTierFilter<$PrismaModel> | $Enums.LoyaltyTier
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type VerificationTokenListRelationFilter = {
    every?: VerificationTokenWhereInput
    some?: VerificationTokenWhereInput
    none?: VerificationTokenWhereInput
  }

  export type SessionListRelationFilter = {
    every?: SessionWhereInput
    some?: SessionWhereInput
    none?: SessionWhereInput
  }

  export type EmailLogListRelationFilter = {
    every?: EmailLogWhereInput
    some?: EmailLogWhereInput
    none?: EmailLogWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type VerificationTokenOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EmailLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserOauthProviderOauthSubCompoundUniqueInput = {
    oauthProvider: $Enums.OAuthProvider
    oauthSub: string
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    status?: SortOrder
    userType?: SortOrder
    businessName?: SortOrder
    country?: SortOrder
    emailVerified?: SortOrder
    emailVerifiedAt?: SortOrder
    oauthProvider?: SortOrder
    oauthSub?: SortOrder
    oauthRevoked?: SortOrder
    currentTier?: SortOrder
    loyaltyPoints?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    loyaltyPoints?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    status?: SortOrder
    userType?: SortOrder
    businessName?: SortOrder
    country?: SortOrder
    emailVerified?: SortOrder
    emailVerifiedAt?: SortOrder
    oauthProvider?: SortOrder
    oauthSub?: SortOrder
    oauthRevoked?: SortOrder
    currentTier?: SortOrder
    loyaltyPoints?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    status?: SortOrder
    userType?: SortOrder
    businessName?: SortOrder
    country?: SortOrder
    emailVerified?: SortOrder
    emailVerifiedAt?: SortOrder
    oauthProvider?: SortOrder
    oauthSub?: SortOrder
    oauthRevoked?: SortOrder
    currentTier?: SortOrder
    loyaltyPoints?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    loyaltyPoints?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumUserStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUserStatusWithAggregatesFilter<$PrismaModel> | $Enums.UserStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserStatusFilter<$PrismaModel>
    _max?: NestedEnumUserStatusFilter<$PrismaModel>
  }

  export type EnumUserTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserType | EnumUserTypeFieldRefInput<$PrismaModel>
    in?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumUserTypeWithAggregatesFilter<$PrismaModel> | $Enums.UserType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserTypeFilter<$PrismaModel>
    _max?: NestedEnumUserTypeFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumOAuthProviderNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OAuthProvider | EnumOAuthProviderFieldRefInput<$PrismaModel> | null
    in?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    not?: NestedEnumOAuthProviderNullableWithAggregatesFilter<$PrismaModel> | $Enums.OAuthProvider | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumOAuthProviderNullableFilter<$PrismaModel>
    _max?: NestedEnumOAuthProviderNullableFilter<$PrismaModel>
  }

  export type EnumLoyaltyTierWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.LoyaltyTier | EnumLoyaltyTierFieldRefInput<$PrismaModel>
    in?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    not?: NestedEnumLoyaltyTierWithAggregatesFilter<$PrismaModel> | $Enums.LoyaltyTier
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumLoyaltyTierFilter<$PrismaModel>
    _max?: NestedEnumLoyaltyTierFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type EnumTokenTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.TokenType | EnumTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTokenTypeFilter<$PrismaModel> | $Enums.TokenType
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type VerificationTokenCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    expiresAt?: SortOrder
    used?: SortOrder
    usedAt?: SortOrder
    invalidatedReason?: SortOrder
    createdAt?: SortOrder
  }

  export type VerificationTokenMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    expiresAt?: SortOrder
    used?: SortOrder
    usedAt?: SortOrder
    invalidatedReason?: SortOrder
    createdAt?: SortOrder
  }

  export type VerificationTokenMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    expiresAt?: SortOrder
    used?: SortOrder
    usedAt?: SortOrder
    invalidatedReason?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumTokenTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TokenType | EnumTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTokenTypeWithAggregatesFilter<$PrismaModel> | $Enums.TokenType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTokenTypeFilter<$PrismaModel>
    _max?: NestedEnumTokenTypeFilter<$PrismaModel>
  }

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type EnumEmailLogTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogType | EnumEmailLogTypeFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogTypeFilter<$PrismaModel> | $Enums.EmailLogType
  }

  export type EnumEmailLogStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogStatus | EnumEmailLogStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogStatusFilter<$PrismaModel> | $Enums.EmailLogStatus
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type EmailLogCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    recipient?: SortOrder
    status?: SortOrder
    sendgridMsgId?: SortOrder
    sentAt?: SortOrder
    createdAt?: SortOrder
  }

  export type EmailLogMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    recipient?: SortOrder
    status?: SortOrder
    sendgridMsgId?: SortOrder
    sentAt?: SortOrder
    createdAt?: SortOrder
  }

  export type EmailLogMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    recipient?: SortOrder
    status?: SortOrder
    sendgridMsgId?: SortOrder
    sentAt?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumEmailLogTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogType | EnumEmailLogTypeFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogTypeWithAggregatesFilter<$PrismaModel> | $Enums.EmailLogType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmailLogTypeFilter<$PrismaModel>
    _max?: NestedEnumEmailLogTypeFilter<$PrismaModel>
  }

  export type EnumEmailLogStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogStatus | EnumEmailLogStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogStatusWithAggregatesFilter<$PrismaModel> | $Enums.EmailLogStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmailLogStatusFilter<$PrismaModel>
    _max?: NestedEnumEmailLogStatusFilter<$PrismaModel>
  }

  export type EnumAdminRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminRole | EnumAdminRoleFieldRefInput<$PrismaModel>
    in?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminRoleFilter<$PrismaModel> | $Enums.AdminRole
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type AdminSessionListRelationFilter = {
    every?: AdminSessionWhereInput
    some?: AdminSessionWhereInput
    none?: AdminSessionWhereInput
  }

  export type AdminRecoveryCodeListRelationFilter = {
    every?: AdminRecoveryCodeWhereInput
    some?: AdminRecoveryCodeWhereInput
    none?: AdminRecoveryCodeWhereInput
  }

  export type AuditLogListRelationFilter = {
    every?: AuditLogWhereInput
    some?: AuditLogWhereInput
    none?: AuditLogWhereInput
  }

  export type AdminSessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AdminRecoveryCodeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AuditLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AdminUserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    role?: SortOrder
    countryScope?: SortOrder
    totpEnabled?: SortOrder
    totpSecretEncrypted?: SortOrder
    fido2Credential?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cancellationCount?: SortOrder
  }

  export type AdminUserAvgOrderByAggregateInput = {
    cancellationCount?: SortOrder
  }

  export type AdminUserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    role?: SortOrder
    totpEnabled?: SortOrder
    totpSecretEncrypted?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cancellationCount?: SortOrder
  }

  export type AdminUserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    role?: SortOrder
    totpEnabled?: SortOrder
    totpSecretEncrypted?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    cancellationCount?: SortOrder
  }

  export type AdminUserSumOrderByAggregateInput = {
    cancellationCount?: SortOrder
  }

  export type EnumAdminRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminRole | EnumAdminRoleFieldRefInput<$PrismaModel>
    in?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminRoleWithAggregatesFilter<$PrismaModel> | $Enums.AdminRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAdminRoleFilter<$PrismaModel>
    _max?: NestedEnumAdminRoleFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type AdminUserScalarRelationFilter = {
    is?: AdminUserWhereInput
    isNot?: AdminUserWhereInput
  }

  export type AdminSessionCountOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type AdminSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type AdminSessionMinOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    tokenHash?: SortOrder
    revoked?: SortOrder
    lastActiveAt?: SortOrder
    createdAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type AdminRecoveryCodeCountOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    codeHash?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type AdminRecoveryCodeMaxOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    codeHash?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type AdminRecoveryCodeMinOrderByAggregateInput = {
    id?: SortOrder
    adminUserId?: SortOrder
    codeHash?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type AuditLogCountOrderByAggregateInput = {
    id?: SortOrder
    adminId?: SortOrder
    role?: SortOrder
    action?: SortOrder
    targetType?: SortOrder
    targetId?: SortOrder
    oldValue?: SortOrder
    newValue?: SortOrder
    ipAddress?: SortOrder
    timestamp?: SortOrder
  }

  export type AuditLogMaxOrderByAggregateInput = {
    id?: SortOrder
    adminId?: SortOrder
    role?: SortOrder
    action?: SortOrder
    targetType?: SortOrder
    targetId?: SortOrder
    oldValue?: SortOrder
    newValue?: SortOrder
    ipAddress?: SortOrder
    timestamp?: SortOrder
  }

  export type AuditLogMinOrderByAggregateInput = {
    id?: SortOrder
    adminId?: SortOrder
    role?: SortOrder
    action?: SortOrder
    targetType?: SortOrder
    targetId?: SortOrder
    oldValue?: SortOrder
    newValue?: SortOrder
    ipAddress?: SortOrder
    timestamp?: SortOrder
  }

  export type VerificationTokenCreateNestedManyWithoutUserInput = {
    create?: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput> | VerificationTokenCreateWithoutUserInput[] | VerificationTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: VerificationTokenCreateOrConnectWithoutUserInput | VerificationTokenCreateOrConnectWithoutUserInput[]
    createMany?: VerificationTokenCreateManyUserInputEnvelope
    connect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
  }

  export type SessionCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type EmailLogCreateNestedManyWithoutUserInput = {
    create?: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput> | EmailLogCreateWithoutUserInput[] | EmailLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: EmailLogCreateOrConnectWithoutUserInput | EmailLogCreateOrConnectWithoutUserInput[]
    createMany?: EmailLogCreateManyUserInputEnvelope
    connect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
  }

  export type VerificationTokenUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput> | VerificationTokenCreateWithoutUserInput[] | VerificationTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: VerificationTokenCreateOrConnectWithoutUserInput | VerificationTokenCreateOrConnectWithoutUserInput[]
    createMany?: VerificationTokenCreateManyUserInputEnvelope
    connect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
  }

  export type SessionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type EmailLogUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput> | EmailLogCreateWithoutUserInput[] | EmailLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: EmailLogCreateOrConnectWithoutUserInput | EmailLogCreateOrConnectWithoutUserInput[]
    createMany?: EmailLogCreateManyUserInputEnvelope
    connect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumUserStatusFieldUpdateOperationsInput = {
    set?: $Enums.UserStatus
  }

  export type EnumUserTypeFieldUpdateOperationsInput = {
    set?: $Enums.UserType
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NullableEnumOAuthProviderFieldUpdateOperationsInput = {
    set?: $Enums.OAuthProvider | null
  }

  export type EnumLoyaltyTierFieldUpdateOperationsInput = {
    set?: $Enums.LoyaltyTier
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type VerificationTokenUpdateManyWithoutUserNestedInput = {
    create?: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput> | VerificationTokenCreateWithoutUserInput[] | VerificationTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: VerificationTokenCreateOrConnectWithoutUserInput | VerificationTokenCreateOrConnectWithoutUserInput[]
    upsert?: VerificationTokenUpsertWithWhereUniqueWithoutUserInput | VerificationTokenUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: VerificationTokenCreateManyUserInputEnvelope
    set?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    disconnect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    delete?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    connect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    update?: VerificationTokenUpdateWithWhereUniqueWithoutUserInput | VerificationTokenUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: VerificationTokenUpdateManyWithWhereWithoutUserInput | VerificationTokenUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: VerificationTokenScalarWhereInput | VerificationTokenScalarWhereInput[]
  }

  export type SessionUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type EmailLogUpdateManyWithoutUserNestedInput = {
    create?: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput> | EmailLogCreateWithoutUserInput[] | EmailLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: EmailLogCreateOrConnectWithoutUserInput | EmailLogCreateOrConnectWithoutUserInput[]
    upsert?: EmailLogUpsertWithWhereUniqueWithoutUserInput | EmailLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: EmailLogCreateManyUserInputEnvelope
    set?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    disconnect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    delete?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    connect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    update?: EmailLogUpdateWithWhereUniqueWithoutUserInput | EmailLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: EmailLogUpdateManyWithWhereWithoutUserInput | EmailLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: EmailLogScalarWhereInput | EmailLogScalarWhereInput[]
  }

  export type VerificationTokenUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput> | VerificationTokenCreateWithoutUserInput[] | VerificationTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: VerificationTokenCreateOrConnectWithoutUserInput | VerificationTokenCreateOrConnectWithoutUserInput[]
    upsert?: VerificationTokenUpsertWithWhereUniqueWithoutUserInput | VerificationTokenUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: VerificationTokenCreateManyUserInputEnvelope
    set?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    disconnect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    delete?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    connect?: VerificationTokenWhereUniqueInput | VerificationTokenWhereUniqueInput[]
    update?: VerificationTokenUpdateWithWhereUniqueWithoutUserInput | VerificationTokenUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: VerificationTokenUpdateManyWithWhereWithoutUserInput | VerificationTokenUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: VerificationTokenScalarWhereInput | VerificationTokenScalarWhereInput[]
  }

  export type SessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type EmailLogUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput> | EmailLogCreateWithoutUserInput[] | EmailLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: EmailLogCreateOrConnectWithoutUserInput | EmailLogCreateOrConnectWithoutUserInput[]
    upsert?: EmailLogUpsertWithWhereUniqueWithoutUserInput | EmailLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: EmailLogCreateManyUserInputEnvelope
    set?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    disconnect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    delete?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    connect?: EmailLogWhereUniqueInput | EmailLogWhereUniqueInput[]
    update?: EmailLogUpdateWithWhereUniqueWithoutUserInput | EmailLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: EmailLogUpdateManyWithWhereWithoutUserInput | EmailLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: EmailLogScalarWhereInput | EmailLogScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutVerificationTokensInput = {
    create?: XOR<UserCreateWithoutVerificationTokensInput, UserUncheckedCreateWithoutVerificationTokensInput>
    connectOrCreate?: UserCreateOrConnectWithoutVerificationTokensInput
    connect?: UserWhereUniqueInput
  }

  export type EnumTokenTypeFieldUpdateOperationsInput = {
    set?: $Enums.TokenType
  }

  export type UserUpdateOneRequiredWithoutVerificationTokensNestedInput = {
    create?: XOR<UserCreateWithoutVerificationTokensInput, UserUncheckedCreateWithoutVerificationTokensInput>
    connectOrCreate?: UserCreateOrConnectWithoutVerificationTokensInput
    upsert?: UserUpsertWithoutVerificationTokensInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutVerificationTokensInput, UserUpdateWithoutVerificationTokensInput>, UserUncheckedUpdateWithoutVerificationTokensInput>
  }

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    upsert?: UserUpsertWithoutSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSessionsInput, UserUpdateWithoutSessionsInput>, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserCreateNestedOneWithoutEmailLogsInput = {
    create?: XOR<UserCreateWithoutEmailLogsInput, UserUncheckedCreateWithoutEmailLogsInput>
    connectOrCreate?: UserCreateOrConnectWithoutEmailLogsInput
    connect?: UserWhereUniqueInput
  }

  export type EnumEmailLogTypeFieldUpdateOperationsInput = {
    set?: $Enums.EmailLogType
  }

  export type EnumEmailLogStatusFieldUpdateOperationsInput = {
    set?: $Enums.EmailLogStatus
  }

  export type UserUpdateOneWithoutEmailLogsNestedInput = {
    create?: XOR<UserCreateWithoutEmailLogsInput, UserUncheckedCreateWithoutEmailLogsInput>
    connectOrCreate?: UserCreateOrConnectWithoutEmailLogsInput
    upsert?: UserUpsertWithoutEmailLogsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutEmailLogsInput, UserUpdateWithoutEmailLogsInput>, UserUncheckedUpdateWithoutEmailLogsInput>
  }

  export type AdminUserCreatecountryScopeInput = {
    set: string[]
  }

  export type AdminSessionCreateNestedManyWithoutAdminUserInput = {
    create?: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput> | AdminSessionCreateWithoutAdminUserInput[] | AdminSessionUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminSessionCreateOrConnectWithoutAdminUserInput | AdminSessionCreateOrConnectWithoutAdminUserInput[]
    createMany?: AdminSessionCreateManyAdminUserInputEnvelope
    connect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
  }

  export type AdminRecoveryCodeCreateNestedManyWithoutAdminUserInput = {
    create?: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput> | AdminRecoveryCodeCreateWithoutAdminUserInput[] | AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput | AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput[]
    createMany?: AdminRecoveryCodeCreateManyAdminUserInputEnvelope
    connect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
  }

  export type AuditLogCreateNestedManyWithoutAdminInput = {
    create?: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput> | AuditLogCreateWithoutAdminInput[] | AuditLogUncheckedCreateWithoutAdminInput[]
    connectOrCreate?: AuditLogCreateOrConnectWithoutAdminInput | AuditLogCreateOrConnectWithoutAdminInput[]
    createMany?: AuditLogCreateManyAdminInputEnvelope
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
  }

  export type AdminSessionUncheckedCreateNestedManyWithoutAdminUserInput = {
    create?: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput> | AdminSessionCreateWithoutAdminUserInput[] | AdminSessionUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminSessionCreateOrConnectWithoutAdminUserInput | AdminSessionCreateOrConnectWithoutAdminUserInput[]
    createMany?: AdminSessionCreateManyAdminUserInputEnvelope
    connect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
  }

  export type AdminRecoveryCodeUncheckedCreateNestedManyWithoutAdminUserInput = {
    create?: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput> | AdminRecoveryCodeCreateWithoutAdminUserInput[] | AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput | AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput[]
    createMany?: AdminRecoveryCodeCreateManyAdminUserInputEnvelope
    connect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
  }

  export type AuditLogUncheckedCreateNestedManyWithoutAdminInput = {
    create?: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput> | AuditLogCreateWithoutAdminInput[] | AuditLogUncheckedCreateWithoutAdminInput[]
    connectOrCreate?: AuditLogCreateOrConnectWithoutAdminInput | AuditLogCreateOrConnectWithoutAdminInput[]
    createMany?: AuditLogCreateManyAdminInputEnvelope
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
  }

  export type EnumAdminRoleFieldUpdateOperationsInput = {
    set?: $Enums.AdminRole
  }

  export type AdminUserUpdatecountryScopeInput = {
    set?: string[]
    push?: string | string[]
  }

  export type AdminSessionUpdateManyWithoutAdminUserNestedInput = {
    create?: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput> | AdminSessionCreateWithoutAdminUserInput[] | AdminSessionUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminSessionCreateOrConnectWithoutAdminUserInput | AdminSessionCreateOrConnectWithoutAdminUserInput[]
    upsert?: AdminSessionUpsertWithWhereUniqueWithoutAdminUserInput | AdminSessionUpsertWithWhereUniqueWithoutAdminUserInput[]
    createMany?: AdminSessionCreateManyAdminUserInputEnvelope
    set?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    disconnect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    delete?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    connect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    update?: AdminSessionUpdateWithWhereUniqueWithoutAdminUserInput | AdminSessionUpdateWithWhereUniqueWithoutAdminUserInput[]
    updateMany?: AdminSessionUpdateManyWithWhereWithoutAdminUserInput | AdminSessionUpdateManyWithWhereWithoutAdminUserInput[]
    deleteMany?: AdminSessionScalarWhereInput | AdminSessionScalarWhereInput[]
  }

  export type AdminRecoveryCodeUpdateManyWithoutAdminUserNestedInput = {
    create?: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput> | AdminRecoveryCodeCreateWithoutAdminUserInput[] | AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput | AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput[]
    upsert?: AdminRecoveryCodeUpsertWithWhereUniqueWithoutAdminUserInput | AdminRecoveryCodeUpsertWithWhereUniqueWithoutAdminUserInput[]
    createMany?: AdminRecoveryCodeCreateManyAdminUserInputEnvelope
    set?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    disconnect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    delete?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    connect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    update?: AdminRecoveryCodeUpdateWithWhereUniqueWithoutAdminUserInput | AdminRecoveryCodeUpdateWithWhereUniqueWithoutAdminUserInput[]
    updateMany?: AdminRecoveryCodeUpdateManyWithWhereWithoutAdminUserInput | AdminRecoveryCodeUpdateManyWithWhereWithoutAdminUserInput[]
    deleteMany?: AdminRecoveryCodeScalarWhereInput | AdminRecoveryCodeScalarWhereInput[]
  }

  export type AuditLogUpdateManyWithoutAdminNestedInput = {
    create?: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput> | AuditLogCreateWithoutAdminInput[] | AuditLogUncheckedCreateWithoutAdminInput[]
    connectOrCreate?: AuditLogCreateOrConnectWithoutAdminInput | AuditLogCreateOrConnectWithoutAdminInput[]
    upsert?: AuditLogUpsertWithWhereUniqueWithoutAdminInput | AuditLogUpsertWithWhereUniqueWithoutAdminInput[]
    createMany?: AuditLogCreateManyAdminInputEnvelope
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    update?: AuditLogUpdateWithWhereUniqueWithoutAdminInput | AuditLogUpdateWithWhereUniqueWithoutAdminInput[]
    updateMany?: AuditLogUpdateManyWithWhereWithoutAdminInput | AuditLogUpdateManyWithWhereWithoutAdminInput[]
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[]
  }

  export type AdminSessionUncheckedUpdateManyWithoutAdminUserNestedInput = {
    create?: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput> | AdminSessionCreateWithoutAdminUserInput[] | AdminSessionUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminSessionCreateOrConnectWithoutAdminUserInput | AdminSessionCreateOrConnectWithoutAdminUserInput[]
    upsert?: AdminSessionUpsertWithWhereUniqueWithoutAdminUserInput | AdminSessionUpsertWithWhereUniqueWithoutAdminUserInput[]
    createMany?: AdminSessionCreateManyAdminUserInputEnvelope
    set?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    disconnect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    delete?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    connect?: AdminSessionWhereUniqueInput | AdminSessionWhereUniqueInput[]
    update?: AdminSessionUpdateWithWhereUniqueWithoutAdminUserInput | AdminSessionUpdateWithWhereUniqueWithoutAdminUserInput[]
    updateMany?: AdminSessionUpdateManyWithWhereWithoutAdminUserInput | AdminSessionUpdateManyWithWhereWithoutAdminUserInput[]
    deleteMany?: AdminSessionScalarWhereInput | AdminSessionScalarWhereInput[]
  }

  export type AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserNestedInput = {
    create?: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput> | AdminRecoveryCodeCreateWithoutAdminUserInput[] | AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput[]
    connectOrCreate?: AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput | AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput[]
    upsert?: AdminRecoveryCodeUpsertWithWhereUniqueWithoutAdminUserInput | AdminRecoveryCodeUpsertWithWhereUniqueWithoutAdminUserInput[]
    createMany?: AdminRecoveryCodeCreateManyAdminUserInputEnvelope
    set?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    disconnect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    delete?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    connect?: AdminRecoveryCodeWhereUniqueInput | AdminRecoveryCodeWhereUniqueInput[]
    update?: AdminRecoveryCodeUpdateWithWhereUniqueWithoutAdminUserInput | AdminRecoveryCodeUpdateWithWhereUniqueWithoutAdminUserInput[]
    updateMany?: AdminRecoveryCodeUpdateManyWithWhereWithoutAdminUserInput | AdminRecoveryCodeUpdateManyWithWhereWithoutAdminUserInput[]
    deleteMany?: AdminRecoveryCodeScalarWhereInput | AdminRecoveryCodeScalarWhereInput[]
  }

  export type AuditLogUncheckedUpdateManyWithoutAdminNestedInput = {
    create?: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput> | AuditLogCreateWithoutAdminInput[] | AuditLogUncheckedCreateWithoutAdminInput[]
    connectOrCreate?: AuditLogCreateOrConnectWithoutAdminInput | AuditLogCreateOrConnectWithoutAdminInput[]
    upsert?: AuditLogUpsertWithWhereUniqueWithoutAdminInput | AuditLogUpsertWithWhereUniqueWithoutAdminInput[]
    createMany?: AuditLogCreateManyAdminInputEnvelope
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[]
    update?: AuditLogUpdateWithWhereUniqueWithoutAdminInput | AuditLogUpdateWithWhereUniqueWithoutAdminInput[]
    updateMany?: AuditLogUpdateManyWithWhereWithoutAdminInput | AuditLogUpdateManyWithWhereWithoutAdminInput[]
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[]
  }

  export type AdminUserCreateNestedOneWithoutAdminSessionsInput = {
    create?: XOR<AdminUserCreateWithoutAdminSessionsInput, AdminUserUncheckedCreateWithoutAdminSessionsInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutAdminSessionsInput
    connect?: AdminUserWhereUniqueInput
  }

  export type AdminUserUpdateOneRequiredWithoutAdminSessionsNestedInput = {
    create?: XOR<AdminUserCreateWithoutAdminSessionsInput, AdminUserUncheckedCreateWithoutAdminSessionsInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutAdminSessionsInput
    upsert?: AdminUserUpsertWithoutAdminSessionsInput
    connect?: AdminUserWhereUniqueInput
    update?: XOR<XOR<AdminUserUpdateToOneWithWhereWithoutAdminSessionsInput, AdminUserUpdateWithoutAdminSessionsInput>, AdminUserUncheckedUpdateWithoutAdminSessionsInput>
  }

  export type AdminUserCreateNestedOneWithoutRecoveryCodesInput = {
    create?: XOR<AdminUserCreateWithoutRecoveryCodesInput, AdminUserUncheckedCreateWithoutRecoveryCodesInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutRecoveryCodesInput
    connect?: AdminUserWhereUniqueInput
  }

  export type AdminUserUpdateOneRequiredWithoutRecoveryCodesNestedInput = {
    create?: XOR<AdminUserCreateWithoutRecoveryCodesInput, AdminUserUncheckedCreateWithoutRecoveryCodesInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutRecoveryCodesInput
    upsert?: AdminUserUpsertWithoutRecoveryCodesInput
    connect?: AdminUserWhereUniqueInput
    update?: XOR<XOR<AdminUserUpdateToOneWithWhereWithoutRecoveryCodesInput, AdminUserUpdateWithoutRecoveryCodesInput>, AdminUserUncheckedUpdateWithoutRecoveryCodesInput>
  }

  export type AdminUserCreateNestedOneWithoutAuditLogsInput = {
    create?: XOR<AdminUserCreateWithoutAuditLogsInput, AdminUserUncheckedCreateWithoutAuditLogsInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutAuditLogsInput
    connect?: AdminUserWhereUniqueInput
  }

  export type AdminUserUpdateOneRequiredWithoutAuditLogsNestedInput = {
    create?: XOR<AdminUserCreateWithoutAuditLogsInput, AdminUserUncheckedCreateWithoutAuditLogsInput>
    connectOrCreate?: AdminUserCreateOrConnectWithoutAuditLogsInput
    upsert?: AdminUserUpsertWithoutAuditLogsInput
    connect?: AdminUserWhereUniqueInput
    update?: XOR<XOR<AdminUserUpdateToOneWithWhereWithoutAuditLogsInput, AdminUserUpdateWithoutAuditLogsInput>, AdminUserUncheckedUpdateWithoutAuditLogsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumUserStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUserStatusFilter<$PrismaModel> | $Enums.UserStatus
  }

  export type NestedEnumUserTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.UserType | EnumUserTypeFieldRefInput<$PrismaModel>
    in?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumUserTypeFilter<$PrismaModel> | $Enums.UserType
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumOAuthProviderNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.OAuthProvider | EnumOAuthProviderFieldRefInput<$PrismaModel> | null
    in?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    not?: NestedEnumOAuthProviderNullableFilter<$PrismaModel> | $Enums.OAuthProvider | null
  }

  export type NestedEnumLoyaltyTierFilter<$PrismaModel = never> = {
    equals?: $Enums.LoyaltyTier | EnumLoyaltyTierFieldRefInput<$PrismaModel>
    in?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    not?: NestedEnumLoyaltyTierFilter<$PrismaModel> | $Enums.LoyaltyTier
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumUserStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUserStatusWithAggregatesFilter<$PrismaModel> | $Enums.UserStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserStatusFilter<$PrismaModel>
    _max?: NestedEnumUserStatusFilter<$PrismaModel>
  }

  export type NestedEnumUserTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserType | EnumUserTypeFieldRefInput<$PrismaModel>
    in?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserType[] | ListEnumUserTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumUserTypeWithAggregatesFilter<$PrismaModel> | $Enums.UserType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserTypeFilter<$PrismaModel>
    _max?: NestedEnumUserTypeFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumOAuthProviderNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OAuthProvider | EnumOAuthProviderFieldRefInput<$PrismaModel> | null
    in?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.OAuthProvider[] | ListEnumOAuthProviderFieldRefInput<$PrismaModel> | null
    not?: NestedEnumOAuthProviderNullableWithAggregatesFilter<$PrismaModel> | $Enums.OAuthProvider | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumOAuthProviderNullableFilter<$PrismaModel>
    _max?: NestedEnumOAuthProviderNullableFilter<$PrismaModel>
  }

  export type NestedEnumLoyaltyTierWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.LoyaltyTier | EnumLoyaltyTierFieldRefInput<$PrismaModel>
    in?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.LoyaltyTier[] | ListEnumLoyaltyTierFieldRefInput<$PrismaModel>
    not?: NestedEnumLoyaltyTierWithAggregatesFilter<$PrismaModel> | $Enums.LoyaltyTier
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumLoyaltyTierFilter<$PrismaModel>
    _max?: NestedEnumLoyaltyTierFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumTokenTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.TokenType | EnumTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTokenTypeFilter<$PrismaModel> | $Enums.TokenType
  }

  export type NestedEnumTokenTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TokenType | EnumTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TokenType[] | ListEnumTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTokenTypeWithAggregatesFilter<$PrismaModel> | $Enums.TokenType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTokenTypeFilter<$PrismaModel>
    _max?: NestedEnumTokenTypeFilter<$PrismaModel>
  }

  export type NestedEnumEmailLogTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogType | EnumEmailLogTypeFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogTypeFilter<$PrismaModel> | $Enums.EmailLogType
  }

  export type NestedEnumEmailLogStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogStatus | EnumEmailLogStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogStatusFilter<$PrismaModel> | $Enums.EmailLogStatus
  }

  export type NestedEnumEmailLogTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogType | EnumEmailLogTypeFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogType[] | ListEnumEmailLogTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogTypeWithAggregatesFilter<$PrismaModel> | $Enums.EmailLogType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmailLogTypeFilter<$PrismaModel>
    _max?: NestedEnumEmailLogTypeFilter<$PrismaModel>
  }

  export type NestedEnumEmailLogStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmailLogStatus | EnumEmailLogStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmailLogStatus[] | ListEnumEmailLogStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmailLogStatusWithAggregatesFilter<$PrismaModel> | $Enums.EmailLogStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmailLogStatusFilter<$PrismaModel>
    _max?: NestedEnumEmailLogStatusFilter<$PrismaModel>
  }

  export type NestedEnumAdminRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminRole | EnumAdminRoleFieldRefInput<$PrismaModel>
    in?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminRoleFilter<$PrismaModel> | $Enums.AdminRole
  }

  export type NestedEnumAdminRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminRole | EnumAdminRoleFieldRefInput<$PrismaModel>
    in?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminRole[] | ListEnumAdminRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminRoleWithAggregatesFilter<$PrismaModel> | $Enums.AdminRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAdminRoleFilter<$PrismaModel>
    _max?: NestedEnumAdminRoleFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type VerificationTokenCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
  }

  export type VerificationTokenUncheckedCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
  }

  export type VerificationTokenCreateOrConnectWithoutUserInput = {
    where: VerificationTokenWhereUniqueInput
    create: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput>
  }

  export type VerificationTokenCreateManyUserInputEnvelope = {
    data: VerificationTokenCreateManyUserInput | VerificationTokenCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type SessionCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type SessionUncheckedCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type SessionCreateOrConnectWithoutUserInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionCreateManyUserInputEnvelope = {
    data: SessionCreateManyUserInput | SessionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type EmailLogCreateWithoutUserInput = {
    id?: string
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
  }

  export type EmailLogUncheckedCreateWithoutUserInput = {
    id?: string
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
  }

  export type EmailLogCreateOrConnectWithoutUserInput = {
    where: EmailLogWhereUniqueInput
    create: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput>
  }

  export type EmailLogCreateManyUserInputEnvelope = {
    data: EmailLogCreateManyUserInput | EmailLogCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type VerificationTokenUpsertWithWhereUniqueWithoutUserInput = {
    where: VerificationTokenWhereUniqueInput
    update: XOR<VerificationTokenUpdateWithoutUserInput, VerificationTokenUncheckedUpdateWithoutUserInput>
    create: XOR<VerificationTokenCreateWithoutUserInput, VerificationTokenUncheckedCreateWithoutUserInput>
  }

  export type VerificationTokenUpdateWithWhereUniqueWithoutUserInput = {
    where: VerificationTokenWhereUniqueInput
    data: XOR<VerificationTokenUpdateWithoutUserInput, VerificationTokenUncheckedUpdateWithoutUserInput>
  }

  export type VerificationTokenUpdateManyWithWhereWithoutUserInput = {
    where: VerificationTokenScalarWhereInput
    data: XOR<VerificationTokenUpdateManyMutationInput, VerificationTokenUncheckedUpdateManyWithoutUserInput>
  }

  export type VerificationTokenScalarWhereInput = {
    AND?: VerificationTokenScalarWhereInput | VerificationTokenScalarWhereInput[]
    OR?: VerificationTokenScalarWhereInput[]
    NOT?: VerificationTokenScalarWhereInput | VerificationTokenScalarWhereInput[]
    id?: StringFilter<"VerificationToken"> | string
    userId?: StringFilter<"VerificationToken"> | string
    tokenHash?: StringFilter<"VerificationToken"> | string
    tokenType?: EnumTokenTypeFilter<"VerificationToken"> | $Enums.TokenType
    expiresAt?: DateTimeFilter<"VerificationToken"> | Date | string
    used?: BoolFilter<"VerificationToken"> | boolean
    usedAt?: DateTimeNullableFilter<"VerificationToken"> | Date | string | null
    invalidatedReason?: StringNullableFilter<"VerificationToken"> | string | null
    createdAt?: DateTimeFilter<"VerificationToken"> | Date | string
  }

  export type SessionUpsertWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
  }

  export type SessionUpdateManyWithWhereWithoutUserInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutUserInput>
  }

  export type SessionScalarWhereInput = {
    AND?: SessionScalarWhereInput | SessionScalarWhereInput[]
    OR?: SessionScalarWhereInput[]
    NOT?: SessionScalarWhereInput | SessionScalarWhereInput[]
    id?: StringFilter<"Session"> | string
    userId?: StringFilter<"Session"> | string
    tokenHash?: StringFilter<"Session"> | string
    revoked?: BoolFilter<"Session"> | boolean
    createdAt?: DateTimeFilter<"Session"> | Date | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
  }

  export type EmailLogUpsertWithWhereUniqueWithoutUserInput = {
    where: EmailLogWhereUniqueInput
    update: XOR<EmailLogUpdateWithoutUserInput, EmailLogUncheckedUpdateWithoutUserInput>
    create: XOR<EmailLogCreateWithoutUserInput, EmailLogUncheckedCreateWithoutUserInput>
  }

  export type EmailLogUpdateWithWhereUniqueWithoutUserInput = {
    where: EmailLogWhereUniqueInput
    data: XOR<EmailLogUpdateWithoutUserInput, EmailLogUncheckedUpdateWithoutUserInput>
  }

  export type EmailLogUpdateManyWithWhereWithoutUserInput = {
    where: EmailLogScalarWhereInput
    data: XOR<EmailLogUpdateManyMutationInput, EmailLogUncheckedUpdateManyWithoutUserInput>
  }

  export type EmailLogScalarWhereInput = {
    AND?: EmailLogScalarWhereInput | EmailLogScalarWhereInput[]
    OR?: EmailLogScalarWhereInput[]
    NOT?: EmailLogScalarWhereInput | EmailLogScalarWhereInput[]
    id?: StringFilter<"EmailLog"> | string
    userId?: StringNullableFilter<"EmailLog"> | string | null
    type?: EnumEmailLogTypeFilter<"EmailLog"> | $Enums.EmailLogType
    recipient?: StringFilter<"EmailLog"> | string
    status?: EnumEmailLogStatusFilter<"EmailLog"> | $Enums.EmailLogStatus
    sendgridMsgId?: StringNullableFilter<"EmailLog"> | string | null
    sentAt?: DateTimeNullableFilter<"EmailLog"> | Date | string | null
    createdAt?: DateTimeFilter<"EmailLog"> | Date | string
  }

  export type UserCreateWithoutVerificationTokensInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutVerificationTokensInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutVerificationTokensInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutVerificationTokensInput, UserUncheckedCreateWithoutVerificationTokensInput>
  }

  export type UserUpsertWithoutVerificationTokensInput = {
    update: XOR<UserUpdateWithoutVerificationTokensInput, UserUncheckedUpdateWithoutVerificationTokensInput>
    create: XOR<UserCreateWithoutVerificationTokensInput, UserUncheckedCreateWithoutVerificationTokensInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutVerificationTokensInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutVerificationTokensInput, UserUncheckedUpdateWithoutVerificationTokensInput>
  }

  export type UserUpdateWithoutVerificationTokensInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutVerificationTokensInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutSessionsInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSessionsInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenUncheckedCreateNestedManyWithoutUserInput
    emailLogs?: EmailLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSessionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUncheckedUpdateManyWithoutUserNestedInput
    emailLogs?: EmailLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutEmailLogsInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenCreateNestedManyWithoutUserInput
    sessions?: SessionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutEmailLogsInput = {
    id?: string
    firstName: string
    lastName: string
    email: string
    passwordHash?: string | null
    status?: $Enums.UserStatus
    userType: $Enums.UserType
    businessName?: string | null
    country?: string | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | string | null
    oauthProvider?: $Enums.OAuthProvider | null
    oauthSub?: string | null
    oauthRevoked?: boolean
    currentTier?: $Enums.LoyaltyTier
    loyaltyPoints?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    verificationTokens?: VerificationTokenUncheckedCreateNestedManyWithoutUserInput
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutEmailLogsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutEmailLogsInput, UserUncheckedCreateWithoutEmailLogsInput>
  }

  export type UserUpsertWithoutEmailLogsInput = {
    update: XOR<UserUpdateWithoutEmailLogsInput, UserUncheckedUpdateWithoutEmailLogsInput>
    create: XOR<UserCreateWithoutEmailLogsInput, UserUncheckedCreateWithoutEmailLogsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutEmailLogsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutEmailLogsInput, UserUncheckedUpdateWithoutEmailLogsInput>
  }

  export type UserUpdateWithoutEmailLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUpdateManyWithoutUserNestedInput
    sessions?: SessionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutEmailLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus
    userType?: EnumUserTypeFieldUpdateOperationsInput | $Enums.UserType
    businessName?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    oauthProvider?: NullableEnumOAuthProviderFieldUpdateOperationsInput | $Enums.OAuthProvider | null
    oauthSub?: NullableStringFieldUpdateOperationsInput | string | null
    oauthRevoked?: BoolFieldUpdateOperationsInput | boolean
    currentTier?: EnumLoyaltyTierFieldUpdateOperationsInput | $Enums.LoyaltyTier
    loyaltyPoints?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationTokens?: VerificationTokenUncheckedUpdateManyWithoutUserNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type AdminSessionCreateWithoutAdminUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type AdminSessionUncheckedCreateWithoutAdminUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type AdminSessionCreateOrConnectWithoutAdminUserInput = {
    where: AdminSessionWhereUniqueInput
    create: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput>
  }

  export type AdminSessionCreateManyAdminUserInputEnvelope = {
    data: AdminSessionCreateManyAdminUserInput | AdminSessionCreateManyAdminUserInput[]
    skipDuplicates?: boolean
  }

  export type AdminRecoveryCodeCreateWithoutAdminUserInput = {
    id?: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput = {
    id?: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AdminRecoveryCodeCreateOrConnectWithoutAdminUserInput = {
    where: AdminRecoveryCodeWhereUniqueInput
    create: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput>
  }

  export type AdminRecoveryCodeCreateManyAdminUserInputEnvelope = {
    data: AdminRecoveryCodeCreateManyAdminUserInput | AdminRecoveryCodeCreateManyAdminUserInput[]
    skipDuplicates?: boolean
  }

  export type AuditLogCreateWithoutAdminInput = {
    id?: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
  }

  export type AuditLogUncheckedCreateWithoutAdminInput = {
    id?: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
  }

  export type AuditLogCreateOrConnectWithoutAdminInput = {
    where: AuditLogWhereUniqueInput
    create: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput>
  }

  export type AuditLogCreateManyAdminInputEnvelope = {
    data: AuditLogCreateManyAdminInput | AuditLogCreateManyAdminInput[]
    skipDuplicates?: boolean
  }

  export type AdminSessionUpsertWithWhereUniqueWithoutAdminUserInput = {
    where: AdminSessionWhereUniqueInput
    update: XOR<AdminSessionUpdateWithoutAdminUserInput, AdminSessionUncheckedUpdateWithoutAdminUserInput>
    create: XOR<AdminSessionCreateWithoutAdminUserInput, AdminSessionUncheckedCreateWithoutAdminUserInput>
  }

  export type AdminSessionUpdateWithWhereUniqueWithoutAdminUserInput = {
    where: AdminSessionWhereUniqueInput
    data: XOR<AdminSessionUpdateWithoutAdminUserInput, AdminSessionUncheckedUpdateWithoutAdminUserInput>
  }

  export type AdminSessionUpdateManyWithWhereWithoutAdminUserInput = {
    where: AdminSessionScalarWhereInput
    data: XOR<AdminSessionUpdateManyMutationInput, AdminSessionUncheckedUpdateManyWithoutAdminUserInput>
  }

  export type AdminSessionScalarWhereInput = {
    AND?: AdminSessionScalarWhereInput | AdminSessionScalarWhereInput[]
    OR?: AdminSessionScalarWhereInput[]
    NOT?: AdminSessionScalarWhereInput | AdminSessionScalarWhereInput[]
    id?: StringFilter<"AdminSession"> | string
    adminUserId?: StringFilter<"AdminSession"> | string
    tokenHash?: StringFilter<"AdminSession"> | string
    revoked?: BoolFilter<"AdminSession"> | boolean
    lastActiveAt?: DateTimeFilter<"AdminSession"> | Date | string
    createdAt?: DateTimeFilter<"AdminSession"> | Date | string
    expiresAt?: DateTimeFilter<"AdminSession"> | Date | string
  }

  export type AdminRecoveryCodeUpsertWithWhereUniqueWithoutAdminUserInput = {
    where: AdminRecoveryCodeWhereUniqueInput
    update: XOR<AdminRecoveryCodeUpdateWithoutAdminUserInput, AdminRecoveryCodeUncheckedUpdateWithoutAdminUserInput>
    create: XOR<AdminRecoveryCodeCreateWithoutAdminUserInput, AdminRecoveryCodeUncheckedCreateWithoutAdminUserInput>
  }

  export type AdminRecoveryCodeUpdateWithWhereUniqueWithoutAdminUserInput = {
    where: AdminRecoveryCodeWhereUniqueInput
    data: XOR<AdminRecoveryCodeUpdateWithoutAdminUserInput, AdminRecoveryCodeUncheckedUpdateWithoutAdminUserInput>
  }

  export type AdminRecoveryCodeUpdateManyWithWhereWithoutAdminUserInput = {
    where: AdminRecoveryCodeScalarWhereInput
    data: XOR<AdminRecoveryCodeUpdateManyMutationInput, AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserInput>
  }

  export type AdminRecoveryCodeScalarWhereInput = {
    AND?: AdminRecoveryCodeScalarWhereInput | AdminRecoveryCodeScalarWhereInput[]
    OR?: AdminRecoveryCodeScalarWhereInput[]
    NOT?: AdminRecoveryCodeScalarWhereInput | AdminRecoveryCodeScalarWhereInput[]
    id?: StringFilter<"AdminRecoveryCode"> | string
    adminUserId?: StringFilter<"AdminRecoveryCode"> | string
    codeHash?: StringFilter<"AdminRecoveryCode"> | string
    usedAt?: DateTimeNullableFilter<"AdminRecoveryCode"> | Date | string | null
    createdAt?: DateTimeFilter<"AdminRecoveryCode"> | Date | string
  }

  export type AuditLogUpsertWithWhereUniqueWithoutAdminInput = {
    where: AuditLogWhereUniqueInput
    update: XOR<AuditLogUpdateWithoutAdminInput, AuditLogUncheckedUpdateWithoutAdminInput>
    create: XOR<AuditLogCreateWithoutAdminInput, AuditLogUncheckedCreateWithoutAdminInput>
  }

  export type AuditLogUpdateWithWhereUniqueWithoutAdminInput = {
    where: AuditLogWhereUniqueInput
    data: XOR<AuditLogUpdateWithoutAdminInput, AuditLogUncheckedUpdateWithoutAdminInput>
  }

  export type AuditLogUpdateManyWithWhereWithoutAdminInput = {
    where: AuditLogScalarWhereInput
    data: XOR<AuditLogUpdateManyMutationInput, AuditLogUncheckedUpdateManyWithoutAdminInput>
  }

  export type AuditLogScalarWhereInput = {
    AND?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[]
    OR?: AuditLogScalarWhereInput[]
    NOT?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[]
    id?: StringFilter<"AuditLog"> | string
    adminId?: StringFilter<"AuditLog"> | string
    role?: StringFilter<"AuditLog"> | string
    action?: StringFilter<"AuditLog"> | string
    targetType?: StringNullableFilter<"AuditLog"> | string | null
    targetId?: StringNullableFilter<"AuditLog"> | string | null
    oldValue?: StringNullableFilter<"AuditLog"> | string | null
    newValue?: StringNullableFilter<"AuditLog"> | string | null
    ipAddress?: StringFilter<"AuditLog"> | string
    timestamp?: DateTimeFilter<"AuditLog"> | Date | string
  }

  export type AdminUserCreateWithoutAdminSessionsInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    recoveryCodes?: AdminRecoveryCodeCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogCreateNestedManyWithoutAdminInput
  }

  export type AdminUserUncheckedCreateWithoutAdminSessionsInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    recoveryCodes?: AdminRecoveryCodeUncheckedCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutAdminInput
  }

  export type AdminUserCreateOrConnectWithoutAdminSessionsInput = {
    where: AdminUserWhereUniqueInput
    create: XOR<AdminUserCreateWithoutAdminSessionsInput, AdminUserUncheckedCreateWithoutAdminSessionsInput>
  }

  export type AdminUserUpsertWithoutAdminSessionsInput = {
    update: XOR<AdminUserUpdateWithoutAdminSessionsInput, AdminUserUncheckedUpdateWithoutAdminSessionsInput>
    create: XOR<AdminUserCreateWithoutAdminSessionsInput, AdminUserUncheckedCreateWithoutAdminSessionsInput>
    where?: AdminUserWhereInput
  }

  export type AdminUserUpdateToOneWithWhereWithoutAdminSessionsInput = {
    where?: AdminUserWhereInput
    data: XOR<AdminUserUpdateWithoutAdminSessionsInput, AdminUserUncheckedUpdateWithoutAdminSessionsInput>
  }

  export type AdminUserUpdateWithoutAdminSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    recoveryCodes?: AdminRecoveryCodeUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserUncheckedUpdateWithoutAdminSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    recoveryCodes?: AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUncheckedUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserCreateWithoutRecoveryCodesInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogCreateNestedManyWithoutAdminInput
  }

  export type AdminUserUncheckedCreateWithoutRecoveryCodesInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionUncheckedCreateNestedManyWithoutAdminUserInput
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutAdminInput
  }

  export type AdminUserCreateOrConnectWithoutRecoveryCodesInput = {
    where: AdminUserWhereUniqueInput
    create: XOR<AdminUserCreateWithoutRecoveryCodesInput, AdminUserUncheckedCreateWithoutRecoveryCodesInput>
  }

  export type AdminUserUpsertWithoutRecoveryCodesInput = {
    update: XOR<AdminUserUpdateWithoutRecoveryCodesInput, AdminUserUncheckedUpdateWithoutRecoveryCodesInput>
    create: XOR<AdminUserCreateWithoutRecoveryCodesInput, AdminUserUncheckedCreateWithoutRecoveryCodesInput>
    where?: AdminUserWhereInput
  }

  export type AdminUserUpdateToOneWithWhereWithoutRecoveryCodesInput = {
    where?: AdminUserWhereInput
    data: XOR<AdminUserUpdateWithoutRecoveryCodesInput, AdminUserUncheckedUpdateWithoutRecoveryCodesInput>
  }

  export type AdminUserUpdateWithoutRecoveryCodesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserUncheckedUpdateWithoutRecoveryCodesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUncheckedUpdateManyWithoutAdminUserNestedInput
    auditLogs?: AuditLogUncheckedUpdateManyWithoutAdminNestedInput
  }

  export type AdminUserCreateWithoutAuditLogsInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionCreateNestedManyWithoutAdminUserInput
    recoveryCodes?: AdminRecoveryCodeCreateNestedManyWithoutAdminUserInput
  }

  export type AdminUserUncheckedCreateWithoutAuditLogsInput = {
    id?: string
    name: string
    email: string
    passwordHash: string
    role: $Enums.AdminRole
    countryScope?: AdminUserCreatecountryScopeInput | string[]
    totpEnabled?: boolean
    totpSecretEncrypted?: string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    cancellationCount?: number
    adminSessions?: AdminSessionUncheckedCreateNestedManyWithoutAdminUserInput
    recoveryCodes?: AdminRecoveryCodeUncheckedCreateNestedManyWithoutAdminUserInput
  }

  export type AdminUserCreateOrConnectWithoutAuditLogsInput = {
    where: AdminUserWhereUniqueInput
    create: XOR<AdminUserCreateWithoutAuditLogsInput, AdminUserUncheckedCreateWithoutAuditLogsInput>
  }

  export type AdminUserUpsertWithoutAuditLogsInput = {
    update: XOR<AdminUserUpdateWithoutAuditLogsInput, AdminUserUncheckedUpdateWithoutAuditLogsInput>
    create: XOR<AdminUserCreateWithoutAuditLogsInput, AdminUserUncheckedCreateWithoutAuditLogsInput>
    where?: AdminUserWhereInput
  }

  export type AdminUserUpdateToOneWithWhereWithoutAuditLogsInput = {
    where?: AdminUserWhereInput
    data: XOR<AdminUserUpdateWithoutAuditLogsInput, AdminUserUncheckedUpdateWithoutAuditLogsInput>
  }

  export type AdminUserUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUpdateManyWithoutAdminUserNestedInput
    recoveryCodes?: AdminRecoveryCodeUpdateManyWithoutAdminUserNestedInput
  }

  export type AdminUserUncheckedUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    role?: EnumAdminRoleFieldUpdateOperationsInput | $Enums.AdminRole
    countryScope?: AdminUserUpdatecountryScopeInput | string[]
    totpEnabled?: BoolFieldUpdateOperationsInput | boolean
    totpSecretEncrypted?: NullableStringFieldUpdateOperationsInput | string | null
    fido2Credential?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cancellationCount?: IntFieldUpdateOperationsInput | number
    adminSessions?: AdminSessionUncheckedUpdateManyWithoutAdminUserNestedInput
    recoveryCodes?: AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserNestedInput
  }

  export type VerificationTokenCreateManyUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.TokenType
    expiresAt: Date | string
    used?: boolean
    usedAt?: Date | string | null
    invalidatedReason?: string | null
    createdAt?: Date | string
  }

  export type SessionCreateManyUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type EmailLogCreateManyUserInput = {
    id?: string
    type: $Enums.EmailLogType
    recipient: string
    status?: $Enums.EmailLogStatus
    sendgridMsgId?: string | null
    sentAt?: Date | string | null
    createdAt?: Date | string
  }

  export type VerificationTokenUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationTokenUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationTokenUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumTokenTypeFieldUpdateOperationsInput | $Enums.TokenType
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    used?: BoolFieldUpdateOperationsInput | boolean
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    invalidatedReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmailLogUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: EnumEmailLogTypeFieldUpdateOperationsInput | $Enums.EmailLogType
    recipient?: StringFieldUpdateOperationsInput | string
    status?: EnumEmailLogStatusFieldUpdateOperationsInput | $Enums.EmailLogStatus
    sendgridMsgId?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminSessionCreateManyAdminUserInput = {
    id?: string
    tokenHash: string
    revoked?: boolean
    lastActiveAt?: Date | string
    createdAt?: Date | string
    expiresAt: Date | string
  }

  export type AdminRecoveryCodeCreateManyAdminUserInput = {
    id?: string
    codeHash: string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AuditLogCreateManyAdminInput = {
    id?: string
    role: string
    action: string
    targetType?: string | null
    targetId?: string | null
    oldValue?: string | null
    newValue?: string | null
    ipAddress: string
    timestamp?: Date | string
  }

  export type AdminSessionUpdateWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminSessionUncheckedUpdateWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminSessionUncheckedUpdateManyWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    revoked?: BoolFieldUpdateOperationsInput | boolean
    lastActiveAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeUpdateWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeUncheckedUpdateWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminRecoveryCodeUncheckedUpdateManyWithoutAdminUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    codeHash?: StringFieldUpdateOperationsInput | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogUpdateWithoutAdminInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogUncheckedUpdateWithoutAdminInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuditLogUncheckedUpdateManyWithoutAdminInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    targetType?: NullableStringFieldUpdateOperationsInput | string | null
    targetId?: NullableStringFieldUpdateOperationsInput | string | null
    oldValue?: NullableStringFieldUpdateOperationsInput | string | null
    newValue?: NullableStringFieldUpdateOperationsInput | string | null
    ipAddress?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}