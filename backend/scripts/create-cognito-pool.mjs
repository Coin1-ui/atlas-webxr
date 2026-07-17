#!/usr/bin/env node
/**
 * Print AWS CLI commands to create a Cognito User Pool for Atlas AR SPA (PKCE).
 * Run the printed commands in a shell with AWS credentials configured.
 */
const region = process.env.AWS_REGION || "ap-south-1";
const poolName = process.env.ATLAS_COGNITO_POOL_NAME || "atlas-ar-dev";
const appName = process.env.ATLAS_COGNITO_APP_NAME || "atlas-ar-spa";

const localhost = "http://localhost:5173";
const callbacks = [localhost, `${localhost}/`, `${localhost}/login`, `${localhost}/onboard`];
const logoutUrls = callbacks;

console.log(`# Atlas AR Cognito setup (${region})`);
console.log(`
aws cognito-idp create-user-pool \\
  --region ${region} \\
  --pool-name ${poolName} \\
  --auto-verified-attributes email \\
  --username-attributes email \\
  --policies 'PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}'

# Note the UserPool Id from output, then:

aws cognito-idp create-user-pool-client \\
  --region ${region} \\
  --user-pool-id YOUR_POOL_ID \\
  --client-name ${appName} \\
  --generate-secret false \\
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \\
  --supported-identity-providers COGNITO \\
  --callback-urls ${callbacks.map((u) => `"${u}"`).join(" ")} \\
  --logout-urls ${logoutUrls.map((u) => `"${u}"`).join(" ")} \\
  --allowed-o-auth-flows code \\
  --allowed-o-auth-scopes email openid profile \\
  --allowed-o-auth-flows-user-pool-client

# Amplify / Vite env vars:
# VITE_COGNITO_REGION=${region}
# VITE_COGNITO_USER_POOL_ID=YOUR_POOL_ID
# VITE_COGNITO_CLIENT_ID=YOUR_CLIENT_ID

# Lambda env vars:
# COGNITO_REGION=${region}
# COGNITO_USER_POOL_ID=YOUR_POOL_ID
# COGNITO_CLIENT_ID=YOUR_CLIENT_ID
# ATLAS_CORS_ORIGIN=https://your-amplify-domain.amplifyapp.com
`);
