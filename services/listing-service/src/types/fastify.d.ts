import "fastify";


export interface LocationInfo {
  country: string;
  region: "AFRICA" | "OTHER";
}

declare module "fastify" {
    interface FastifyRequest {
      location?: {
        ip: string;
        country: string;
        region: "AFRICA" | "OTHER";
      };
    }
  }