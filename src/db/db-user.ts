import { Entity } from "electrodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EnvironmentManager } from "../environment-manager";
import {logger} from "../logger";

export const DbUser = new Entity(
  {
    model: {
      entity: "user",
      version: "1",
      service: "user",
    },
    attributes: {
      userId: {
        type: "string",
        required: true,
      },
      email: {
        type: "string",
        required: true,
      },
      location: {
        type: "string",
        required: true,
      },
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      role: {
        type: "string",
        required: true,
      },
    },
    indexes: {
      byUser: {
        pk: {
          field: "PK",
          composite: ["userId"],
        },
        sk: {
          field: "SK",
          composite: ["email"],
        },
      },
    },
  },
  {
    client: new DynamoDBClient(),
    table: EnvironmentManager.getDb(),
    logger: (event) => logger.debug('DBUser', {event}),
  },
);
