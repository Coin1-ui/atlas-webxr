#!/usr/bin/env node
/**
 * Create DynamoDB tables for Atlas AR SaaS (dev/staging).
 * Usage: node backend/scripts/create-dynamodb-tables.mjs [--region ap-south-1]
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const region = process.argv.includes("--region")
  ? process.argv[process.argv.indexOf("--region") + 1]
  : process.env.AWS_REGION || "ap-south-1";

const client = new DynamoDBClient({ region });

const tables = [
  {
    TableName: process.env.ATLAS_WORKSPACES_TABLE || "atlas-workspaces",
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: process.env.ATLAS_MEMBERS_TABLE || "atlas-members",
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: process.env.ATLAS_USAGE_TABLE || "atlas-usage",
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: process.env.ATLAS_BILLING_TABLE || "atlas-billing",
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
];

async function ensureTable(def) {
  try {
    await client.send(new DescribeTableCommand({ TableName: def.TableName }));
    console.log(`OK exists: ${def.TableName}`);
    return;
  } catch (e) {
    if (e.name !== "ResourceNotFoundException") throw e;
  }
  await client.send(new CreateTableCommand(def));
  console.log(`Created: ${def.TableName}`);
}

for (const def of tables) {
  await ensureTable(def);
}

console.log(
  "Done. Set Lambda env: ATLAS_WORKSPACES_TABLE, ATLAS_MEMBERS_TABLE, ATLAS_USAGE_TABLE, ATLAS_BILLING_TABLE"
);
