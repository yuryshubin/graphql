import { GraphQLInput } from "./graphql-input";
import { DbUser } from "./db";
import { EntityRecord } from "electrodb";
import * as crypto from "crypto";
import { DbFullTimeJob, DbContactJob } from "./db";
import {logger, setupLoggerBase} from "./logger";
import {EnvironmentManager} from "./environment-manager";

enum JobType {
  FullTimeJob = "FullTimeJob",
  ContractJob = "ContractJob",
}

// excluding sub items
const group = <
  T extends typeof DbUser | typeof DbFullTimeJob | typeof DbContactJob,
>(
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
  logger.debug(`group result`, {foundKeys, otherKeys});
  return { foundKeys, otherKeys };
};

const fragment = (text: string) => {
  const components = text.split("\n").map((v) => v.replace("\n", ""));

  let items: string[][] = [];
  let content: string[] = [];
  const targetLevel = 2;
  let currentLevel = 0;

  for (const v of components) {
    if (v.includes("{")) {
      currentLevel++;

      if (currentLevel === targetLevel) {
        content.push(v);
      }
    } else if (v.includes("}")) {

      if (currentLevel === targetLevel) {
        content.push(v);
        items.push(content);
        content = [];
      }

      currentLevel--;
    } else {
      if (currentLevel === targetLevel) content.push(v);
    }
  }

  const info: Record<string, string[]> = {};
  items.forEach((item) => {
    const entity = item[0].split(" ")[4];

    const values = [];
    for (let i = 1; i < item.length - 1; ++i)
      values.push(item[i].replaceAll(" ", ""));

    info[entity] = values;
  });
  return info;
};

const createUser = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["userId"] = crypto.randomUUID();
  logger.debug("createUser...", params);

  const response = await DbUser.put(params as any).go();
  logger.debug(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbUser>;
  logger.debug(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getUsers = async (event: GraphQLInput) => {
  logger.debug("getUsers...");
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
  logger.debug(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  logger.debug(`entities`, JSON.stringify(entities, null, 2));

  return entities;
};

const getUser = async (event: GraphQLInput) => {
  const userId = event.args.input["userId"];
  logger.debug("getUser...", userId);

  const response = await DbUser.query
    .byUser({ userId })
    .go({ limit: 1, select: event.selectionSetList });
  logger.debug(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  logger.debug(`entities`, JSON.stringify(entities, null, 2));

  if (!entities.length) throw new Error(`No user found for ${userId}`);

  return entities[0];
};

const addFullTimeJob = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["jobId"] = crypto.randomUUID();

  logger.debug("create FullTimeJob...", params);

  const response = await DbFullTimeJob.put(params as any).go();
  logger.debug(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbFullTimeJob>;
  logger.debug(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const addContractJob = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["jobId"] = crypto.randomUUID();

  logger.debug("create ContractJob...", params);

  const response = await DbContactJob.put(params as any).go();
  logger.debug(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbContactJob>;
  logger.debug(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getJobsByUserIdInternal = async (
  userId: string,
  selectionSetList: string[],
  selectionSetGraphQL: string,
) => {
  logger.debug("getJobs...", userId);
  const fragments = fragment(selectionSetGraphQL);
  logger.debug(`selectionSetList`, JSON.stringify(selectionSetList, null, 2));
  logger.debug(`fragments`, JSON.stringify(fragments, null, 2));

  const results = [];

  // case 1
  if (selectionSetList.length || fragments[JobType.FullTimeJob]?.length) {
    const extras1 = fragments[JobType.FullTimeJob] || [];
    const response1 = await DbFullTimeJob.query
      .byUser({ userId })
      .go({ limit: 10, select: selectionSetList.concat(...extras1) });
    logger.debug(`response full time jobs`, JSON.stringify(response1, null, 2));
    const entities1 = response1.data as EntityRecord<typeof DbFullTimeJob>[];
    entities1.forEach((x) => {
      (x as Record<string, any>)["__typename"] = JobType.FullTimeJob;
    });
    logger.debug(`entities full time jobs`, JSON.stringify(entities1, null, 2));
    results.push(...entities1);
  }

  // case 2
  if (selectionSetList.length || fragments[JobType.ContractJob]?.length) {
    const extras2 = fragments[JobType.ContractJob] || [];
    const response2 = await DbContactJob.query
      .byUser({ userId })
      .go({ limit: 10, select: selectionSetList.concat(...extras2) });
    logger.debug(`response contract jobs`, JSON.stringify(response2, null, 2));
    const entities2 = response2.data as EntityRecord<typeof DbContactJob>[];
    entities2.forEach((x) => {
      (x as Record<string, any>)["__typename"] = JobType.ContractJob;
    });
    logger.debug(`entities contract jobs`, JSON.stringify(entities2, null, 2));
    results.push(...entities2);
  }

  logger.debug(`results`, JSON.stringify(results, null, 2));
  return results;
};

const getJobsByUserIdParam = async (event: GraphQLInput) => {
  logger.debug("getJobsByUserIdParam");
  const params = event.args.input as Record<string, any>;
  return await getJobsByUserIdInternal(
    params.userId,
    event.selectionSetList,
    event.selectionSetGraphQL,
  );
};

const getJobsByUserId = async (event: GraphQLInput) => {
  logger.debug("getJobsByUserId");
  const userId = (event.source as EntityRecord<typeof DbUser>).userId;
  return await getJobsByUserIdInternal(
    userId,
    event.selectionSetList,
    event.selectionSetGraphQL,
  );
};

export const handler = async (event: GraphQLInput, context: any) => {
  setupLoggerBase("DEBUG", 'global-resolver', event.selectionSetGraphQL, EnvironmentManager.getStage())
  logger.debug("event", {event});

  try {
    switch (event.fieldName) {
      case "getUsers":
        return getUsers(event);
      case "getUser":
        return getUser(event);
      case "createUser":
        return createUser(event);
      case "addFullTimeJob":
        return addFullTimeJob(event);
      case "addContractJob":
        return addContractJob(event);
      case "getJobs":
        return getJobsByUserIdParam(event);
      case "jobs":
        return getJobsByUserId(event);
    }
  } catch (e) {
    logger.error('error', {e});
    return { statusCode: 500, body: JSON.stringify(e) };
  }
};
