import { GraphQLInput } from "./graphql-input";
import { DbUser } from "./db/db-user";
import { EntityRecord } from "electrodb";
import * as crypto from "crypto";
import { DbJob } from "./db/db-job";

// https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference-js.html
const group = <T extends typeof DbUser | typeof DbJob>(
  event: GraphQLInput,
  entity: T,
) => {
  const existingSet = new Set(Object.keys(entity.schema.attributes));
  const selectionSetListSet = new Set(event.selectionSetList);
  const foundSet = new Set(
    [...existingSet].filter((x) => selectionSetListSet.has(x)),
  );
  const missingSet = new Set(
    [...selectionSetListSet].filter((x) => !existingSet.has(x)),
  );
  const foundKeys = Array.from(foundSet);
  const otherKeys = Array.from(missingSet);
  console.info(`foundKeys`, foundKeys);
  console.info(`otherKeys`, otherKeys);
  return { foundKeys, otherKeys };
};

const createUser = async (event: GraphQLInput) => {
  const params = event.variables.input as Record<string, any>;
  params["userId"] = crypto.randomUUID();
  console.info("createUser...", params);

  const response = await DbUser.put(params as any).go();
  console.info(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbUser>;
  console.info(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getUsers = async (event: GraphQLInput) => {
  console.info("getUsers...");
  const selectionSetList = group(event, DbUser).foundKeys;

  const expressionAttributeNames: Record<string, string> = {
    "#PK": "PK",
    "#SK": "SK",
    "#__edb_e__": "__edb_e__",
    "#__edb_v__": "__edb_v__",
  };

  selectionSetList.forEach((value) => {
    expressionAttributeNames[`#${value}`] = value;
  });

  //const projectionExpression = "PK,SK,#__edb_e__,#__edb_v__";
  const projectionExpression = [
    "PK",
    "SK",
    "#__edb_e__",
    "#__edb_v__",
    ...selectionSetList.map((value) => `#${value}`),
  ].join(",");

  const response = await DbUser.scan.go({
    params: {
      ProjectionExpression: projectionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
    },
  });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  return entities;
};

const getUser = async (event: GraphQLInput) => {
  const userId = event.args.input["userId"];
  console.info("getUser...", userId);

  const response = await DbUser.query
    .byUser({ userId })
    .go({ limit: 1, select: event.selectionSetList });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  if (!entities.length) throw new Error(`No user found for ${userId}`);

  return entities[0];
};

const addJob = async (event: GraphQLInput) => {
  const params = event.variables.input as Record<
    string,
    any
  >;
  params["jobId"] = crypto.randomUUID();
  console.info("createJob...", params);

  const response = await DbJob.put(params as any).go();
  console.info(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbJob>;
  console.info(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getJobs = async (event: GraphQLInput) => {
  const params = event.variables.input as Record<
    string,
    any
  >;
  const userId = params.userId;
  console.info("getJobs...", userId);

  const response = await DbJob.query
    .byUser({ userId })
    .go({ limit: 10, select: event.selectionSetList });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbJob>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  return entities;
};

const getJobsByUserId = async (event: GraphQLInput) => {
  const userId = (event.source as EntityRecord<typeof DbUser>).userId;
  console.info("getJobs...", userId);

  const response = await DbJob.query
    .byUser({ userId })
    .go({ limit: 10, select: event.selectionSetList });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbJob>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  return entities;
};

export const handler = async (event: GraphQLInput, context: any) => {
  console.log("event:", JSON.stringify(event, null, 2));
  // console.log("context:", JSON.stringify(context, null, 2));

  try {
    switch (event.fieldName) {
      case "getUsers":
        return getUsers(event);
      case "getUser":
        return getUser(event);
      case "createUser":
        return createUser(event);
      case "addJob":
        return addJob(event);
      case "getJobs":
        return getJobs(event);
      case "jobs":
        return getJobsByUserId(event);
    }
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify(e) };
  }
};
