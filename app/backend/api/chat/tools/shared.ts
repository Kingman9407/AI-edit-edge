export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
        }
      >;
      required?: string[];
    };
  };
};

export const asNumber = (value: unknown) => Number(value);

export const asClip = (value: unknown) =>
  typeof value === "number" ? value : null;

export const asReason = (value: unknown) =>
  typeof value === "string" ? value : null;

