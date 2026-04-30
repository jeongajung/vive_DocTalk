export interface A2UITextProps {
  text: string;
  variant?: "body" | "subtitle" | "title";
}

export interface A2UIChipProps {
  label: string;
}

export interface A2UIButtonProps {
  label: string;
}

export type A2UIComponentDef =
  | { Text: A2UITextProps }
  | { Card: { children: A2UINode[] } }
  | { Chip: A2UIChipProps }
  | { Button: A2UIButtonProps };

export interface A2UINode {
  id: string;
  component: A2UIComponentDef;
}

export interface A2UISurfaceUpdate {
  surfaceId: string;
  components: A2UINode[];
}

export interface A2UIMessage {
  surfaceUpdate: A2UISurfaceUpdate;
}
