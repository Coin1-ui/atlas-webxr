import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { requireAuthUser } from "../lib/auth.mjs";
import { adminDeleteCognitoUser } from "../lib/cognito-admin.mjs";
import { deleteUserAccount } from "../lib/dynamodb.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleDeleteAccount(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    const user = await requireAuthUser(event);
    await deleteUserAccount(user.sub);
    await adminDeleteCognitoUser(user);
    return jsonResponse(200, { ok: true });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
