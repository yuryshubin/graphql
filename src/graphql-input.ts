export interface GraphQLInput {
  fieldName: string;
  parentTypeName: "Query" | "Mutation";
  variables: Record<string, any>;
  selectionSetList: string[];
  selectionSetGraphQL: string;
  args: {
    input: Record<string, any>;
  };
  source: Record<string, any>;
}
