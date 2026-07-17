export function cognitoConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_COGNITO_USER_POOL_ID &&
      import.meta.env.VITE_COGNITO_CLIENT_ID &&
      import.meta.env.VITE_COGNITO_REGION
  );
}

export function cognitoRegion(): string {
  return (import.meta.env.VITE_COGNITO_REGION as string | undefined) ?? "ap-south-1";
}

export function cognitoUserPoolId(): string {
  return (import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined) ?? "";
}

export function cognitoClientId(): string {
  return (import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined) ?? "";
}
