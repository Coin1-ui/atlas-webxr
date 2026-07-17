import { requireAuthUser } from "./auth.mjs";
import { isPlatformOwnerUser } from "./platform-owner.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function requirePlatformOwner(event) {
  const user = await requireAuthUser(event);
  if (!isPlatformOwnerUser(user)) {
    const err = new Error("Forbidden — platform operator access required");
    err.statusCode = 403;
    throw err;
  }
  return user;
}
