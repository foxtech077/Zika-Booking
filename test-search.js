import { searchRoutes } from "./services/listing-service/src/routes/search.js";
import Fastify from "fastify";

async function test() {
  const app = Fastify();
  await app.register(searchRoutes);
  
  // Inject mock request
  const response = await app.inject({
    method: "GET",
    url: "/search?category=hotel&lat=0&lng=0&radius_km=20000&sort=recommended&limit=50"
  });
  
  console.log("STATUS CODE:", response.statusCode);
  console.log("BODY:", response.body);
}

test().catch(console.error);