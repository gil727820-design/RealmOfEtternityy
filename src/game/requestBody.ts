import { NextRequest } from "next/server";

/**
 * O corpo de um NextRequest (req.json()) só pode ser lido UMA vez.
 * As rotas centrais precisam do body para descobrir a action (ex.: POST
 * /api/game sem query), mas os handlers também chamam req.json(). Este
 * wrapper devolve o corpo já parseado em vez de tentar ler o stream de novo,
 * evitando o erro "Body is unusable: Body has already been read".
 */
export function withBody(req: NextRequest, body: unknown): NextRequest {
  const json = async () => body;
  return new Proxy(req, {
    get(target, prop) {
      if (prop === "json") return json;
      const value = (target as any)[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as NextRequest;
}