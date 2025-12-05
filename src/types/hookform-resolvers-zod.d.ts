declare module '@hookform/resolvers/zod';
declare module '@hookform/resolvers/zod/dist/zod' {
  import type { ZodSchema } from 'zod';
  import type { Resolver, ResolverOptions } from 'react-hook-form';

  export function zodResolver<TFieldValues = unknown, TContext = unknown>(
    schema: ZodSchema,
    schemaOptions?: unknown,
    resolverOptions?: ResolverOptions<TFieldValues>
  ): Resolver<TFieldValues, TContext>;
}
