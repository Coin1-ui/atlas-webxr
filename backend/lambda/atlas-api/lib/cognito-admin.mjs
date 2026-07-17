import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

export function isCognitoEmailLookupConfigured() {
  return Boolean(process.env.COGNITO_USER_POOL_ID?.trim());
}

/**
 * @param {import("@aws-sdk/client-cognito-identity-provider").AttributeType[] | undefined} attrs
 */
function emailFromAttrs(attrs) {
  const direct = attrs?.find((a) => a.Name === "email")?.Value?.trim().toLowerCase();
  if (direct) return direct;
  const username =
    attrs?.find((a) => a.Name === "preferred_username")?.Value?.trim().toLowerCase() ||
    attrs?.find((a) => a.Name === "cognito:username")?.Value?.trim().toLowerCase();
  if (username?.includes("@")) return username;
  return undefined;
}

/**
 * Resolve Cognito user email from sub or username (email-as-username pools).
 * @param {string} usernameOrSub
 * @returns {Promise<string | undefined>}
 */
export async function adminGetUserEmail(usernameOrSub) {
  const poolId = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!poolId || !usernameOrSub) return undefined;
  if (process.env.ATLAS_DEV_MODE === "true") return undefined;

  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
  const client = new CognitoIdentityProviderClient({ region });

  try {
    const out = await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: usernameOrSub,
      }),
    );
    const email = emailFromAttrs(out.UserAttributes);
    if (email) return email;
  } catch {
    /* Username is usually email; members store sub */
  }

  try {
    let paginationToken;
    do {
      const listed = await client.send(
        new ListUsersCommand({
          UserPoolId: poolId,
          Filter: `sub = "${usernameOrSub}"`,
          Limit: 60,
          PaginationToken: paginationToken,
        }),
      );
      for (const user of listed.Users ?? []) {
        const email = emailFromAttrs(user.Attributes);
        if (email) return email;
        const cognitoUsername = user.Username?.trim().toLowerCase();
        if (cognitoUsername?.includes("@")) return cognitoUsername;
      }
      paginationToken = listed.PaginationToken;
    } while (paginationToken);
  } catch {
    /* IAM or filter failure */
  }

  return undefined;
}

/**
 * Delete Cognito user via AdminDeleteUser (server-side; no client OAuth scope needed).
 * @param {{ sub: string; email?: string }} user
 */
export async function adminDeleteCognitoUser(user) {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId || process.env.ATLAS_DEV_MODE === "true") return;

  const username = user.email?.trim().toLowerCase() || user.sub;
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
  const client = new CognitoIdentityProviderClient({ region });

  await client.send(
    new AdminDeleteUserCommand({
      UserPoolId: poolId,
      Username: username,
    }),
  );
}
